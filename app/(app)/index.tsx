import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/providers/AuthProvider';

type Membership = {
  organisation_id: string;
  role: string;
  organisations: { name: string } | { name: string }[] | null;
};

function organisationName(value: Membership['organisations']) {
  if (Array.isArray(value)) return value[0]?.name ?? 'Unnamed organisation';
  return value?.name ?? 'Unnamed organisation';
}

export default function DashboardScreen() {
  const { session, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!session?.user.id) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await supabase
          .from('organisation_members')
          .select('organisation_id, role, organisations(name)')
          .eq('user_id', session!.user.id)
          .eq('active', true)
          .order('created_at', { ascending: true });

        if (queryError) throw queryError;
        if (mounted) setMemberships((data ?? []) as unknown as Membership[]);
      } catch {
        if (mounted) setError('Could not load your organisation access. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [session?.user.id]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError('Sign out failed. Check your connection and try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, 24) + 16,
        paddingBottom: Math.max(insets.bottom, 24),
        paddingHorizontal: 20,
      }}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>KARLLEE CONSTRUCTION</Text>
          <Text style={styles.title}>QA Dashboard</Text>
        </View>
        <Pressable onPress={handleSignOut} disabled={signingOut} accessibilityRole="button" style={styles.signOut}>
          <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>
      </View>

      <Text style={styles.welcome}>Signed in as {session?.user.email ?? 'your account'}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your organisations</Text>
        {loading ? <ActivityIndicator color="#163A5F" /> : null}
        {!loading && memberships.length === 0 && !error ? (
          <Text style={styles.body}>Your account is not yet linked to an active organisation. Ask an administrator to assign your access.</Text>
        ) : null}
        {!loading && memberships.map((membership) => (
          <View key={membership.organisation_id} style={styles.orgRow}>
            <Text style={styles.orgName}>{organisationName(membership.organisations)}</Text>
            <Text style={styles.role}>{membership.role.replace(/_/g, ' ')}</Text>
          </View>
        ))}
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Projects & plots</Text>
        <Text style={styles.body}>The next release will add live developments, plots and inspection records. No sample projects are shown as real data.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>12-stage QA inspections</Text>
        <Text style={styles.body}>Inspection checklists, evidence photos and snagging will be connected after the projects database is ready.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF3F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, color: '#51708A' },
  title: { fontSize: 29, fontWeight: '800', color: '#163A5F', marginTop: 5 },
  welcome: { fontSize: 14, color: '#556879', marginTop: 12, marginBottom: 24 },
  signOut: { paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: '#C5D3DF', borderRadius: 8 },
  signOutText: { fontSize: 13, color: '#163A5F', fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#163A5F', marginBottom: 12 },
  body: { color: '#556879', lineHeight: 22, fontSize: 14 },
  orgRow: { borderTopWidth: 1, borderTopColor: '#EDF1F5', paddingVertical: 13 },
  orgName: { fontSize: 16, fontWeight: '700', color: '#203A50' },
  role: { fontSize: 13, color: '#51708A', textTransform: 'capitalize', marginTop: 4 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 20 },
});
