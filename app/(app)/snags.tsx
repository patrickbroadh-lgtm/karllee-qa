import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import { canManageSnag, SNAG_STATUSES, snagStatusLabel, type SnagStatus } from '../../src/lib/snag-helpers';

type Snag = {
  id: string;
  inspection_id: string;
  title: string;
  description: string;
  status: SnagStatus;
};
type SnagEvent = {
  snag_id: string;
  previous_status: SnagStatus;
  new_status: SnagStatus;
  changed_at: string;
};

export default function SnagsScreen() {
  const { plotId } = useLocalSearchParams<{ plotId?: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [heading, setHeading] = useState('Snag register');
  const [snags, setSnags] = useState<Snag[]>([]);
  const [events, setEvents] = useState<SnagEvent[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSnags([]);
    setEvents([]);
    setCanManage(false);
    if (!plotId || !session?.user.id) {
      setError('Select a plot from the developments screen.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data: plot, error: plotError } = await supabase.from('plots')
          .select('id,project_id,plot_number').eq('id', plotId).maybeSingle();
        if (plotError || !plot) throw new Error('Plot unavailable');
        const { data: project, error: projectError } = await supabase.from('projects')
          .select('id,organisation_id,name').eq('id', plot.project_id).maybeSingle();
        if (projectError || !project) throw new Error('Development unavailable');
        const [member, inspectionQuery] = await Promise.all([
          supabase.from('organisation_members').select('role')
            .eq('organisation_id', project.organisation_id)
            .eq('user_id', session.user.id).eq('active', true).maybeSingle(),
          supabase.from('qa_inspections').select('id').eq('plot_id', plot.id),
        ]);
        if (member.error || inspectionQuery.error) throw new Error('Access denied');
        const ids = (inspectionQuery.data ?? []).map((item) => item.id);
        const snagRows: Snag[] = [];
        const eventRows: SnagEvent[] = [];
        // Limit IN-query sizes and avoid the default PostgREST row cap.
        for (let i = 0; i < ids.length; i += 100) {
          const { data, error: snagError } = await supabase.from('qa_snags')
            .select('id,inspection_id,title,description,status')
            .in('inspection_id', ids.slice(i, i + 100));
          if (snagError) throw snagError;
          snagRows.push(...((data ?? []) as Snag[]));
        }
        for (let i = 0; i < snagRows.length; i += 100) {
          const { data, error: eventError } = await supabase.from('qa_snag_events')
            .select('snag_id,previous_status,new_status,changed_at')
            .in('snag_id', snagRows.slice(i, i + 100).map((item) => item.id))
            .order('changed_at', { ascending: false });
          if (eventError) throw eventError;
          eventRows.push(...((data ?? []) as SnagEvent[]));
        }
        if (!active) return;
        setHeading(project.name + ' · Plot ' + plot.plot_number + ' · Snags');
        setSnags(snagRows);
        setEvents(eventRows);
        setCanManage(canManageSnag(member.data?.role));
      } catch {
        if (active) setError('Unable to load snags. Confirm permissions and the snag database migration.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [plotId, session?.user.id]);

  async function updateStatus(snag: Snag, status: SnagStatus) {
    if (!canManage || savingId !== null || snag.status === status) return;
    setSavingId(snag.id);
    setError('');
    try {
      const { data, error: updateError } = await supabase.from('qa_snags')
        .update({ status }).eq('id', snag.id).eq('status', snag.status)
        .select('id,status').maybeSingle();
      if (updateError || !data) throw new Error('Update failed or status changed elsewhere');
      const { data: history, error: historyError } = await supabase.from('qa_snag_events')
        .select('snag_id,previous_status,new_status,changed_at')
        .eq('snag_id', snag.id).order('changed_at', { ascending: false });
      setSnags((current) => current.map((item) => item.id === snag.id ? { ...item, status } : item));
      if (historyError) throw historyError;
      setEvents((current) => [
        ...((history ?? []) as SnagEvent[]),
        ...current.filter((item) => item.snag_id !== snag.id),
      ]);
    } catch {
      setError('Status may have changed. Reopen the register to confirm before retrying.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{
      paddingTop: Math.max(insets.top, 24) + 12,
      paddingBottom: Math.max(insets.bottom, 24) + 12, paddingHorizontal: 20,
    }}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={styles.link}>← Developments & plots</Text>
      </Pressable>
      <Text style={styles.title}>{heading}</Text>
      <Text style={styles.hint}>Failed inspections generate a snag after the database migration is installed. Original inspection evidence is retained.</Text>
      {loading ? <ActivityIndicator color="#163A5F" /> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {!loading && snags.length === 0 && !error ? <Text style={styles.hint}>No snags recorded for this plot.</Text> : null}
      {snags.map((snag) => {
        const lastEvent = events.find((event) => event.snag_id === snag.id);
        return (
          <View style={styles.card} key={snag.id}>
            <Text style={styles.name}>{snag.title}</Text>
            <Text style={styles.description}>{snag.description}</Text>
            <Text style={styles.status}>Status: {snagStatusLabel(snag.status)}</Text>
            {lastEvent ? <Text style={styles.hint}>
              Last change: {snagStatusLabel(lastEvent.previous_status)} → {snagStatusLabel(lastEvent.new_status)}
              {' · '}{new Date(lastEvent.changed_at).toLocaleDateString('en-GB')}
            </Text> : null}
            {canManage ? (
              <View style={styles.actions}>
                {SNAG_STATUSES.map((status) => (
                  <Pressable key={status} accessibilityRole="button"
                    accessibilityState={{ disabled: savingId !== null, selected: snag.status === status }}
                    disabled={savingId !== null || snag.status === status}
                    style={[styles.option, snag.status === status ? styles.selected : null]}
                    onPress={() => void updateStatus(snag, status)}>
                    <Text style={styles.link}>{snagStatusLabel(status)}</Text>
                  </Pressable>
                ))}
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
  hint: { color: '#556879', lineHeight: 20, marginTop: 8 },
  link: { color: '#1B5F8C', fontWeight: '700', marginTop: 8 },
  error: { color: '#B42318', lineHeight: 20, marginTop: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, marginTop: 12 },
  name: { color: '#163A5F', fontWeight: '700', fontSize: 17, marginBottom: 8 },
  description: { color: '#203A50', lineHeight: 21, marginBottom: 10 },
  status: { color: '#163A5F', fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  option: { borderWidth: 1, borderColor: '#BDCBD7', borderRadius: 8, padding: 10 },
  selected: { backgroundColor: '#DCE9F4', borderColor: '#163A5F' },
});
