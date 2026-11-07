import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/providers/AuthProvider';

type Membership = {
  organisation_id: string;
  organisations: { name: string } | { name: string }[] | null;
};

function displayName(org: Membership['organisations']): string {
  return (Array.isArray(org) ? org[0]?.name : org?.name) ?? 'Unnamed organisation';
}

export default function NewProjectScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [organisationId, setOrganisationId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!session?.user.id) {
      setLoading(false);
      return;
    }
    void supabase.from('organisation_members')
      .select('organisation_id,organisations(name)')
      .eq('user_id', session.user.id).eq('active', true)
      .in('role', ['director', 'admin', 'site_manager'])
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError('Could not verify your organisation permissions.');
        const allowed = (data ?? []) as unknown as Membership[];
        setMemberships(allowed);
        setOrganisationId(allowed[0]?.organisation_id ?? '');
        setLoading(false);
      });
    return () => { active = false; };
  }, [session?.user.id]);

  async function save() {
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!memberships.some((membership) => membership.organisation_id === organisationId)) {
      setError('Choose an organisation you are authorised to manage.');
      return;
    }
    if (!trimmedName || trimmedName.length > 200 || trimmedCode.length > 50) {
      setError('Enter a name (up to 200 characters) and an optional code (up to 50).');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('projects').insert({
      organisation_id: organisationId,
      name: trimmedName,
      code: trimmedCode || null,
      status: 'planning',
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.code === '23505'
        ? 'That project code is already in use for this organisation.'
        : 'Could not create development. Check database setup and permissions.');
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
      <Text style={styles.title}>New development</Text>
      <Text style={styles.hint}>Create a live project record. Only authorised managers can save.</Text>
      {loading ? <ActivityIndicator color="#163A5F" /> : null}
      {!loading && memberships.length === 0 ? (
        <Text style={styles.hint}>No active management permissions found for your account.</Text>
      ) : null}
      {memberships.map((membership) => (
        <Pressable key={membership.organisation_id} accessibilityRole="radio"
          accessibilityState={{ checked: organisationId === membership.organisation_id }}
          style={styles.choice} onPress={() => setOrganisationId(membership.organisation_id)}>
          <Text style={styles.label}>
            {organisationId === membership.organisation_id ? '● ' : '○ '}
            {displayName(membership.organisations)}
          </Text>
        </Pressable>
      ))}
      {memberships.length > 0 ? (
        <>
          <Text style={styles.label}>Development name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            maxLength={200} placeholder="e.g. Lynsted Meadows" autoCapitalize="words" />
          <Text style={styles.label}>Reference code (optional)</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode}
            maxLength={50} placeholder="e.g. TYN-01" autoCapitalize="characters" />
          <Text style={styles.hint}>New developments start in planning status.</Text>
          <Pressable accessibilityRole="button" disabled={saving} style={styles.button}
            onPress={() => void save()}>
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Create development'}</Text>
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
  choice: { paddingVertical: 7 },
  input: { borderWidth: 1, borderColor: '#BDCBD7', backgroundColor: '#FFF',
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, fontSize: 15 },
  button: { backgroundColor: '#163A5F', padding: 14, borderRadius: 9, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFF', fontWeight: '700' },
  error: { color: '#B42318', marginTop: 16, lineHeight: 20 },
});
