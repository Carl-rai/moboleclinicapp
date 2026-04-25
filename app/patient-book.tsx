import { useFocusEffect, useRouter } from 'expo-router';
import { CheckCircle, Hospital, UserCheck } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bookAppointment, getPatientDoctors, getPatientDoctorSchedules, getPatientSpecializations } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { DoctorItem, ScheduleItem, SpecializationItem } from '@/types/api';

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

function isScheduleExpired(schedule: ScheduleItem) {
  const [year, month, day] = schedule.date.split('-').map(Number);
  const [hour, minute, second = 0] = schedule.start_time.split(':').map(Number);
  const scheduleDateTime = new Date(year, month - 1, day, hour, minute, second);
  return scheduleDateTime.getTime() < Date.now();
}

type Step = 'specialization' | 'doctor' | 'schedule' | 'confirm';

export default function PatientBookScreen() {
  const router = useRouter();
  const { user, token, isBusy } = useAuth();

  const [step, setStep] = useState<Step>('specialization');
  const [specializations, setSpecializations] = useState<SpecializationItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [search, setSearch] = useState('');

  const [selectedSpec, setSelectedSpec] = useState<SpecializationItem | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorItem | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [reason, setReason] = useState('');
  const [labResult, setLabResult] = useState<'with lab result' | 'none'>('none');
  const [labResultMenuOpen, setLabResultMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [successModal, setSuccessModal] = useState(false);
  const hasFetched = useRef(false);

  const filteredSpecializations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return specializations;
    return specializations.filter((spec) => spec.name.toLowerCase().includes(query));
  }, [search, specializations]);

  const filteredDoctors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return doctors;
    return doctors.filter((doctor) => {
      const haystack = [
        doctor.user.full_name,
        doctor.user.email,
        doctor.specialization,
        doctor.contact_number,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [doctors, search]);

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

  const loadSpecializations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setSpecializations(await getPatientSpecializations(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load specializations.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (!token) { router.replace('/login'); return; }
      if (user && user.role !== 'patient') { router.replace('/login'); return; }
      if (!hasFetched.current) {
        hasFetched.current = true;
        void loadSpecializations();
      }
    }, [loadSpecializations, router, token, user])
  );

  async function selectSpecialization(spec: SpecializationItem) {
    if (!token) return;
    setSelectedSpec(spec);
    setSelectedDoctor(null);
    setSelectedSchedule(null);
    setDoctors([]);
    setSchedules([]);
    setSearch('');
    setStep('doctor');
    setLoading(true);
    setError('');
    try { setDoctors(await getPatientDoctors(token, spec.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load doctors.'); }
    finally { setLoading(false); }
  }

  async function selectDoctor(doctor: DoctorItem) {
    if (!token) return;
    setSelectedDoctor(doctor);
    setSelectedSchedule(null);
    setSchedules([]);
    setSearch('');
    setStep('schedule');
    setLoading(true);
    setError('');
    try { setSchedules(await getPatientDoctorSchedules(token, doctor.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load schedules.'); }
    finally { setLoading(false); }
  }

  function selectSchedule(schedule: ScheduleItem) {
    if (isScheduleExpired(schedule)) return;
    setSelectedSchedule(schedule);
    setStep('confirm');
    setError('');
  }

  async function handleBook() {
    if (!token || !selectedSchedule) return;
    if (isScheduleExpired(selectedSchedule)) {
      setError('This schedule has already passed. Please choose another one.');
      return;
    }
    if (!reason.trim()) { setError('Please enter a reason for your appointment.'); return; }
    setBooking(true);
    setError('');
    try {
      await bookAppointment(token, {
        schedule_id: selectedSchedule.id,
        reason: reason.trim(),
        lab_result: labResult,
      });
      setSuccessModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to book appointment.');
    } finally {
      setBooking(false);
    }
  }

  function resetAll() {
    setStep('specialization');
    setSelectedSpec(null);
    setSelectedDoctor(null);
    setSelectedSchedule(null);
    setReason('');
    setLabResult('none');
    setLabResultMenuOpen(false);
    setSearch('');
    setError('');
    setSuccessModal(false);
    hasFetched.current = false;
    loadSpecializations();
  }

  if (!user && isBusy) return null;
  if (!user || user.role !== 'patient') return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.kicker}>Book Appointment</Text>
          <Text style={styles.title}>Find a doctor</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {(['specialization', 'doctor', 'schedule', 'confirm'] as Step[]).map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, step === s && styles.stepDotActive,
                (['specialization', 'doctor', 'schedule', 'confirm'].indexOf(step) > i) && styles.stepDotDone]}>
                <Text style={styles.stepDotText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#0369a1" style={{ marginVertical: 12 }} /> : null}

        {step !== 'confirm' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {step === 'specialization'
                ? 'Search specializations'
                : step === 'doctor'
                  ? 'Search doctors'
                  : 'Search schedules'}
            </Text>
            <TextInput
              style={styles.searchInput}
              placeholder={
                step === 'specialization'
                  ? 'Search specialization'
                  : step === 'doctor'
                    ? 'Search doctor name, email, or contact'
                    : 'Search date, time, or availability'
              }
              placeholderTextColor="#8b8478"
              value={search}
              onChangeText={setSearch}
            />
            <Text style={styles.consultationNote}>Face to Face Consultation Only</Text>
            <Text style={styles.emptyCopy}>
              {step === 'specialization'
                ? `${filteredSpecializations.length} specialization(s) shown`
                : step === 'doctor'
                  ? `${filteredDoctors.length} doctor(s) shown`
                  : `${filteredSchedules.length} schedule(s) shown`}
            </Text>
          </View>
        ) : null}

        {/* Step 1: Specialization */}
        {step === 'specialization' && !loading && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Select Specialization</Text>
            {filteredSpecializations.map((spec) => (
              <Pressable key={spec.id} style={styles.optionCard} onPress={() => selectSpecialization(spec)}>
                <Text style={styles.optionTitle}>{spec.name}</Text>
                <Text style={styles.optionArrow}>→</Text>
              </Pressable>
            ))}
            {!filteredSpecializations.length && !loading && (
              <Text style={styles.emptyCopy}>No specializations match your search.</Text>
            )}
          </View>
        )}

        {/* Step 2: Doctor */}
        {step === 'doctor' && !loading && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Select Doctor</Text>
              <Pressable onPress={() => setStep('specialization')}>
                <Text style={styles.changeLink}>Change specialization</Text>
              </Pressable>
            </View>
            <View style={styles.selectedBadge}>
              <Hospital size={13} color="#0369a1" />
              <Text style={styles.selectedBadgeText}> {selectedSpec?.name}</Text>
            </View>
            {filteredDoctors.map((doctor) => (
              <Pressable key={doctor.id} style={styles.optionCard} onPress={() => selectDoctor(doctor)}>
                <View style={styles.optionLeft}>
                  <Text style={styles.optionTitle}>Dr. {doctor.user.full_name}</Text>
                  <Text style={styles.optionSub}>{doctor.specialization}</Text>
                  <Text style={styles.optionSub}>{doctor.contact_number}</Text>
                </View>
                <Text style={styles.optionArrow}>→</Text>
              </Pressable>
            ))}
            {!filteredDoctors.length && !loading && (
              <Text style={styles.emptyCopy}>No doctors match your search.</Text>
            )}
          </View>
        )}

        {/* Step 3: Schedule */}
        {step === 'schedule' && !loading && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Select Schedule</Text>
              <Pressable onPress={() => setStep('doctor')}>
                <Text style={styles.changeLink}>Change doctor</Text>
              </Pressable>
            </View>
            <View style={styles.selectedBadge}>
              <UserCheck size={13} color="#0369a1" />
              <Text style={styles.selectedBadgeText}> Dr. {selectedDoctor?.user.full_name}</Text>
            </View>
            {filteredSchedules.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.scheduleCard, isScheduleExpired(s) && styles.scheduleCardDisabled]}
                onPress={() => selectSchedule(s)}
                disabled={isScheduleExpired(s)}>
                <View style={styles.optionLeft}>
                <Text style={styles.optionTitle}>{s.date}</Text>
                <Text style={styles.optionSub}>
                  {formatTimeDisplay(s.start_time.slice(0, 5))} — {formatTimeDisplay(s.end_time.slice(0, 5))}
                </Text>
                <Text style={styles.optionSub}>{formatPayDisplay(s.appointment_pay)}</Text>
              </View>
                <View style={[styles.availableBadge, isScheduleExpired(s) && styles.expiredBadge]}>
                  <Text style={[styles.availableBadgeText, isScheduleExpired(s) && styles.expiredBadgeText]}>
                    {isScheduleExpired(s) ? 'Expired' : 'Available'}
                  </Text>
                </View>
              </Pressable>
            ))}
            {!filteredSchedules.length && !loading && (
              <Text style={styles.emptyCopy}>No schedules match your search.</Text>
            )}
          </View>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Confirm Booking</Text>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Specialization</Text>
              <Text style={styles.summaryValue}>{selectedSpec?.name}</Text>
            </View>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Doctor</Text>
              <Text style={styles.summaryValue}>Dr. {selectedDoctor?.user.full_name}</Text>
            </View>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>{selectedSchedule?.date}</Text>
            </View>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Time</Text>
              <Text style={styles.summaryValue}>
                {formatTimeDisplay(selectedSchedule?.start_time.slice(0, 5) ?? '')} — {formatTimeDisplay(selectedSchedule?.end_time.slice(0, 5) ?? '')}
              </Text>
            </View>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Appointment Fee</Text>
              <Text style={styles.summaryValue}>{formatPayDisplay(selectedSchedule?.appointment_pay)}</Text>
            </View>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Required to bring</Text>
              <Pressable
                style={styles.dropdownField}
                onPress={() => setLabResultMenuOpen(true)}>
                <Text style={styles.dropdownValue}>{labResult}</Text>
                <Text style={styles.dropdownArrow}>v</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Reason for visit</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Describe your reason for this appointment..."
              placeholderTextColor="#8b8478"
              multiline
              numberOfLines={4}
              value={reason}
              onChangeText={setReason}
            />

            <View style={styles.row}>
              <Pressable
                style={[
                  styles.actionButton,
                  (booking || (selectedSchedule ? isScheduleExpired(selectedSchedule) : false)) && styles.actionButtonDisabled,
                ]}
                onPress={handleBook}
                disabled={booking || (selectedSchedule ? isScheduleExpired(selectedSchedule) : false)}>
                <Text style={styles.actionButtonText}>{booking ? 'Booking...' : 'Confirm Booking'}</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => setStep('schedule')}>
                <Text style={styles.ghostButtonText}>Back</Text>
              </Pressable>
            </View>
          </View>
        )}

      </ScrollView>

      <Modal visible={labResultMenuOpen} transparent animationType="fade" onRequestClose={() => setLabResultMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setLabResultMenuOpen(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Select lab result</Text>
            {(['with lab result', 'none'] as const).map((option) => (
              <Pressable
                key={option}
                style={[styles.menuOption, labResult === option && styles.menuOptionActive]}
                onPress={() => {
                  setLabResult(option);
                  setLabResultMenuOpen(false);
                }}>
                <Text style={[styles.menuOptionText, labResult === option && styles.menuOptionTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Success Modal */}
      <Modal visible={successModal} transparent animationType="fade" onRequestClose={resetAll}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <CheckCircle size={48} color="#0369a1" />
            <Text style={styles.modalTitle}>Appointment Booked!</Text>
            <Text style={styles.modalBody}>
              Your appointment with Dr. {selectedDoctor?.user.full_name} on {selectedSchedule?.date} has been booked successfully. Status: Pending.
            </Text>
            <Pressable style={styles.actionButton} onPress={resetAll}>
              <Text style={styles.actionButtonText}>Book another</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => { setSuccessModal(false); router.push('/patient-dashboard'); }}>
              <Text style={styles.ghostButtonText}>Go to dashboard</Text>
            </Pressable>
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
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stepItem: { alignItems: 'center', gap: 4, flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#bae6fd', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#0369a1' },
  stepDotDone: { backgroundColor: '#0ea5e9' },
  stepDotText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  stepLabel: { color: '#4a7fa5', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  consultationNote: { color: '#f97316', fontSize: 13, fontWeight: '700' },
  searchInput: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340' },
  changeLink: { color: '#0369a1', fontWeight: '700', fontSize: 13 },
  selectedBadge: { backgroundColor: '#e0f2fe', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  selectedBadgeText: { color: '#0369a1', fontWeight: '700', fontSize: 13 },
  optionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f9ff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e0f2fe' },
  scheduleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f9ff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#bae6fd' },
  scheduleCardDisabled: { backgroundColor: '#f1f5f9', opacity: 0.72, borderColor: '#e2e8f0' },
  optionLeft: { flex: 1, gap: 3 },
  optionTitle: { color: '#0c2340', fontWeight: '800', fontSize: 15 },
  optionSub: { color: '#4a7fa5', fontSize: 13 },
  optionArrow: { color: '#0369a1', fontWeight: '900', fontSize: 18 },
  availableBadge: { backgroundColor: '#dbeafe', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  availableBadgeText: { color: '#1e40af', fontWeight: '700', fontSize: 12 },
  expiredBadge: { backgroundColor: '#f1f5f9' },
  expiredBadgeText: { color: '#94a3b8' },
  summaryBlock: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e0f2fe' },
  summaryLabel: { color: '#4a7fa5', fontWeight: '700', fontSize: 13 },
  summaryValue: { color: '#0c2340', fontWeight: '800', fontSize: 13, textAlign: 'right', flex: 1, marginLeft: 12 },
  dropdownField: { flex: 1, marginLeft: 12, borderRadius: 12, backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownValue: { color: '#0c2340', fontWeight: '800', fontSize: 13, textTransform: 'capitalize' },
  dropdownArrow: { color: '#0369a1', fontWeight: '900', fontSize: 14, marginLeft: 10 },
  fieldLabel: { color: '#4a7fa5', fontSize: 12, fontWeight: '700', marginBottom: -4 },
  reasonInput: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340', minHeight: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, backgroundColor: '#0369a1', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionButtonDisabled: { backgroundColor: '#7ab3cc' },
  actionButtonText: { color: '#ffffff', fontWeight: '800' },
  ghostButton: { flex: 1, backgroundColor: '#e0f2fe', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ghostButtonText: { color: '#0369a1', fontWeight: '800' },
  error: { color: '#b91c1c', fontWeight: '700' },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(12, 35, 64, 0.35)', justifyContent: 'center', padding: 24 },
  menuCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: '#bae6fd' },
  menuTitle: { color: '#0c2340', fontSize: 16, fontWeight: '800' },
  menuOption: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#e0f2fe' },
  menuOptionActive: { backgroundColor: '#e0f2fe', borderColor: '#0369a1' },
  menuOptionText: { color: '#0c2340', fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  menuOptionTextActive: { color: '#0369a1' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(3,105,161,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 24, width: '100%', gap: 14, borderWidth: 1, borderColor: '#bae6fd', alignItems: 'center' },
  modalTitle: { color: '#0c2340', fontSize: 22, fontWeight: '900' },
  modalBody: { color: '#4a7fa5', fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
