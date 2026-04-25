import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AlertTriangle, ArrowLeft, CalendarDays, Check, FileText, Microscope, Search, Stethoscope, UserRound, X } from 'lucide-react-native';

import { approveCancellation, getDoctorAppointments, markAppointmentDone, rejectCancellation, reviewLabResult } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { AppointmentItem } from '@/types/api';

type Tab = 'all' | 'pending' | 'confirmed' | 'review' | 'handled';

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

function ZoomableLabImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [uri, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(4, savedScale.value * event.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.02) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
        return;
      }
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        return;
      }
      scale.value = withSpring(2);
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(doubleTapGesture, pinchGesture, panGesture)}>
      <Animated.View style={[styles.labImageViewport, imageStyle]}>
        <Image source={{ uri }} style={styles.labPreviewImage} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

export default function DoctorAppointmentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user, token, isBusy } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>((params.tab as Tab) ?? 'all');
  const hasFetched = useRef(false);

  // Done modal state
  const [doneTarget, setDoneTarget] = useState<AppointmentItem | null>(null);
  const [checkupResult, setCheckupResult] = useState('');
  const [doneError, setDoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lab review modal state
  const [labReviewTarget, setLabReviewTarget] = useState<AppointmentItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [labReviewError, setLabReviewError] = useState('');
  const [labReviewing, setLabReviewing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setAppointments(await getDoctorAppointments(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [token]);

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
      if (user && user.role !== 'doctor') { router.replace('/login'); return; }
      if (params.tab && ['all', 'pending', 'confirmed', 'review', 'handled'].includes(params.tab)) {
        setActiveTab(params.tab as Tab);
      }
      if (!hasFetched.current) {
        hasFetched.current = true;
        void load();
      }
    }, [load, params.tab, router, token, user])
  );

  function openDoneModal(a: AppointmentItem) {
    setDoneTarget(a);
    setCheckupResult('');
    setDoneError('');
  }

  function openLabReviewModal(a: AppointmentItem) {
    setLabReviewTarget(a);
    setRejectReason('');
    setShowRejectInput(false);
    setLabReviewError('');
  }

  function closeLabReviewModal() {
    setLabReviewTarget(null);
    setRejectReason('');
    setShowRejectInput(false);
    setLabReviewError('');
  }

  async function handleMarkDone() {
    if (!token || !doneTarget) return;
    if (!checkupResult.trim()) { setDoneError('Please enter the checkup result or doctor\'s note.'); return; }
    setSubmitting(true);
    setDoneError('');
    try {
      const updated = await markAppointmentDone(token, doneTarget.id, checkupResult.trim());
      setAppointments((prev) => prev.map((x) => x.id === updated.id ? updated : x));
      setDoneTarget(null);
    } catch (err) {
      setDoneError(err instanceof Error ? err.message : 'Failed to mark as done.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLabReview(action: 'approve' | 'reject') {
    if (!token || !labReviewTarget) return;
    if (action === 'reject' && !rejectReason.trim()) {
      setLabReviewError('Please enter a reason for rejection.');
      return;
    }
    setLabReviewing(true);
    setLabReviewError('');
    try {
      const updated = await reviewLabResult(token, labReviewTarget.id, action, rejectReason.trim());
      setAppointments((prev) => prev.map((x) => x.id === updated.id ? updated : x));
      closeLabReviewModal();
    } catch (err) {
      setLabReviewError(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setLabReviewing(false);
    }
  }

  if (!user && isBusy) return null;
  if (!user || user.role !== 'doctor') return null;

  const canMarkDone = (s: string) => s === 'pending' || s === 'confirmed';

  const tabData: Record<Tab, AppointmentItem[]> = {
    all: filteredAppointments,
    pending: filteredAppointments.filter((a) => a.status === 'pending' || a.status === 'cancel_requested'),
    confirmed: filteredAppointments.filter((a) => a.status === 'confirmed'),
    review: filteredAppointments.filter((a) => a.lab_result_submitted && a.lab_result_status === 'pending_review'),
    handled: filteredAppointments.filter((a) => a.status === 'completed' || a.status === 'cancelled'),
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: `All (${tabData.all.length})` },
    { key: 'pending', label: `Pending (${tabData.pending.length})` },
    { key: 'confirmed', label: `Confirmed (${tabData.confirmed.length})` },
    { key: 'review', label: `Lab Review (${tabData.review.length})` },
    { key: 'handled', label: `Handled (${tabData.handled.length})` },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={16} color="#0369a1" />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.kicker}>My Appointments</Text>
          <Text style={styles.title}>Patient appointments</Text>
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
              <View style={styles.detailRow}>
                <CalendarDays size={14} color="#0c2340" />
                <Text style={styles.itemDetail}>{a.appointment_date} at {formatTime(a.appointment_time.slice(0, 5))}</Text>
              </View>
              <View style={styles.detailRow}>
                <FileText size={14} color="#0c2340" />
                <Text style={styles.itemDetail}>{a.reason}</Text>
              </View>
              <View style={styles.detailRow}>
                <Microscope size={14} color="#5b21b6" />
                <Text style={styles.labResultInlineText}>
                  Lab result: {a.lab_result === 'with lab result' ? 'With lab result' : 'None'}
                </Text>
              </View>

              {/* Lab result submitted — pending review */}
              {a.lab_result_submitted && a.lab_result_status === 'pending_review' ? (
                <View style={styles.labResultBlock}>
                  <View style={styles.detailRow}>
                    <Microscope size={14} color="#5b21b6" />
                    <Text style={styles.labResultLabel}>Lab result submitted - awaiting your review</Text>
                  </View>
                  {a.lab_result_description ? (
                    <Text style={styles.labResultDesc}>{a.lab_result_description}</Text>
                  ) : null}
                  {a.lab_result_image ? (
                    <Image source={{ uri: a.lab_result_image }} style={styles.labResultImage} resizeMode="contain" />
                  ) : null}
                  <Pressable style={styles.reviewButton} onPress={() => openLabReviewModal(a)}>
                    <View style={styles.buttonContent}>
                      <Search size={14} color="#fff" />
                      <Text style={styles.reviewButtonText}>Review Lab Result</Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}
              {a.lab_result_status === 'approved' ? (
                <View style={styles.labApprovedBlock}>
                  <View style={styles.detailRow}>
                    <Check size={14} color="#166534" />
                    <Text style={styles.labApprovedText}>Lab result approved</Text>
                  </View>
                </View>
              ) : null}
              {a.lab_result_status === 'rejected' ? (
                <View style={styles.labRejectedBlock}>
                  <View style={styles.detailRow}>
                    <X size={14} color="#b91c1c" />
                    <Text style={styles.labRejectedText}>Lab result rejected: &quot;{a.lab_result_reject_reason}&quot;</Text>
                  </View>
                </View>
              ) : null}
              {a.checkup_result ? (
                <View style={styles.resultBlock}>
                  <View style={styles.detailRow}>
                    <Stethoscope size={14} color="#166534" />
                    <Text style={styles.resultLabel}>Doctor&apos;s note:</Text>
                  </View>
                  <Text style={styles.resultText}>{a.checkup_result}</Text>
                </View>
              ) : null}

              {/* Cancel request block */}
              {a.status === 'cancel_requested' ? (
                <View style={styles.cancelBlock}>
                  <View style={styles.detailRow}>
                    <AlertTriangle size={14} color="#854d0e" />
                    <Text style={styles.cancelReasonText}>Cancel requested: &quot;{a.cancel_reason}&quot;</Text>
                  </View>
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
                      <View style={styles.buttonContent}>
                        <Check size={14} color="#fff" />
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </View>
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
                      <View style={styles.buttonContent}>
                        <X size={14} color="#fff" />
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* Mark Done button */}
              {canMarkDone(a.status) ? (
                <Pressable style={styles.doneButton} onPress={() => openDoneModal(a)}>
                  <View style={styles.buttonContent}>
                    <Check size={14} color="#fff" />
                    <Text style={styles.doneButtonText}>Mark as Done</Text>
                  </View>
                </Pressable>
              ) : null}

              {a.handled_by ? (
                <View style={styles.detailRow}>
                  <UserRound size={14} color="#0c2340" />
                  <Text style={styles.itemDetail}>Handled by: {a.handled_by.user.full_name}</Text>
                </View>
              ) : null}
            </View>
          ))}
          {!loading && tabData[activeTab].length === 0 ? (
            <Text style={styles.emptyCopy}>No {activeTab} appointments match your search.</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Mark Done Modal */}
      <Modal
        visible={doneTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDoneTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Mark Appointment Done</Text>
                <Text style={styles.modalSub}>
                  Patient: {doneTarget?.patient.full_name} - {doneTarget?.appointment_date}
                </Text>
            <Text style={styles.fieldLabel}>Checkup result / Doctor&apos;s note</Text>
            <TextInput
              style={styles.resultInput}
              placeholder="Enter your findings, prescription, or notes for the patient..."
              placeholderTextColor="#8b8478"
              multiline
              numberOfLines={5}
              value={checkupResult}
              onChangeText={setCheckupResult}
              autoFocus
            />
            {doneError ? <Text style={styles.error}>{doneError}</Text> : null}
            <View style={styles.actionRow}>
              <Pressable style={styles.doneConfirmButton} onPress={handleMarkDone} disabled={submitting}>
                <Text style={styles.doneConfirmButtonText}>{submitting ? 'Saving...' : 'Mark Done'}</Text>
              </Pressable>
              <Pressable style={styles.cancelModalButton} onPress={() => setDoneTarget(null)}>
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={labReviewTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeLabReviewModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.labReviewCard}>
            <View style={styles.labReviewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Review Lab Result</Text>
                <Text style={styles.modalSub}>
                  Patient: {labReviewTarget?.patient.full_name} - {labReviewTarget?.appointment_date}
                </Text>
              </View>
              <Pressable style={styles.closeButton} onPress={closeLabReviewModal}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            {labReviewTarget?.lab_result_description ? (
              <View style={styles.labReviewMetaBlock}>
                <Text style={styles.fieldLabel}>Description</Text>
                <Text style={styles.labReviewMetaText}>{labReviewTarget.lab_result_description}</Text>
              </View>
            ) : null}

            <View style={styles.labPreviewFrame}>
              {labReviewTarget?.lab_result_image ? (
                <ZoomableLabImage uri={labReviewTarget.lab_result_image} />
              ) : (
                <Text style={styles.labPreviewFallback}>No lab image attached.</Text>
              )}
            </View>
            <Text style={styles.zoomHint}>Pinch or double-tap the image to zoom in.</Text>

            {showRejectInput ? (
              <TextInput
                style={styles.rejectInput}
                placeholder="Enter a rejection reason..."
                placeholderTextColor="#8b8478"
                multiline
                numberOfLines={3}
                value={rejectReason}
                onChangeText={setRejectReason}
                autoFocus
              />
            ) : null}
            {labReviewError ? <Text style={styles.error}>{labReviewError}</Text> : null}

            <View style={styles.actionRow}>
              <Pressable
                style={styles.approveButton}
                onPress={() => handleLabReview('approve')}
                disabled={labReviewing}>
                <Text style={styles.approveButtonText}>{labReviewing ? 'Saving...' : 'Approve'}</Text>
              </Pressable>
              <Pressable
                style={styles.rejectButton}
                onPress={() => {
                  if (!showRejectInput) {
                    setShowRejectInput(true);
                    return;
                  }
                  void handleLabReview('reject');
                }}
                disabled={labReviewing}>
                <Text style={styles.rejectButtonText}>
                  {showRejectInput ? 'Submit Reject' : 'Reject'}
                </Text>
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
  backButton: { alignSelf: 'flex-start', backgroundColor: '#e0f2fe', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButtonText: { color: '#0369a1', fontWeight: '800', fontSize: 14 },
  kicker: { color: '#0369a1', textTransform: 'uppercase', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#0c2340', fontSize: 28, lineHeight: 32, fontWeight: '900' },
  refreshButton: { backgroundColor: '#0369a1', borderRadius: 18, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  refreshButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  searchCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
  searchTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  searchInput: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340' },
  searchMeta: { color: '#4a7fa5', fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  tab: { backgroundColor: '#e0f2fe', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', minWidth: 96 },
  tabActive: { backgroundColor: '#0369a1' },
  tabText: { color: '#0369a1', fontWeight: '800', fontSize: 12 },
  tabTextActive: { color: '#fff' },
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
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labResultBlock: { backgroundColor: '#ede9fe', borderRadius: 12, padding: 10, gap: 6 },
  labResultLabel: { color: '#5b21b6', fontWeight: '800', fontSize: 13 },
  labResultInlineText: { color: '#5b21b6', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  labResultDesc: { color: '#3b0764', fontSize: 12, lineHeight: 18 },
  labResultImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#fff' },
  reviewButton: { backgroundColor: '#0369a1', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  reviewButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labApprovedBlock: { backgroundColor: '#dcfce7', borderRadius: 12, padding: 8 },
  labApprovedText: { color: '#166534', fontWeight: '800', fontSize: 13 },
  labRejectedBlock: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 8 },
  labRejectedText: { color: '#b91c1c', fontWeight: '800', fontSize: 13 },
  resultBlock: { backgroundColor: '#dcfce7', borderRadius: 12, padding: 10, gap: 4 },
  resultLabel: { color: '#166534', fontWeight: '800', fontSize: 13 },
  resultText: { color: '#14532d', fontSize: 13, lineHeight: 19 },
  cancelBlock: { gap: 8, backgroundColor: '#fef9c3', borderRadius: 12, padding: 10 },
  cancelReasonText: { color: '#854d0e', fontSize: 12, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: 8 },
  approveButton: { flex: 1, backgroundColor: '#0369a1', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  approveButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  rejectButton: { flex: 1, backgroundColor: '#b91c1c', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  rejectButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  doneButton: { backgroundColor: '#0369a1', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
  doneButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  error: { color: '#b91c1c', fontWeight: '700' },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(3,105,161,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 24, width: '100%', gap: 12, borderWidth: 1, borderColor: '#bae6fd' },
  modalTitle: { color: '#0c2340', fontSize: 20, fontWeight: '900' },
  modalSub: { color: '#0369a1', fontWeight: '700', fontSize: 14 },
  fieldLabel: { color: '#4a7fa5', fontSize: 12, fontWeight: '700', marginBottom: -4 },
  resultInput: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340', minHeight: 120, textAlignVertical: 'top' },
  doneConfirmButton: { flex: 1, backgroundColor: '#0369a1', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  doneConfirmButtonText: { color: '#ffffff', fontWeight: '800' },
  cancelModalButton: { flex: 1, backgroundColor: '#e0f2fe', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelModalButtonText: { color: '#0369a1', fontWeight: '800' },
  labReviewCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, width: '100%', height: '92%', gap: 12, borderWidth: 1, borderColor: '#bae6fd' },
  labReviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  closeButton: { backgroundColor: '#e0f2fe', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  closeButtonText: { color: '#0369a1', fontWeight: '800' },
  labReviewMetaBlock: { backgroundColor: '#f0f9ff', borderRadius: 18, padding: 12, gap: 6 },
  labReviewMetaText: { color: '#0c2340', fontSize: 13, lineHeight: 19 },
  labPreviewFrame: { flex: 1, backgroundColor: '#0c2340', borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  labImageViewport: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  labPreviewImage: { width: '100%', height: '100%' },
  labPreviewFallback: { color: '#ffffff', fontWeight: '700' },
  zoomHint: { color: '#4a7fa5', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  rejectInput: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340', minHeight: 96, textAlignVertical: 'top' },
});
