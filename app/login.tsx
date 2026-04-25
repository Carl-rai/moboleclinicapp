import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Calendar, Eye, EyeOff, FlaskConical, Hospital, Lock, Mail, Stethoscope } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDashboardRoute } from '@/lib/navigation';
import { useAuth } from '@/providers/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { login, isBusy } = useAuth();

  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Please enter both your email and password.');
      return;
    }
    try {
      const user = await login(normalizedEmail, password);
      router.replace(getDashboardRoute(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to login.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroIconWrap}>
            <Hospital size={36} color="#ffffff" />
          </View>
          <Text style={styles.heroClinicName}>FilCare Clinic</Text>
          <Text style={styles.heroQuote}>"Your health is our highest priority — every visit, every day."</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroSub}>Trusted care. Compassionate doctors. Seamless appointments.</Text>
        </View>

        

        {/* Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSub}>Sign in to manage your appointments</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}><Mail size={12} color="#0369a1" /><Text style={styles.inputLabel}> Email address</Text></View>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#8fa8a4"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}><Lock size={12} color="#0369a1" /><Text style={styles.inputLabel}> Password</Text></View>
            <View style={styles.passwordWrap}>
              <TextInput
                secureTextEntry={!showPassword}
                placeholder="Enter your password"
                placeholderTextColor="#8fa8a4"
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                {showPassword ? <EyeOff size={18} color="#0369a1" /> : <Eye size={18} color="#0369a1" />}
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <View style={styles.alertRow}><AlertTriangle size={13} color="#b91c1c" /><Text style={styles.errorText}> {error}</Text></View>
            </View>
          ) : null}

          <Pressable style={[styles.primaryButton, isBusy && styles.primaryButtonDisabled]} onPress={handleLogin} disabled={isBusy}>
            {isBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In →</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>new patient?</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.secondaryButton} onPress={() => router.push('/signup')}>
            <Text style={styles.secondaryButtonText}>Create a Patient Account</Text>
          </Pressable>
        </View>

        {/* Bottom Quote */}
        <View style={styles.bottomQuote}>
          <Text style={styles.bottomQuoteText}>"A healthy outside starts from the inside."</Text>
          <Text style={styles.bottomQuoteAuthor}>— Robert Urich</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  container: { padding: 20, gap: 18, paddingBottom: 40 },

  heroBanner: {
    backgroundColor: '#0369a1',
    borderRadius: 28,
    padding: 26,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  heroIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 50,
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  inputLabelRow: { flexDirection: 'row', alignItems: 'center' },
  alertRow: { flexDirection: 'row', alignItems: 'center' },
  pill: { backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center' },
  heroClinicName: { color: '#ffffff', fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  heroQuote: { color: '#bae6fd', fontSize: 14, lineHeight: 22, textAlign: 'center', fontStyle: 'italic' },
  heroDivider: { width: 40, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  heroSub: { color: '#7dd3fc', fontSize: 12, textAlign: 'center', fontWeight: '600' },

  pillRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },

  pillText: { color: '#0369a1', fontWeight: '700', fontSize: 12 },

  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 22,
    gap: 14,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  formTitle: { color: '#0c2340', fontSize: 22, fontWeight: '900' },
  formSub: { color: '#4a7fa5', fontSize: 13, marginTop: -6 },

  inputGroup: { gap: 6 },
  inputLabel: { color: '#0369a1', fontSize: 12, fontWeight: '800' },
  input: {
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0c2340',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0c2340',
  },
  eyeButton: { paddingHorizontal: 14, paddingVertical: 14 },

  errorBox: { backgroundColor: '#fee2e2', borderRadius: 14, padding: 12 },
  errorText: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },

  primaryButton: {
    backgroundColor: '#0369a1',
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: { backgroundColor: '#7ab3cc' },
  primaryButtonText: { color: '#ffffff', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#bae6fd' },
  dividerText: { color: '#4a7fa5', fontSize: 12, fontWeight: '700' },

  secondaryButton: {
    backgroundColor: '#f0f9ff',
    borderRadius: 18,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0369a1',
  },
  secondaryButtonText: { color: '#0369a1', fontWeight: '800', fontSize: 15 },

  bottomQuote: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  bottomQuoteText: { color: '#4a7fa5', fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  bottomQuoteAuthor: { color: '#7ab3cc', fontSize: 11, fontWeight: '700' },
});
