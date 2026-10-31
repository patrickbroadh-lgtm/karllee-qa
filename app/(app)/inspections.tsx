import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import { STAGE_NUMBERS, canRecordInspection, inspectionResultLabel, latestAttempt } from '../../src/lib/inspection-helpers';
import { QA_STAGE_TEMPLATES } from '../../src/lib/qa-template';
import { validateCheckAnswers, type CheckResult } from '../../src/lib/check-answer-validation';
import { inspectionAnswers, stageAttemptHistory, type ChecklistAnswerRecord } from '../../src/lib/inspection-history';
import type { InspectionRecord, StageNumber } from '../../src/lib/project-types';

type DraftAnswer = { result: CheckResult | null; notes: string };
const RESULTS: readonly CheckResult[] = ['pass', 'fail', 'not_applicable'];

async function fetchHistory(plotId: string) {
  const { data, error } = await supabase.from('qa_inspections')
    .select('id,plot_id,stage_number,attempt,result,notes,inspected_at,created_by')
    .eq('plot_id', plotId).order('stage_number').order('attempt', { ascending: false });
  if (error) throw error;
  const inspections = (data ?? []) as InspectionRecord[];
  const answers: ChecklistAnswerRecord[] = [];
  // Keep each response below Supabase's default 1,000-row limit.
  for (let i = 0; i < inspections.length; i += 10) {
    const { data: rows, error: answerError } = await supabase.from('qa_check_answers')
      .select('inspection_id,check_number,check_text,result,notes')
      .in('inspection_id', inspections.slice(i, i + 10).map((record) => record.id));
    if (answerError) throw answerError;
    answers.push(...((rows ?? []) as ChecklistAnswerRecord[]));
  }
  return { inspections, answers };
}

