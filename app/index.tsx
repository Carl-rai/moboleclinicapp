import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinearGradientLikeCard } from '@/components/linear-gradient-like-card';

export default function LandingScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobBottom} />
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Filcare Clinic</Text>
          <Text style={styles.title}>Care starts with one clean sign in.</Text>
          <Text style={styles.subtitle}>
            Your health is our priority. Book your appointment here.
          </Text>
        </View>

        <LinearGradientLikeCard>
          <Text style={styles.cardTitle}>What this app supports</Text>
          <Text style={styles.cardCopy}>Admin overview and user monitoring</Text>
          <Text style={styles.cardCopy}>Doctor schedules and appointment tracking</Text>
          <Text style={styles.cardCopy}>Staff handling and coordination</Text>
          <Text style={styles.cardCopy}>Patient registration and follow-ups</Text>
        </LinearGradientLikeCard>

        <View style={styles.actions}>
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Login to dashboard</Text>
            </Pressable>
          </Link>
          <Link href="/signup" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Patient sign up</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, justifyContent: 'space-between' },
  hero: { gap: 14, marginTop: 24 },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: '#0369a1',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    overflow: 'hidden',
    fontWeight: '700',
  },
  title: { fontSize: 42, lineHeight: 46, color: '#0c2340', fontWeight: '900' },
  subtitle: { fontSize: 16, lineHeight: 25, color: '#4a7fa5', maxWidth: 520 },
  actions: { gap: 14 },
  primaryButton: {
    backgroundColor: '#0369a1',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#0369a1',
    borderWidth: 1.5,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#0369a1', fontSize: 16, fontWeight: '800' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#0c2340', marginBottom: 12 },
  cardCopy: { fontSize: 15, lineHeight: 24, color: '#4a7fa5', marginBottom: 4 },
  backgroundBlobTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: '#38bdf8',
    opacity: 0.15,
    top: -70,
    right: -40,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: '#0369a1',
    opacity: 0.1,
    bottom: -90,
    left: -80,
  },
});
