import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/providers/AuthProvider';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const message = await signIn(email, password);
      if (message) setError(message);
    } catch {
      setError('Unable to connect. Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>KARLLEE CONSTRUCTION</Text>
          <Text style={styles.title}>Karllee QA</Text>
          <Text style={styles.subtitle}>Sign in to manage quality inspections and site records.</Text>

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.co.uk"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            editable={!busy}
            accessibilityLabel="Email address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            editable={!busy}
            accessibilityLabel="Password"
            onSubmitEditing={submit}
          />

          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
          <Text style={styles.help}>Accounts are created by your Karllee QA administrator.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF3F7' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 28 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, color: '#51708A', marginBottom: 10 },
  title: { fontSize: 32, fontWeight: '800', color: '#163A5F' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#556879', marginTop: 8, marginBottom: 30 },
  label: { fontSize: 14, fontWeight: '700', color: '#203A50', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#CBD7E1', borderRadius: 10, backgroundColor: '#FFFFFF', fontSize: 16, paddingHorizontal: 14, height: 50, marginBottom: 20, color: '#172C3D' },
  error: { color: '#B42318', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  button: { backgroundColor: '#163A5F', borderRadius: 10, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.7 },
  help: { fontSize: 12, color: '#6D7D8B', textAlign: 'center', marginTop: 22, lineHeight: 18 },
});
