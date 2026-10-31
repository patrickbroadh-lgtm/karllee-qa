import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/providers/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { canRecordInspection } from '../../src/lib/inspection-helpers';
import { preparePhotoUpload } from '../../src/lib/evidence-upload';

const BUCKET = 'qa-evidence';
type EvidenceItem = { name: string; id: string | null; created_at: string | null };

async function listEvidence(organisationId: string, inspectionId: string): Promise<EvidenceItem[]> {
  const prefix = `${organisationId}/${inspectionId}`;
  const items: EvidenceItem[] = [];
  // Storage returns a limited page. Paginate so old evidence is never hidden.
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 100, offset, sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) throw error;
    const page = (data ?? []).filter((item) => item.name && item.id);
    items.push(...page.map((item) => ({
      name: item.name, id: item.id ?? null, created_at: item.created_at ?? null,
    })));
    if (!data || data.length < 100) break;
  }
  return items;
}

export default function EvidenceScreen() {
  const { inspectionId } = useLocalSearchParams<{ inspectionId?: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [organisationId, setOrganisationId] = useState('');
  const [heading, setHeading] = useState('');
  const [canUpload, setCanUpload] = useState(false);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setOrganisationId('');
    setCanUpload(false);
    setItems([]);
    if (!inspectionId || !session?.user.id) {
      setError('Open evidence from a recorded inspection.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data: inspection, error: inspectionError } = await supabase.from('qa_inspections')
          .select('id,plot_id,stage_number,attempt').eq('id', inspectionId).maybeSingle();
        if (inspectionError || !inspection) throw new Error('Inspection not available');
        const { data: plot, error: plotError } = await supabase.from('plots')
          .select('id,project_id,plot_number').eq('id', inspection.plot_id).maybeSingle();
        if (plotError || !plot) throw new Error('Plot not available');
        const { data: project, error: projectError } = await supabase.from('projects')
          .select('id,organisation_id,name').eq('id', plot.project_id).maybeSingle();
        if (projectError || !project) throw new Error('Development not available');
        const { data: member, error: memberError } = await supabase.from('organisation_members')
          .select('role').eq('organisation_id', project.organisation_id)
          .eq('user_id', session.user.id).eq('active', true).maybeSingle();
        if (memberError || !member) throw new Error('Not an active organisation member');
        const files = await listEvidence(project.organisation_id, inspectionId);
        if (!active) return;
        setOrganisationId(project.organisation_id);
        setCanUpload(canRecordInspection(member.role));
        setHeading(`${project.name} · Plot ${plot.plot_number} · Stage ${inspection.stage_number} · Attempt ${inspection.attempt}`);
        setItems(files);
      } catch {
        if (active) setError('Unable to load evidence. Check access and Storage migration setup.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [inspectionId, session?.user.id]);

  async function pickAndUpload(source: 'camera' | 'library') {
    if (!inspectionId || !organisationId || !canUpload || uploading) return;
    setError('');
    setNotice('');
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Camera permission is needed to take an evidence photograph.');
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, selectionLimit: 1 });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      const file = new File(asset.uri);
      const prepared = preparePhotoUpload({
        asset, sizeBytes: file.size, organisationId, inspectionId, fileId: Crypto.randomUUID(),
      });
      setUploading(true);
      const bytes = await file.arrayBuffer();
      if (bytes.byteLength !== prepared.sizeBytes) {
        throw new Error('Photograph changed while being read. Please select it again.');
      }
      const { error: uploadError } = await supabase.storage.from(BUCKET)
        .upload(prepared.path, bytes, { contentType: prepared.contentType, upsert: false });
      if (uploadError) throw uploadError;
      setNotice('Evidence uploaded. The original inspection record remains unchanged.');
      try {
        setItems(await listEvidence(organisationId, inspectionId));
      } catch {
        setNotice('Upload succeeded, but the evidence list could not refresh. Reopen to confirm.');
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Evidence upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function openEvidence(name: string) {
    if (!organisationId || !inspectionId) return;
    setError('');
    try {
      // Short-lived private link; never make the bucket public.
      const path = `${organisationId}/${inspectionId}/${name}`;
      const { data, error: signedError } = await supabase.storage.from(BUCKET)
        .createSignedUrl(path, 60);
      if (signedError || !data?.signedUrl) throw signedError ?? new Error('Unable to open evidence');
      await Linking.openURL(data.signedUrl);
    } catch {
      setError('Unable to open evidence. Check your membership and connection.');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{
      paddingHorizontal: 18, paddingTop: Math.max(insets.top, 24) + 12,
      paddingBottom: Math.max(insets.bottom, 24) + 12,
    }}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={styles.link}>← Back to inspection</Text>
      </Pressable>
      <Text style={styles.title}>Inspection evidence</Text>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.hint}>Photographs are stored privately against this specific inspection attempt. Evidence cannot be overwritten or deleted by app users. Do not photograph personal information unnecessarily.</Text>
      {loading ? <ActivityIndicator color="#163A5F" /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      {!loading && organisationId && canUpload ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={uploading} style={styles.button}
            onPress={() => void pickAndUpload('camera')}>
            <Text style={styles.buttonText}>{uploading ? 'Uploading…' : 'Take photo'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={uploading} style={styles.button}
            onPress={() => void pickAndUpload('library')}>
            <Text style={styles.buttonText}>Choose photo</Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && organisationId && !canUpload ? <Text style={styles.hint}>Read-only: your role cannot upload evidence.</Text> : null}
      {!loading && organisationId ? (
        <View style={styles.card}>
          <Text style={styles.section}>Stored evidence ({items.length})</Text>
          {items.length === 0 ? <Text style={styles.hint}>No evidence uploaded for this inspection.</Text> : null}
          {items.map((item) => (
            <Pressable key={item.id ?? item.name} accessibilityRole="button" style={styles.item}
              onPress={() => void openEvidence(item.name)}>
              <Text style={styles.link}>{item.name}</Text>
              <Text style={styles.hint}>{item.created_at ? new Date(item.created_at).toLocaleString('en-GB') : 'Date unavailable'} · View privately</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={styles.hint}>Maximum 20 MB per file. JPEG, PNG and HEIC photos only in this screen; PDF certificates will follow. Upload requires the staging-tested Storage policies before live use.</Text>
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
  notice: { color: '#087443', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  button: { flex: 1, backgroundColor: '#163A5F', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#FFF', fontWeight: '700' },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginTop: 18 },
  section: { color: '#163A5F', fontWeight: '700', fontSize: 17 },
  item: { borderTopWidth: 1, borderTopColor: '#E5EBF1', paddingVertical: 10 },
});
