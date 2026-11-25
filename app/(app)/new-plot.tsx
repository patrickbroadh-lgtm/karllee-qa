import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/providers/AuthProvider';

type Project = { id: string; organisation_id: string; name: string };

export default function NewPlotScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [project, setProject] = useState<Project | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [number, setNumber] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProject(null);
    setCanManage(false);
    if (!projectId || !session?.user.id) {
      setError('No development selected.');
      setLoading(false);
      return;
    }
    void (async () => {
      const { data: found, error: projectError } = await supabase.from('projects')
        .select('id,organisation_id,name').eq('id', projectId).maybeSingle();
      if (!active) return;
      if (projectError || !found) {
        setError('Development not found or access denied.');
        setLoading(false);
        return;
      }
      const { data: membership, error: memberError } = await supabase.from('organisation_members')
        .select('organisation_id').eq('organisation_id', found.organisation_id)
        .eq('user_id', session.user.id).eq('active', true)
        .in('role', ['director', 'admin', 'site_manager']).maybeSingle();
      if (!active) return;
      if (memberError) setError('Could not verify your permissions.');
      setProject(found as Project);
      setCanManage(!!membership && !memberError);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [projectId, session?.user.id]);

  async function save() {
    const plotNumber = number.trim();
    if (!project || !canManage) {
      setError('Your account cannot create plots on this development.');
      return;
    }
    if (!plotNumber || plotNumber.length > 50) {
      setError('Enter a plot number of up to 50 characters.');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('plots').insert({
      project_id: project.id,
      plot_number: plotNumber,
      description: description.trim() || null,
      status: 'not_started',
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.code === '23505' ? 'This plot number already exists on the development.'
        : 'Could not create plot. Check your permissions and database setup.');
      return;
    }
    router.replace('/projects');
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.screen} contentContainerStyle={{
      paddingTop: Math.max(insets.top, 24) + 12,
      paddingBottom: Math.max(insets.bottom, 24),
      paddingHorizontal: 20,
    }}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={styles.link}>← Developments</Text>
      </Pressable>
      <Text style={styles.title}>New plot</Text>
      {loading ? <ActivityIndicator color="#163A5F" /> : null}
      {project ? <Text style={styles.hint}>{project.name}</Text> : null}
      {!loading && !canManage ? <Text style={styles.hint}>You do not have management access to this development.</Text> : null}
      {!loading && canManage ? (
        <>
          <Text style={styles.label}>Plot number *</Text>
          <TextInput style={styles.input} value={number} onChangeText={setNumber}
            maxLength={50} placeholder="e.g. 1" />
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput style={styles.input} value={description} onChangeText={setDescription}
            maxLength={500} placeholder="e.g. Three-bedroom detached" />
          <Text style={styles.hint}>New plots start in not-started status.</Text>
          <Pressable accessibilityRole="button" disabled={saving} style={styles.button}
            onPress={() => void save()}>
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Create plot'}</Text>
          </Pressable>
        </>
      ) : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF3F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#163A5F', marginTop: 20, marginBottom: 12 },
  hint: { fontSize: 14, color: '#556879', lineHeight: 21, marginBottom: 14 },
  link: { fontWeight: '700', color: '#1B5F8C' },
  label: { color: '#203A50', fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#BDCBD7', backgroundColor: '#FFF',
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, fontSize: 15 },
  button: { backgroundColor: '#163A5F', padding: 14, borderRadius: 9, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFF', fontWeight: '700' },
  error: { color: '#B42318', marginTop: 16, lineHeight: 20 },
});
