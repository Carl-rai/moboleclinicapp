import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Calendar, Camera, CheckCircle, ClipboardList, FileText, FlaskConical, Hourglass, Paperclip, RefreshCw, Upload, XCircle } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPatientAppointments, requestCancelAppointment, submitLabResult } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { AppointmentItem } from '@/types/api';

type Tab = 'today' | 'upcoming' | 'confirmed' | 'completed' | 'cancelled';

const STATUS_COLORS: Record<string, string> = {
  pending: '#fef9c3',
  confirmed: '#dbeafe',
  completed: '#dcfce7',
  cancelled: '#fee2e2',
  cancel_requested: '#ffedd5',
};
const STATUS_TEXT: Record<string, string> = {
  pending: '#854d0e',
  confirmed: '#1e40af',
  completed: '#166534',
  cancelled: '#b91c1c',
  cancel_requested: '#9a3412',
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PatientAppointmentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user, token, isBusy } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>((params.tab as Tab) ?? 'today');
  const hasFetched = useRef(false);

  const filteredAppointments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return appointments;
    return appointments.filter((appointment) => {
      const haystack = [
        appointment.doctor.user.full_name,
        appointment.doctor.specialization,
        appointment.appointment_date,
        appointment.appointment_time,
        appointment.status,
        appointment.reason,
        appointment.cancel_reason,
        appointment.checkup_result,
        appointment.laboratory_requirement,
        appointment.lab_result_description,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [appointments, search]);

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<AppointmentItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Lab submit modal
  const [labTarget, setLabTarget] = useState<AppointmentItem | null>(null);
  const [labImage, setLabImage] = useState<string | null>(null);
  const [labDescription, setLabDescription] = useState('');
  const [labError, setLabError] = useState('');
  const [labSubmitting, setLabSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) { router.replace('/login'); return; }
      if (user && user.role !== 'patient') { router.replace('/login'); return; }
      if (params.tab && ['today', 'upcoming', 'confirmed', 'completed', 'cancelled'].includes(params.tab)) {
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
    try { setAppointments(await getPatientAppointments(token)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load.'); }
    finally { setLoading(false); }
  }

  async function handleCancelRequest() {
    if (!token || !cancelTarget) return;
    if (!cancelReason.trim()) { setCancelError('Please enter a reason for cancellation.'); return; }
    setCancelling(true);
    setCancelError('');
    try {
      const updated = await requestCancelAppointment(token, cancelTarget.id, cancelReason.trim());
      setAppointments((prev) => prev.map((a) => a.id === updated.id ? updated : a));
      setCancelTarget(null);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Unable to request cancellation.');
    } finally {
      setCancelling(false);
    }
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setLabImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  }

  async function handleLabSubmit() {
    if (!token || !labTarget) return;
    if (!labImage && !labDescription.trim()) {
      setLabError('Please add a photo or a description for your lab result.');
      return;
    }
    setLabSubmitting(true);
    setLabError('');
    try {
      const updated = await submitLabResult(token, labTarget.id, labImage ?? '', labDescription.trim());
      setAppointments((prev) => prev.map((a) => a.id === updated.id ? updated : a));
      setLabTarget(null);
      setLabImage(null);
      setLabDescription('');
    } catch (err) {
      setLabError(err instanceof Error ? err.message : 'Failed to submit.');
    } finally {
      setLabSubmitting(false);
    }
  }

  if (!user && isBusy) return null;
  if (!user || user.role !== 'patient') return null;

  const today = todayStr();

  const tabData: Record<Tab, AppointmentItem[]> = {
    today: filteredAppointments.filter((a) =>
      a.appointment_date === today &&
      ['pending', 'confirmed'].includes(a.status)
    ),
    upcoming: filteredAppointments.filter((a) =>
      a.appointment_date >= today &&
      a.status === 'pending'
    ),
    confirmed: filteredAppointments.filter((a) => a.status === 'confirmed'),
    completed: filteredAppointments.filter((a) => a.status === 'completed'),
    cancelled: filteredAppointments.filter((a) => a.status === 'cancelled' || a.status === 'cancel_requested'),
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'today', label: `Today (${tabData.today.length})` },
    { key: 'upcoming', label: `Upcoming (${tabData.upcoming.length})` },
    { key: 'confirmed', label: `Confirmed (${tabData.confirmed.length})` },
    { key: 'completed', label: `Completed (${tabData.completed.length})` },
    { key: 'cancelled', label: `Cancelled (${tabData.cancelled.length})` },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.kicker}>My Appointments</Text>
          <Text style={styles.title}>Appointment records</Text>
        </View>

        <Pressable style={styles.refreshButton} onPress={() => { hasFetched.current = false; load(); }}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>

        <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>Search appointments</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by doctor, date, status, or reason"
            placeholderTextColor="#8b8478"
            value={search}
            onChangeText={setSearch}
          />
          <Text style={styles.searchMeta}>{filteredAppointments.length} appointment(s) shown</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#0369a1" style={{ marginVertical: 12 }} /> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
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
        </ScrollView>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tabs.find((t) => t.key === activeTab)?.label ?? 'Appointments'}</Text>
          {tabData[activeTab].map((a) => (
            <View key={a.id} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemTitle}>Dr. {a.doctor.user.full_name}</Text>
                  <Text style={styles.itemSub}>{a.doctor.specialization}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[a.status] ?? '#f3ebdf' }]}>
                  <Text style={[styles.statusText, { color: STATUS_TEXT[a.status] ?? '#333' }]}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Text style={styles.itemDetail}><Calendar size={13} color="#0c2340" /> {a.appointment_date} at {formatTime(a.appointment_time.slice(0, 5))}</Text>
              <Text style={styles.itemDetail}><FileText size={13} color="#0c2340" /> {a.reason}</Text>

              {a.checkup_result ? (
                <View style={styles.noteBlock}>
                  <View style={styles.labelRow}><FlaskConical size={13} color="#166534" /><Text style={styles.noteLabel}> Doctor&apos;s note:</Text></View>
                  <Text style={styles.noteText}>{a.checkup_result}</Text>
                </View>
              ) : null}

              {a.needs_laboratory && a.laboratory_requirement ? (
                <View style={styles.labBlock}>
                  <View style={styles.labelRow}><FlaskConical size={13} color="#5b21b6" /><Text style={styles.labLabel}> Laboratory required:</Text></View>
                  <Text style={styles.labText}>{a.laboratory_requirement}</Text>
                </View>
              ) : null}

              {/* Lab result submitted status */}
              {a.lab_result_submitted && a.lab_result_status === 'pending_review' ? (
                <View style={styles.labSubmittedBlock}>
                  <View style={styles.labelRow}><Hourglass size={13} color="#854d0e" /><Text style={styles.labSubmittedText}> Lab result submitted — awaiting doctor review</Text></View>
                </View>
              ) : null}
              {a.lab_result_submitted && a.lab_result_image ? (
                <View style={styles.labAttachmentBlock}>
                  <View style={styles.labelRow}><Paperclip size={13} color="#5b21b6" /><Text style={styles.labAttachmentLabel}> Your submitted lab result</Text></View>
                  {a.lab_result_description ? (
                    <Text style={styles.labAttachmentDesc}>{a.lab_result_description}</Text>
                  ) : null}
                  <Image source={{ uri: a.lab_result_image }} style={styles.labAttachmentImage} resizeMode="contain" />
                </View>
              ) : null}
              {a.lab_result_status === 'approved' ? (
                <View style={styles.labApprovedBlock}>
                  <View style={styles.labelRow}><CheckCircle size={13} color="#166534" /><Text style={styles.labApprovedText}> Lab result approved — you can book again</Text></View>
                </View>
              ) : null}
              {a.lab_result_status === 'rejected' ? (
                <View style={styles.labRejectedBlock}>
                  <View style={styles.labelRow}><XCircle size={13} color="#b91c1c" /><Text style={styles.labRejectedText}> Lab result rejected: &quot;{a.lab_result_reject_reason}&quot;</Text></View>
                  <Text style={styles.labRejectedSub}>Please resubmit your lab result.</Text>
                </View>
              ) : null}

              {a.status === 'cancel_requested' && a.cancel_reason ? (
                <View style={styles.labelRow}><Hourglass size={13} color="#9a3412" /><Text style={styles.cancelReasonText}> Awaiting approval — &quot;{a.cancel_reason}&quot;</Text></View>
              ) : null}

              {/* Cancel button — only on pending status */}
              {a.status === 'pending' ? (
                <Pressable style={styles.cancelButton} onPress={() => { setCancelTarget(a); setCancelReason(''); setCancelError(''); }}>
                  <Text style={styles.cancelButtonText}>Request Cancellation</Text>
                </Pressable>
              ) : null}

              {/* Submit lab result — on confirmed tab when lab required and not yet submitted or rejected */}
              {activeTab === 'confirmed' && a.needs_laboratory &&
                (!a.lab_result_submitted || a.lab_result_status === 'rejected') ? (
                <Pressable style={styles.labSubmitButton} onPress={() => { setLabTarget(a); setLabImage(null); setLabDescription(''); setLabError(''); }}>
                  <View style={styles.labelRow}>
                    {a.lab_result_status === 'rejected' ? <RefreshCw size={13} color="#ffffff" /> : <Upload size={13} color="#ffffff" />}
                    <Text style={styles.labSubmitButtonText}>
                      {a.lab_result_status === 'rejected' ? ' Resubmit Lab Result' : ' Submit Lab Result'}
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          ))}
          {!loading && tabData[activeTab].length === 0 ? (
            <Text style={styles.emptyCopy}>No {activeTab} appointments.</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Cancel Modal */}
      <Modal visible={cancelTarget !== null} transparent animationType="fade" onRequestClose={() => setCancelTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Cancellation</Text>
            <Text style={styles.modalSub}>Dr. {cancelTarget?.doctor.user.full_name} · {cancelTarget?.appointment_date}</Text>
            <Text style={styles.fieldLabel}>Reason for cancellation</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Why do you need to cancel?"
              placeholderTextColor="#8b8478"
              multiline
              numberOfLines={3}
              value={cancelReason}
              onChangeText={setCancelReason}
              autoFocus
            />
            {cancelError ? <Text style={styles.error}>{cancelError}</Text> : null}
            <Text style={styles.modalNote}><AlertTriangle size={12} color="#9a3412" /> Your request will be sent to the doctor or staff for approval.</Text>
            <View style={styles.row}>
              <Pressable style={styles.dangerButton} onPress={handleCancelRequest} disabled={cancelling}>
                <Text style={styles.dangerButtonText}>{cancelling ? 'Sending...' : 'Send Request'}</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => setCancelTarget(null)}>
                <Text style={styles.ghostButtonText}>Back</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Lab Submit Modal */}
      <Modal visible={labTarget !== null} transparent animationType="fade" onRequestClose={() => setLabTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Submit Lab Result</Text>
            <Text style={styles.modalSub}>Dr. {labTarget?.doctor.user.full_name} · {labTarget?.appointment_date}</Text>
            {labTarget?.laboratory_requirement ? (
              <View style={styles.labBlock}>
                <View style={styles.labelRow}><FlaskConical size={13} color="#5b21b6" /><Text style={styles.labLabel}> Required:</Text></View>
                <Text style={styles.labText}>{labTarget.laboratory_requirement}</Text>
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>Description / Notes</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 70 }]}
              placeholder="Describe your lab result, or leave it blank if you upload a photo..."
              placeholderTextColor="#8b8478"
              multiline
              numberOfLines={3}
              value={labDescription}
              onChangeText={setLabDescription}
            />
            <Text style={styles.fieldLabel}>Upload lab result photo</Text>
            <Pressable style={styles.imagePicker} onPress={pickImage}>
              {labImage ? (
                <Image source={{ uri: labImage }} style={styles.previewImage} resizeMode="cover" />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Camera size={40} color="#4a7fa5" />
                  <Text style={styles.imagePickerText}>Tap to select photo, or skip it</Text>
                </View>
              )}
            </Pressable>
            {labImage ? (
              <Pressable onPress={() => setLabImage(null)}>
                <Text style={styles.removeImageText}>Remove photo</Text>
              </Pressable>
            ) : null}
            {labError ? <Text style={styles.error}>{labError}</Text> : null}
            <Text style={styles.modalNote}><ClipboardList size={12} color="#9a3412" /> The doctor will be notified once you submit your result.</Text>
            <View style={styles.row}>
              <Pressable style={styles.submitButton} onPress={handleLabSubmit} disabled={labSubmitting}>
                <View style={styles.labelRow}><Upload size={14} color="#fff" /><Text style={styles.submitButtonText}>{labSubmitting ? ' Submitting...' : ' Submit'}</Text></View>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => setLabTarget(null)}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  tabRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  tab: { backgroundColor: '#e0f2fe', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  tabActive: { backgroundColor: '#0369a1' },
  tabText: { color: '#0369a1', fontWeight: '800', fontSize: 12 },
  tabTextActive: { color: '#ffffff' },
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
  itemDetail: { color: '#0c2340', fontSize: 13, lineHeight: 20 },
  noteBlock: { backgroundColor: '#dcfce7', borderRadius: 12, padding: 10, gap: 4 },
  noteLabel: { color: '#166534', fontWeight: '800', fontSize: 13 },
  noteText: { color: '#14532d', fontSize: 13, lineHeight: 19 },
  labBlock: { backgroundColor: '#ede9fe', borderRadius: 12, padding: 10, gap: 4 },
  labLabel: { color: '#5b21b6', fontWeight: '800', fontSize: 13 },
  labText: { color: '#3b0764', fontSize: 13, lineHeight: 19 },
  labSubmittedBlock: { backgroundColor: '#fef9c3', borderRadius: 12, padding: 8 },
  labSubmittedText: { color: '#854d0e', fontWeight: '800', fontSize: 13 },
  labAttachmentBlock: { backgroundColor: '#ede9fe', borderRadius: 12, padding: 10, gap: 6 },
  labAttachmentLabel: { color: '#5b21b6', fontWeight: '800', fontSize: 13 },
  labAttachmentDesc: { color: '#3b0764', fontSize: 12, lineHeight: 18 },
  labAttachmentImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#fff' },
  labApprovedBlock: { backgroundColor: '#dcfce7', borderRadius: 12, padding: 8 },
  labApprovedText: { color: '#166534', fontWeight: '800', fontSize: 13 },
  labRejectedBlock: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 8, gap: 4 },
  labRejectedText: { color: '#b91c1c', fontWeight: '800', fontSize: 13 },
  labRejectedSub: { color: '#b91c1c', fontSize: 12 },
  cancelReasonText: { color: '#9a3412', fontSize: 12, fontStyle: 'italic' },
  cancelButton: { backgroundColor: '#fee2e2', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  cancelButtonText: { color: '#b91c1c', fontWeight: '800', fontSize: 13 },
  labSubmitButton: { backgroundColor: '#0369a1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  labSubmitButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  error: { color: '#b91c1c', fontWeight: '700' },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(3,105,161,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 24, width: '100%', gap: 12, borderWidth: 1, borderColor: '#bae6fd' },
  modalTitle: { color: '#0c2340', fontSize: 20, fontWeight: '900' },
  modalSub: { color: '#0369a1', fontWeight: '700', fontSize: 14 },
  fieldLabel: { color: '#4a7fa5', fontSize: 12, fontWeight: '700', marginBottom: -4 },
  textInput: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340', minHeight: 90, textAlignVertical: 'top' },
  modalNote: { color: '#9a3412', fontSize: 12, lineHeight: 18 },
  imagePicker: { backgroundColor: '#e0f2fe', borderRadius: 18, overflow: 'hidden', minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  imagePickerPlaceholder: { alignItems: 'center', gap: 8, padding: 24 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  imagePickerText: { color: '#4a7fa5', fontWeight: '700', fontSize: 14 },
  previewImage: { width: '100%', height: 200 },
  removeImageText: { color: '#b91c1c', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  dangerButton: { flex: 1, backgroundColor: '#b91c1c', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dangerButtonText: { color: '#fff', fontWeight: '800' },
  submitButton: { flex: 1, backgroundColor: '#0369a1', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '800' },
  ghostButton: { flex: 1, backgroundColor: '#e0f2fe', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  ghostButtonText: { color: '#0369a1', fontWeight: '800' },
});
