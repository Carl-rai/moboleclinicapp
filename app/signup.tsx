import { useRouter } from 'expo-router';
import { AlertTriangle, Bell, CheckCircle, ClipboardList, Calendar, Eye, EyeOff, Lock, Mail, ShieldCheck, Stethoscope } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth-context';

export default function SignupScreen() {
  const router = useRouter();
  const { requestSignupVerification, confirmSignupVerification, isBusy } = useAuth();

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    if (verificationSent) {
      setVerificationSent(false);
      setVerificationCode('');
      setSuccess('');
    }
  }

  async function handleSendCode() {
    setError('');
    setSuccess('');
    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const email = form.email.trim().toLowerCase();

    if (!firstName || !lastName || !email || !form.password || !form.confirm_password) {
      setError('Please complete all required fields.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await requestSignupVerification({ ...form, first_name: firstName, middle_name: form.middle_name.trim(), last_name: lastName, email });
      setVerificationSent(true);
      setSuccess('Verification code sent. Check your email and enter it below.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send verification code.');
    }
  }

  async function handleVerifyAndSignup() {
    setError('');
    setSuccess('');
    const email = form.email.trim().toLowerCase();
    if (!verificationCode.trim()) {
      setError('Please enter the verification code sent to your email.');
      return;
    }
    try {
      await confirmSignupVerification(email, verificationCode.trim());
      setSuccess('Email verified and account created! Redirecting to login...');
      router.replace({ pathname: '/login', params: { email } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify your email.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Stethoscope size={32} color="#ffffff" />
          </View>
          <Text style={styles.headerTitle}>Join FilCare</Text>
          <Text style={styles.headerQuote}>"The greatest wealth is health."</Text>
          </View>

        {/* Benefits Strip */}
        <View style={styles.benefitsRow}>
          <View style={styles.benefitItem}>
            <ClipboardList size={22} color="#0369a1" />
            <Text style={styles.benefitText}>Track Records</Text>
          </View>
          <View style={styles.benefitDot} />
          <View style={styles.benefitItem}>
            <Calendar size={22} color="#0369a1" />
            <Text style={styles.benefitText}>Book Appointment</Text>
          </View>
          <View style={styles.benefitDot} />
          <View style={styles.benefitItem}>
            <Bell size={22} color="#0369a1" />
            <Text style={styles.benefitText}>Get Notified</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create your account</Text>
          <Text style={styles.formSub}>Patient registration - free & secure</Text>

          <View style={styles.nameRow}>
            <TextInput
              placeholder="First name *"
              placeholderTextColor="#8fa8a4"
              style={[styles.input, styles.inputHalf]}
              value={form.first_name}
              onChangeText={(v) => updateField('first_name', v)}
            />
            <TextInput
              placeholder="Last name *"
              placeholderTextColor="#8fa8a4"
              style={[styles.input, styles.inputHalf]}
              value={form.last_name}
              onChangeText={(v) => updateField('last_name', v)}
            />
          </View>

          <TextInput
            placeholder="Middle name (optional)"
            placeholderTextColor="#8fa8a4"
            style={styles.input}
            value={form.middle_name}
            onChangeText={(v) => updateField('middle_name', v)}
          />

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}><Mail size={12} color="#0369a1" /><Text style={styles.inputLabel}> Email address *</Text></View>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#8fa8a4"
              style={styles.input}
              value={form.email}
              onChangeText={(v) => updateField('email', v)}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}><Lock size={12} color="#0369a1" /><Text style={styles.inputLabel}> Password *</Text></View>
            <View style={styles.passwordWrap}>
              <TextInput
                secureTextEntry={!showPassword}
                placeholder="Create a strong password"
                placeholderTextColor="#8fa8a4"
                style={styles.passwordInput}
                value={form.password}
                onChangeText={(v) => updateField('password', v)}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                {showPassword ? <EyeOff size={18} color="#0369a1" /> : <Eye size={18} color="#0369a1" />}
              </Pressable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}><Lock size={12} color="#0369a1" /><Text style={styles.inputLabel}> Confirm password *</Text></View>
            <View style={styles.passwordWrap}>
              <TextInput
                secureTextEntry={!showConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor="#8fa8a4"
                style={styles.passwordInput}
                value={form.confirm_password}
                onChangeText={(v) => updateField('confirm_password', v)}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowConfirmPassword((v) => !v)}>
                {showConfirmPassword ? <EyeOff size={18} color="#0369a1" /> : <Eye size={18} color="#0369a1" />}
              </Pressable>
            </View>
          </View>

          {verificationSent ? (
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}><Mail size={12} color="#0369a1" /><Text style={styles.inputLabel}> Verification code *</Text></View>
              <TextInput
                keyboardType="number-pad"
                placeholder="Enter the 6-digit code"
                placeholderTextColor="#8fa8a4"
                style={styles.input}
                value={verificationCode}
                onChangeText={setVerificationCode}
              />
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <View style={styles.alertRow}><AlertTriangle size={13} color="#b91c1c" /><Text style={styles.errorText}> {error}</Text></View>
            </View>
          ) : null}
          {success ? (
            <View style={styles.successBox}>
              <View style={styles.alertRow}><CheckCircle size={13} color="#166534" /><Text style={styles.successText}> {success}</Text></View>
            </View>
          ) : null}

          <Pressable style={[styles.primaryButton, isBusy && styles.primaryButtonDisabled]} onPress={verificationSent ? handleVerifyAndSignup : handleSendCode} disabled={isBusy}>
            {isBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{verificationSent ? 'Verify Email & Create Account' : 'Send Verification Code'}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace('/login')}>
            <Text style={styles.loginLink}>Already have an account? Sign in here.</Text>
          </Pressable>
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <ShieldCheck size={18} color="#0369a1" />
          <Text style={styles.privacyText}>Your personal information is encrypted and never shared without your consent.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  container: { padding: 20, gap: 18, paddingBottom: 40 },

  header: {
    backgroundColor: '#0369a1',
    borderRadius: 28,
    padding: 26,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  headerIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 50,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  inputLabelRow: { flexDirection: 'row', alignItems: 'center' },
  alertRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  headerQuote: { color: '#bae6fd', fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  headerQuoteAuthor: { color: '#7dd3fc', fontSize: 11, fontWeight: '700' },

  benefitsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  benefitItem: { alignItems: 'center', gap: 4 },
  benefitIcon: { fontSize: 22 },
  benefitText: { color: '#0369a1', fontWeight: '700', fontSize: 11 },
  benefitDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#bae6fd' },

  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 22,
    gap: 12,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  formTitle: { color: '#0c2340', fontSize: 20, fontWeight: '900' },
  formSub: { color: '#4a7fa5', fontSize: 13, marginTop: -4 },

  nameRow: { flexDirection: 'row', gap: 10 },
  inputHalf: { flex: 1 },
  inputGroup: { gap: 5 },
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
  successBox: { backgroundColor: '#dcfce7', borderRadius: 14, padding: 12 },
  successText: { color: '#166534', fontWeight: '700', fontSize: 13 },

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
  primaryButtonText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },

  loginLink: { color: '#0369a1', fontWeight: '700', textAlign: 'center', fontSize: 14 },

  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    padding: 14,
  },

  privacyText: { color: '#0369a1', fontSize: 12, lineHeight: 18, flex: 1 },
});
