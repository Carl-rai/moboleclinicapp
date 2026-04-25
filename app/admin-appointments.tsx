import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calendar, FileText, Paperclip, Trash2, User, UserCheck, XCircle } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteAdminAppointment, getAdminAppointments } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { AppointmentItem } from '@/types/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#fef9c3', confirmed: '#dbeafe', completed: '#dcfce7', cancelled: '#fee2e2',
};
const STATUS_TEXT: Record<string, string> = {
  pending: '#854d0e', confirmed: '#1e40af', completed: '#166534', cancelled: '#b91c1c',
};

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${p}`;
}

export default function AdminAppointmentsScreen() {
  const router = useRouter();
  const { user, token, isBusy } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try { setAppointments(await getAdminAppointments(token)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load.'); }
    finally { setLoading(false); }
  }, [token]);

  async function handleDeleteAppointment(appointment: AppointmentItem) {
    if (!token) return;
    Alert.alert(
      'Delete appointment',
      `Delete the appointment for ${appointment.patient.full_name} on ${appointment.appointment_date}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAdminAppointment(token, appointment.id);
              setAppointments((prev) => prev.filter((x) => x.id !== appointment.id));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to delete appointment.');
            }
          },
        },
      ]
    );
  }

  useFocusEffect(
    useCallback(() => {
      if (!token) { router.replace('/login'); return; }
      if (user && user.role !== 'admin') { router.replace('/login'); return; }
      if (!hasFetched.current) {
        hasFetched.current = true;
        load();
      }
    }, [load, router, token, user])
  );

  const filteredAppointments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return appointments;
    return appointments.filter((appointment) => {
      const haystack = [
        appointment.patient.full_name,
        appointment.patient.email,
        appointment.doctor.user.full_name,
        appointment.doctor.specialization,
        appointment.appointment_date,
        appointment.appointment_time,
        appointment.status,
        appointment.reason,
        appointment.handled_by?.user.full_name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [appointments, search]);

  if (!user && isBusy) return null;
  if (!user || user.role !== 'admin') return null;

  const pending = appointments.filter((a) => a.status === 'pending').length;
  const confirmed = appointments.filter((a) => a.status === 'confirmed').length;
  const completed = appointments.filter((a) => a.status === 'completed').length;
  const cancelled = appointments.filter((a) => a.status === 'cancelled').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.kicker}>Appointments</Text>
          <Text style={styles.title}>All patient appointments</Text>
        </View>

        <Pressable style={styles.refreshButton} onPress={() => { hasFetched.current = false; load(); }}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>

        <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>Search appointments</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by patient, doctor, date, status, or reason"
            placeholderTextColor="#8b8478"
            value={search}
            onChangeText={setSearch}
          />
          <Text style={styles.searchMeta}>{filteredAppointments.length} appointment(s) shown</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#0369a1" style={{ marginVertical: 12 }} /> : null}

        {/* Summary */}
        <View style={styles.summaryRow}>
          {[
            { label: 'Pending', count: pending, bg: '#fef9c3', color: '#854d0e' },
            { label: 'Confirmed', count: confirmed, bg: '#dbeafe', color: '#1e40af' },
            { label: 'Completed', count: completed, bg: '#dcfce7', color: '#166534' },
            { label: 'Cancelled', count: cancelled, bg: '#fee2e2', color: '#b91c1c' },
          ].map((s) => (
            <View key={s.label} style={[styles.summaryCard, { backgroundColor: s.bg }]}>
              <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
              <Text style={[styles.summaryLabel, { color: s.color }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>All Appointments ({filteredAppointments.length})</Text>
          {filteredAppointments.map((a) => (
            <View key={a.id} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemTitle}>{a.patient.full_name}</Text>
                  <Text style={styles.itemSub}>{a.patient.email}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[a.status] ?? '#f3ebdf' }]}>
                  <Text style={[styles.statusText, { color: STATUS_TEXT[a.status] ?? '#333' }]}>
                    {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.labelRow}><UserCheck size={13} color="#0c2340" /><Text style={styles.itemDetail}> Dr. {a.doctor.user.full_name} — {a.doctor.specialization}</Text></View>
              <View style={styles.labelRow}><Calendar size={13} color="#0c2340" /><Text style={styles.itemDetail}> {a.appointment_date} at {formatTime(a.appointment_time.slice(0, 5))}</Text></View>
              <View style={styles.labelRow}><FileText size={13} color="#0c2340" /><Text style={styles.itemDetail}> {a.reason}</Text></View>
              {(a.lab_result_submitted || a.lab_result_status === 'approved' || a.lab_result_status === 'rejected') && a.lab_result_image ? (
                <View style={styles.labResultBlock}>
                  <View style={styles.labelRow}><Paperclip size={13} color="#5b21b6" /><Text style={styles.labResultLabel}> Lab result image</Text></View>
                  {a.lab_result_description ? (
                    <Text style={styles.labResultDesc}>{a.lab_result_description}</Text>
                  ) : null}
                  <Image source={{ uri: a.lab_result_image }} style={styles.labResultImage} resizeMode="contain" />
                  {a.lab_result_status === 'rejected' && a.lab_result_reject_reason ? (
                    <View style={styles.labelRow}><XCircle size={12} color="#b91c1c" /><Text style={styles.labResultRejectReason}> Rejection reason: {a.lab_result_reject_reason}</Text></View>
                  ) : null}
                </View>
              ) : null}
              {a.handled_by ? (
                <View style={styles.labelRow}><User size={13} color="#0c2340" /><Text style={styles.itemDetail}> Handled by: {a.handled_by.user.full_name}</Text></View>
              ) : null}
              <Pressable style={styles.deleteButton} onPress={() => handleDeleteAppointment(a)}>
                <View style={styles.deleteButtonContent}>
                  <Trash2 size={14} color="#b91c1c" />
                  <Text style={styles.deleteButtonText}>Delete appointment</Text>
                </View>
              </Pressable>
            </View>
          ))}
          {!loading && !filteredAppointments.length ? (
            <Text style={styles.emptyCopy}>No appointments match your search.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  container: { padding: 20, gap: 16 },
  header: { gap: 6 },
  backButton: { alignSelf: 'flex-start', backgroundColor: '#e0f2fe', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 4 },
  backButtonText: { color: '#0369a1', fontWeight: '800', fontSize: 14 },
  kicker: { color: '#0369a1', textTransform: 'uppercase', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#0c2340', fontSize: 28, lineHeight: 32, fontWeight: '900' },
  refreshButton: { backgroundColor: '#0369a1', borderRadius: 18, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  refreshButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  searchCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
  searchTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  searchInput: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340' },
  searchMeta: { color: '#4a7fa5', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4 },
  summaryCount: { fontSize: 22, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
  cardTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  itemCard: { backgroundColor: '#f0f9ff', borderRadius: 18, padding: 14, gap: 8, borderWidth: 1, borderColor: '#e0f2fe' },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemLeft: { flex: 1, gap: 2 },
  itemTitle: { color: '#0c2340', fontWeight: '800', fontSize: 15 },
  itemSub: { color: '#4a7fa5', fontSize: 12 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#bae6fd' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  itemDetail: { color: '#0c2340', fontSize: 13, lineHeight: 20 },
  labResultBlock: { backgroundColor: '#ede9fe', borderRadius: 12, padding: 10, gap: 6 },
  labResultLabel: { color: '#5b21b6', fontWeight: '800', fontSize: 13 },
  labResultDesc: { color: '#3b0764', fontSize: 12, lineHeight: 18 },
  labResultImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#fff' },
  labResultRejectReason: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  deleteButton: { marginTop: 4, alignSelf: 'flex-start', backgroundColor: '#fee2e2', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  deleteButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deleteButtonText: { color: '#b91c1c', fontWeight: '800', fontSize: 13 },
  error: { color: '#b91c1c', fontWeight: '700' },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
});
