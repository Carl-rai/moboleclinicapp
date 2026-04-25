import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getStaffDoctorSchedules } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { ScheduleItem } from '@/types/api';

function formatTimeDisplay(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatPayDisplay(pay: string | number | null | undefined): string {
  const amount = Number(pay ?? 0);
  return `PHP ${amount.toFixed(2)}`;
}

export default function StaffScheduleScreen() {
  const router = useRouter();
  const { user, token, isBusy } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const filteredSchedules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return schedules;
    return schedules.filter((schedule) => {
      const haystack = [
        schedule.date,
        schedule.start_time,
        schedule.end_time,
        schedule.appointment_pay,
        schedule.is_available ? 'available' : 'unavailable',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [schedules, search]);

  useFocusEffect(
    useCallback(() => {
      if (!token) { router.replace('/login'); return; }
      if (user && user.role !== 'staff') { router.replace('/login'); return; }
      fetchSchedules();
    }, [token, user])
  );

  async function fetchSchedules() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setSchedules(await getStaffDoctorSchedules(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load schedules.');
    } finally {
      setLoading(false);
    }
  }

  if (!user && isBusy) return null;
  if (!user || user.role !== 'staff') return null;

  const doctorName = schedules[0]?.doctor?.user?.full_name ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Doctor Schedule</Text>
            <Text style={styles.title}>
              {doctorName ? `Dr. ${doctorName}` : 'Assigned Doctor'}
            </Text>
            <Text style={styles.copy}>View your assigned doctor&apos;s clinic schedule.</Text>
          </View>
          <Pressable style={styles.headerButton} onPress={() => router.push('/staff-dashboard')}>
            <Text style={styles.headerButtonText}>Dashboard</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search schedules</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by date, time, or availability"
            placeholderTextColor="#8b8478"
            value={search}
            onChangeText={setSearch}
          />
          <Text style={styles.emptyCopy}>{filteredSchedules.length} schedule(s) shown</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedules</Text>
          {loading ? <ActivityIndicator color="#0369a1" /> : null}
          {filteredSchedules.map((s) => (
            <View key={s.id} style={styles.itemCard}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemTitle}>{s.date}</Text>
                <Text style={styles.itemCopy}>{formatTimeDisplay(s.start_time.slice(0, 5))} — {formatTimeDisplay(s.end_time.slice(0, 5))}</Text>
                <Text style={styles.itemCopy}>{formatPayDisplay(s.appointment_pay)}</Text>
              </View>
              <View style={[styles.badge, s.is_available ? styles.badgeAvailable : styles.badgeUnavailable]}>
                <Text style={styles.badgeText}>{s.is_available ? 'Available' : 'Unavailable'}</Text>
              </View>
            </View>
          ))}
          {!loading && !filteredSchedules.length ? (
            <Text style={styles.emptyCopy}>
              {doctorName === null ? 'No doctor assigned yet.' : 'No schedules match your search.'}
            </Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 6 },
  headerButton: { backgroundColor: '#e0f2fe', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  headerButtonText: { color: '#0369a1', fontWeight: '800' },
  kicker: { color: '#0369a1', textTransform: 'uppercase', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#0c2340', fontSize: 28, lineHeight: 32, fontWeight: '900' },
  copy: { color: '#4a7fa5', fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
  cardTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  searchInput: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340' },
  itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, backgroundColor: '#f0f9ff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e0f2fe' },
  itemLeft: { flex: 1, gap: 4 },
  itemTitle: { color: '#0c2340', fontWeight: '800', fontSize: 15 },
  itemCopy: { color: '#4a7fa5', fontSize: 13 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeAvailable: { backgroundColor: '#dbeafe' },
  badgeUnavailable: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#0c2340' },
  error: { color: '#b91c1c', fontWeight: '700' },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
});
