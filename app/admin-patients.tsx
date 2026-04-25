import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAdminPatients } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { User } from '@/types/api';

export default function AdminPatientsScreen() {
  const router = useRouter();
  const { user, token, isBusy } = useAuth();
  const [patients, setPatients] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const hasFetched = useRef(false);

  const fetchPatients = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setPatients(await getAdminPatients(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load patients.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        router.replace('/login');
        return;
      }
      if (user && user.role !== 'admin') {
        router.replace('/login');
        return;
      }
      if (!hasFetched.current) {
        hasFetched.current = true;
        fetchPatients();
      }
    }, [fetchPatients, router, token, user])
  );

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) => {
      const haystack = [
        patient.full_name,
        patient.email,
        patient.first_name,
        patient.middle_name,
        patient.last_name,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [patients, search]);

  if (!user && isBusy) return null;
  if (!user || user.role !== 'admin') return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Patients</Text>
            <Text style={styles.title}>All patient users</Text>
            <Text style={styles.copy}>Search and review every patient account in the clinic.</Text>
          </View>
          <Pressable style={styles.headerButton} onPress={() => router.push('/admin-dashboard')}>
            <Text style={styles.headerButtonText}>Dashboard</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search patients</Text>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email"
            placeholderTextColor="#8b8478"
          />
          <Text style={styles.meta}>{filteredPatients.length} patient(s) shown</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient list</Text>
          {loading ? <ActivityIndicator color="#0369a1" /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {filteredPatients.map((patient) => (
            <View key={patient.id} style={styles.itemCard}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemTitle}>{patient.full_name}</Text>
                <Text style={styles.itemCopy}>#{patient.id} | {patient.email}</Text>
                <Text style={styles.itemCopy}>Role: {patient.role}</Text>
                <Text style={styles.itemCopy}>Joined: {patient.created_at}</Text>
              </View>
            </View>
          ))}
          {!loading && !filteredPatients.length && !error ? (
            <Text style={styles.emptyCopy}>No patients found.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  container: { padding: 20, gap: 16 },
  header: { gap: 10 },
  backButton: { alignSelf: 'flex-start', backgroundColor: '#e0f2fe', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  backButtonText: { color: '#0369a1', fontWeight: '800', fontSize: 14 },
  headerText: { gap: 6 },
  headerButton: { alignSelf: 'flex-start', backgroundColor: '#e0f2fe', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  headerButtonText: { color: '#0369a1', fontWeight: '800' },
  kicker: { color: '#0369a1', textTransform: 'uppercase', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#0c2340', fontSize: 30, lineHeight: 34, fontWeight: '900' },
  copy: { color: '#4a7fa5', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
  cardTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  input: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340' },
  meta: { color: '#4a7fa5', fontWeight: '700' },
  itemCard: { backgroundColor: '#f0f9ff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e0f2fe' },
  itemLeft: { gap: 4 },
  itemTitle: { color: '#0c2340', fontWeight: '800', fontSize: 15 },
  itemCopy: { color: '#4a7fa5', fontSize: 13, lineHeight: 18 },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
  error: { color: '#b91c1c', fontWeight: '700' },
});
