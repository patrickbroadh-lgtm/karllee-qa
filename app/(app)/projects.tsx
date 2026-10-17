import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import type { ProjectRecord, PlotRecord } from '../../src/lib/project-types';

export default function ProjectsScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [plotsLoading, setPlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!session?.user.id) return;
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase.from('projects')
      .select('id,organisation_id,name,code,status').order('name');
    if (queryError) setError('Unable to load developments. Confirm the new migration is installed.');
    else setProjects((data ?? []) as ProjectRecord[]);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, [session?.user.id]);

  useEffect(() => {
    setPlots([]);
    if (!selectedId) return;
    let active = true;
    setPlotsLoading(true);
    supabase.from('plots').select('id,project_id,plot_number,description,status')
      .eq('project_id', selectedId).order('plot_number')
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError('Unable to load plots.');
        else setPlots((data ?? []) as PlotRecord[]);
        setPlotsLoading(false);
      });
    return () => { active = false; };
  }, [selectedId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{
      paddingTop: Math.max(insets.top, 24) + 12,
      paddingBottom: Math.max(insets.bottom, 24),
      paddingHorizontal: 20,
    }}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.link}>← Dashboard</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void refresh()}>
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>Developments & plots</Text>
      <Text style={styles.description}>Live records, restricted to your organisation membership.</Text>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {loading ? <ActivityIndicator color="#163A5F" /> : null}
      {!loading && projects.length === 0 && !error ? (
        <Text style={styles.description}>No developments recorded yet. No demo data is displayed.</Text>
      ) : null}
      {!loading && projects.map((project) => (
        <View style={styles.card} key={project.id}>
          <Pressable accessibilityRole="button" onPress={() => setSelectedId(
            selectedId === project.id ? null : project.id,
          )}>
            <Text style={styles.projectName}>{project.name}</Text>
            <Text style={styles.description}>{project.code ? project.code + ' · ' : ''}{project.status.replace(/_/g, ' ')}</Text>
            <Text style={styles.link}>{selectedId === project.id ? 'Hide plots' : 'View plots'}</Text>
          </Pressable>
          {selectedId === project.id ? (
            <View style={styles.plots}>
              {plotsLoading ? <ActivityIndicator color="#163A5F" /> : null}
              {!plotsLoading && plots.length === 0 ? <Text style={styles.description}>No plots recorded.</Text> : null}
              {!plotsLoading && plots.map((plot) => (
                <View style={styles.plotRow} key={plot.id}>
                  <Text style={styles.plotName}>Plot {plot.plot_number}</Text>
                  <Text style={styles.description}>{plot.status.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF3F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  title: { color: '#163A5F', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  description: { color: '#556879', lineHeight: 21, fontSize: 14, marginBottom: 8 },
  link: { color: '#1B5F8C', fontWeight: '700', marginTop: 8 },
  error: { color: '#B42318', marginBottom: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, marginTop: 12 },
  projectName: { color: '#163A5F', fontSize: 18, fontWeight: '700' },
  plots: { borderTopWidth: 1, borderTopColor: '#E5EBF1', marginTop: 16, paddingTop: 10 },
  plotRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  plotName: { color: '#203A50', fontWeight: '700' },
});
