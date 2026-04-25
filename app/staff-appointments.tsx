import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Calendar, FileText, FlaskConical, Paperclip, Stethoscope, User, XCircle } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  approveCancellation, getStaffAppointments,
  rejectCancellation, staffConfirmAppointment,
} from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { AppointmentItem } from '@/types/api';

type Tab = 'pending' | 'confirmed' | 'handled';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f5e6c8',
  confirmed: '#c2ede7',
  completed: '#d4f5d4',
  cancelled: '#f8d9d4',
  cancel_requested: '#fde8d0',
};
const STATUS_TEXT: Record<string, string> = {
  pending: '#7a5c1e',
  confirmed: '#1a5c54',
  completed: '#1a5c1a',
  cancelled: '#8f2f2f',
  cancel_requested: '#a04010',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  cancel_requested: 'Cancel Requested',
};

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${p}`;
}

export default function StaffAppointmentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user, token, isBusy } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(
    (params.tab as Tab) ?? 'pending'
  );
  const hasFetched = useRef(false);
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
        appointment.cancel_reason,
        appointment.lab_result,
        appointment.checkup_result,
        appointment.lab_result_description,
        appointment.handled_by?.user.full_name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [appointments, search]);

  useFocusEffect(
    useCallback(() => {
      if (!token) { router.replace('/login'); return; }
      if (user && user.role !== 'staff') { router.replace('/login'); return; }
      if (params.tab && ['pending', 'confirmed', 'handled'].includes(params.tab)) {
        setActiveTab(params.tab as Tab);
      }
      if (!hasFetched.current) {
        hasFetched.current = true;
        load();
      }
    }, [token, user, params.tab])
  );

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try { setAppointments(await getStaffAppointments(token)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load.'); }
    finally { setLoading(false); }
  }

  async function handleConfirm(id: number) {
    if (!token) return;
    setError('');
    try {
      const updated = await staffConfirmAppointment(token, id);
      setAppointments((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to confirm.'); }
  }

  if (!user && isBusy) return null;
  if (!user || user.role !== 'staff') return null;

  const doctorName = appointments[0]?.doctor?.user?.full_name ?? null;

  const tabData: Record<Tab, AppointmentItem[]> = {
    pending: filteredAppointments.filter((a) => a.status === 'pending' || a.status === 'cancel_requested'),
    confirmed: filteredAppointments.filter((a) => a.status === 'confirmed'),
    handled: filteredAppointments.filter((a) => a.status === 'completed' || a.status === 'cancelled'),
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: `Pending (${tabData.pending.length})` },
    { key: 'confirmed', label: `Confirmed (${tabData.confirmed.length})` },
    { key: 'handled', label: `Handled (${tabData.handled.length})` },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.kicker}>Appointments</Text>
          <Text style={styles.title}>{doctorName ? `Dr. ${doctorName}` : 'Assigned Doctor'}</Text>
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

        {/* Tabs */}
        <View style={styles.tabRow}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}>
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          {tabData[activeTab].map((a) => (
            <View key={a.id} style={styles.itemCard}>
              {/* Header */}
              <View style={styles.itemTop}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemTitle}>{a.patient.full_name}</Text>
                  <Text style={styles.itemSub}>{a.patient.email}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[a.status] ?? '#f3ebdf' }]}>
                  <Text style={[styles.statusText, { color: STATUS_TEXT[a.status] ?? '#333' }]}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />

              {/* Details */}
              <View style={styles.labelRow}><Calendar size={13} color="#0c2340" /><Text style={styles.itemDetail}> {a.appointment_date} at {formatTime(a.appointment_time.slice(0, 5))}</Text></View>
              <View style={styles.labelRow}><FileText size={13} color="#0c2340" /><Text style={styles.itemDetail}> Reason: {a.reason}</Text></View>
              <View style={styles.labelRow}><FlaskConical size={13} color="#5b21b6" /><Text style={styles.labResultInlineText}> Lab result: {a.lab_result === 'with lab result' ? 'With lab result' : 'None'}</Text></View>

              {/* Doctor's checkup note */}
              {a.checkup_result ? (
                <View style={styles.noteBlock}>
                  <View style={styles.labelRow}><Stethoscope size={13} color="#166534" /><Text style={styles.noteLabel}> Doctor's note:</Text></View>
                  <Text style={styles.noteText}>{a.checkup_result}</Text>
                </View>
              ) : null}

              {/* Lab requirement */}
              {a.needs_laboratory && a.laboratory_requirement ? (
                <View style={styles.labBlock}>
                  <View style={styles.labelRow}><FlaskConical size={13} color="#5b21b6" /><Text style={styles.labLabel}> Laboratory required:</Text></View>
                  <Text style={styles.labText}>{a.laboratory_requirement}</Text>
                </View>
              ) : null}

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

              {/* Handled by */}
              {a.handled_by ? (
                <View style={styles.labelRow}><User size={13} color="#0c2340" /><Text style={styles.itemDetail}> Handled by: {a.handled_by.user.full_name}</Text></View>
              ) : null}

              {/* PENDING tab: cancel request actions only */}
              {a.status === 'cancel_requested' ? (
                <View style={styles.cancelBlock}>
                  <View style={styles.labelRow}><AlertTriangle size={13} color="#854d0e" /><Text style={styles.cancelReasonText}> Cancel requested: "{a.cancel_reason}"</Text></View>
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.approveButton}
                      onPress={async () => {
                        if (!token) return;
                        try {
                          const updated = await approveCancellation(token, a.id);
                          setAppointments((prev) => prev.map((x) => x.id === updated.id ? updated : x));
                        } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
                      }}>
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </Pressable>
                    <Pressable
                      style={styles.rejectButton}
                      onPress={async () => {
                        if (!token) return;
                        try {
                          const updated = await rejectCancellation(token, a.id);
                          setAppointments((prev) => prev.map((x) => x.id === updated.id ? updated : x));
                        } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
                      }}>
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* HANDLED tab: Confirm only */}
              {activeTab === 'handled' && a.status === 'completed' ? (
                <View style={styles.actionRow}>
                  <Pressable style={styles.confirmButton} onPress={() => handleConfirm(a.id)}>
                    <Text style={styles.confirmButtonText}>Confirmed</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}

          {!loading && tabData[activeTab].length === 0 ? (
            <Text style={styles.emptyCopy}>
              {doctorName === null ? 'No doctor assigned yet.' : `No ${activeTab} appointments match your search.`}
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
  tabRow: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, backgroundColor: '#e0f2fe', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#0369a1' },
  tabText: { color: '#0369a1', fontWeight: '800', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
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
  noteBlock: { backgroundColor: '#dcfce7', borderRadius: 12, padding: 10, gap: 4 },
  noteLabel: { color: '#166534', fontWeight: '800', fontSize: 13 },
  noteText: { color: '#14532d', fontSize: 13, lineHeight: 19 },
  labBlock: { backgroundColor: '#ede9fe', borderRadius: 12, padding: 10, gap: 4 },
  labLabel: { color: '#5b21b6', fontWeight: '800', fontSize: 13 },
  labText: { color: '#3b0764', fontSize: 13, lineHeight: 19 },
  labResultBlock: { backgroundColor: '#ede9fe', borderRadius: 12, padding: 10, gap: 6 },
  labResultLabel: { color: '#5b21b6', fontWeight: '800', fontSize: 13 },
  labResultInlineText: { color: '#5b21b6', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  labResultDesc: { color: '#3b0764', fontSize: 12, lineHeight: 18 },
  labResultImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#fff' },
  labResultRejectReason: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  confirmButton: { flex: 1, backgroundColor: '#0369a1', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cancelBlock: { gap: 8, backgroundColor: '#fef9c3', borderRadius: 12, padding: 10 },
  cancelReasonText: { color: '#854d0e', fontSize: 12, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: 8 },
  approveButton: { flex: 1, backgroundColor: '#0369a1', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  approveButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  rejectButton: { flex: 1, backgroundColor: '#b91c1c', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  rejectButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  error: { color: '#b91c1c', fontWeight: '700' },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
  });