export default function InspectionsScreen() {
  const { plotId } = useLocalSearchParams<{ plotId?: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [heading, setHeading] = useState('');
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [historyAnswers, setHistoryAnswers] = useState<ChecklistAnswerRecord[]>([]);
  const [canInspect, setCanInspect] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stage, setStage] = useState<StageNumber | null>(null);
  const [answers, setAnswers] = useState<Record<number, DraftAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setHeading('');
    setCanInspect(false);
    setInspections([]);
    setHistoryAnswers([]);
    setExpanded(null);
    setStage(null);
    if (!plotId || !session?.user.id) {
      setError('Select a plot from Developments & plots.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data: plot, error: plotError } = await supabase.from('plots')
          .select('id,project_id,plot_number').eq('id', plotId).maybeSingle();
        if (plotError || !plot) throw new Error('Plot not available');
        const { data: project, error: projectError } = await supabase.from('projects')
          .select('id,organisation_id,name').eq('id', plot.project_id).maybeSingle();
        if (projectError || !project) throw new Error('Development not available');
        const [member, history] = await Promise.all([
          supabase.from('organisation_members').select('role')
            .eq('organisation_id', project.organisation_id)
            .eq('user_id', session.user.id).eq('active', true).maybeSingle(),
          fetchHistory(plot.id),
        ]);
        if (member.error) throw member.error;
        if (!active) return;
        setHeading(project.name + ' · Plot ' + plot.plot_number);
        setCanInspect(canRecordInspection(member.data?.role));
        setInspections(history.inspections);
        setHistoryAnswers(history.answers);
      } catch {
        if (active) setError('Unable to load inspections. Check permissions and database setup.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [plotId, session?.user.id]);

  function updateAnswer(number: number, change: Partial<DraftAnswer>) {
    setAnswers((previous) => ({
      ...previous,
      [number]: { ...(previous[number] ?? { result: null, notes: '' }), ...change },
    }));
  }

  async function submit() {
    if (!plotId || stage === null || !canInspect || saving) return;
    const checks = QA_STAGE_TEMPLATES[stage].checks;
    if (checks.some((_, i) => !answers[i + 1]?.result)) {
      setError('Every checklist item needs Pass, Fail or N/A.');
      return;
    }
    let validated;
    try {
      validated = validateCheckAnswers(checks, checks.map((_, i) => ({
        check_number: i + 1,
        result: answers[i + 1].result as CheckResult,
        notes: answers[i + 1].notes,
      })));
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Invalid checklist.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.rpc('qa_submit_stage_checklist', {
      p_plot_id: plotId,
      p_stage_number: stage,
      p_answers: validated.map(({ check_number, result, notes }) => ({ check_number, result, notes })),
    });
    if (saveError) {
      setError('Checklist could not be saved. Check that all QA migrations are installed and your role is authorised.');
      setSaving(false);
      return;
    }
    try {
      const refreshed = await fetchHistory(plotId);
      setInspections(refreshed.inspections);
      setHistoryAnswers(refreshed.answers);
      setStage(null);
      setAnswers({});
      setExpanded(null);
    } catch {
      setStage(null);
      setError('Saved, but history could not refresh. Reopen this plot to confirm.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.screen} contentContainerStyle={{
      paddingHorizontal: 18, paddingTop: Math.max(insets.top, 24) + 12,
      paddingBottom: Math.max(insets.bottom, 24) + 12,
    }}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.link}>← Developments & plots</Text></Pressable>
      <Text style={styles.title}>Karllee QA · 12 stages</Text>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.hint}>Reference checks from QA Folder Rev A. Photographs can be attached to recorded inspection attempts; certificates and signatures are not yet captured. Older stage-only records do not prove individual checks passed.</Text>
      {plotId ? <Pressable accessibilityRole="button" onPress={() => router.push({
        pathname: '/snags', params: { plotId },
      })}><Text style={styles.link}>View snag register →</Text></Pressable> : null}
      {loading ? <ActivityIndicator color="#163A5F" /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!loading && !canInspect ? <Text style={styles.hint}>Read-only: your role cannot submit inspections.</Text> : null}
      {!loading && heading && STAGE_NUMBERS.map((number) => {
        const latest = latestAttempt(inspections, number);
        const history = stageAttemptHistory(inspections, number);
        return (
          <View key={number} style={styles.card}>
            <Text style={styles.stage}>Stage {number}: {QA_STAGE_TEMPLATES[number].title}</Text>
            <Text style={styles.hint}>{latest ? 'Latest: ' + inspectionResultLabel(latest.result) + ' · attempt ' + latest.attempt : 'Not inspected'}</Text>
            {history.map((record) => {
              const itemAnswers = inspectionAnswers(historyAnswers, record.id);
              const open = expanded === record.id;
              return (
                <View key={record.id} style={styles.history}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
                    onPress={() => setExpanded(open ? null : record.id)}>
                    <Text style={styles.link}>Attempt #{record.attempt} · {inspectionResultLabel(record.result)} · {record.inspected_at ? new Date(record.inspected_at).toLocaleDateString('en-GB') : 'Date unavailable'} {open ? '▲' : '▼'}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => router.push({
                    pathname: '/evidence', params: { inspectionId: record.id },
                  })}>
                    <Text style={styles.link}>View / add photo evidence →</Text>
                  </Pressable>
                  {open ? itemAnswers.length ? itemAnswers.map((answer) => (
                    <View key={answer.check_number} style={styles.check}>
                      <Text>{answer.check_number}. {answer.check_text}</Text>
                      <Text style={answer.result === 'fail' ? styles.error : styles.hint}>{inspectionResultLabel(answer.result)}</Text>
                      {answer.notes ? <Text>{answer.notes}</Text> : null}
                    </View>
                  )) : <Text style={styles.hint}>No individual answers recorded. Do not infer that these checks passed.</Text> : null}
                </View>
              );
            })}
            {canInspect && stage !== number ? <Pressable accessibilityRole="button"
              onPress={() => { setStage(number); setAnswers({}); setError(''); }}>
              <Text style={styles.link}>{latest ? '+ Record re-inspection' : '+ Record inspection'}</Text>
            </Pressable> : null}
            {canInspect && stage === number ? (
              <View>
                {QA_STAGE_TEMPLATES[number].checks.map((check, index) => {
                  const checkNumber = index + 1;
                  const current = answers[checkNumber];
                  return (
                    <View key={checkNumber} style={styles.check}>
                      <Text style={styles.label}>{checkNumber}. {check}</Text>
                      <View style={styles.options}>
                        {RESULTS.map((result) => <Pressable key={result} accessibilityRole="radio"
                          accessibilityState={{ checked: current?.result === result }}
                          style={[styles.option, current?.result === result ? styles.selected : null]}
                          onPress={() => updateAnswer(checkNumber, { result })}>
                          <Text>{inspectionResultLabel(result)}</Text>
                        </Pressable>)}
                      </View>
                      <TextInput multiline style={styles.input} maxLength={4000}
                        placeholder={current?.result === 'fail' ? 'Describe defect (required)' : 'Optional notes'}
                        value={current?.notes ?? ''}
                        onChangeText={(notes) => updateAnswer(checkNumber, { notes })} />
                    </View>
                  );
                })}
                <Pressable accessibilityRole="button" disabled={saving} style={styles.save}
                  onPress={() => void submit()}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Submit complete checklist'}</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={saving}
                  onPress={() => { setStage(null); setAnswers({}); setError(''); }}>
                  <Text style={styles.link}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF3F7' },
  title: { color: '#163A5F', fontSize: 26, fontWeight: '800', marginTop: 18 },
  heading: { color: '#203A50', fontWeight: '700', marginTop: 8 },
  hint: { color: '#556879', fontSize: 13, lineHeight: 19, marginTop: 7 },
  link: { color: '#1B5F8C', fontWeight: '700', marginTop: 12 },
  error: { color: '#B42318', marginTop: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginTop: 14 },
  stage: { color: '#163A5F', fontSize: 17, fontWeight: '700' },
  history: { borderTopWidth: 1, borderTopColor: '#E5EBF1', marginTop: 10, paddingTop: 8 },
  check: { borderTopWidth: 1, borderTopColor: '#E5EBF1', paddingTop: 12, marginTop: 12 },
  label: { color: '#203A50', fontWeight: '700' },
  options: { flexDirection: 'row', gap: 8, marginTop: 8 },
  option: { borderWidth: 1, borderColor: '#BDCBD7', padding: 10, borderRadius: 8 },
  selected: { backgroundColor: '#DCE9F4', borderColor: '#163A5F' },
  input: { minHeight: 54, borderWidth: 1, borderColor: '#BDCBD7', borderRadius: 8, marginTop: 8, padding: 10, textAlignVertical: 'top' },
  save: { backgroundColor: '#163A5F', borderRadius: 8, padding: 14, marginTop: 14 },
  saveText: { color: '#FFF', fontWeight: '700' },
});
