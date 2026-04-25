import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, Clock3 } from 'lucide-react-native';

import { createDoctorSchedule, deleteDoctorSchedule, getDoctorSchedules, updateDoctorSchedule } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { ScheduleItem } from '@/types/api';

type PickerMode = 'date' | 'start_time' | 'end_time' | null;

function toDateObj(dateStr: string): Date {
  return dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
}

function toTimeObj(timeStr: string): Date {
  const d = new Date();
  if (timeStr) {
    const [h, m] = timeStr.split(':');
    d.setHours(Number(h), Number(m), 0, 0);
  }
  return d;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function formatTime24(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

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

const emptyForm = { date: '', start_time: '', end_time: '', appointment_pay: '', is_available: true };

export default function DoctorScheduleScreen() {
  const router = useRouter();
  const { user, token, isBusy } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const hasFetched = useRef(false);

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
      if (user && user.role !== 'doctor') { router.replace('/login'); return; }
      if (!hasFetched.current) {
        hasFetched.current = true;
        fetchSchedules();
      }
    }, [token, user])
  );

  async function fetchSchedules() {
    if (!token) return;
    setLoading(true);
    try { setSchedules(await getDoctorSchedules(token)); }
    finally { setLoading(false); }
  }

  function beginEdit(s: ScheduleItem) {
    setShowForm(true);
    setEditingId(s.id);
    setPickerMode(null);
    setForm({
      date: s.date,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      appointment_pay: s.appointment_pay,
      is_available: s.is_available,
    });
    setError('');
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setPickerMode(null);
    setError('');
  }

  function onPickerChange(_: any, selected?: Date) {
    const mode = pickerMode;
    if (Platform.OS === 'android') setPickerMode(null);
    if (!selected || !mode) return;
    if (mode === 'date') setForm((c) => ({ ...c, date: formatDate(selected) }));
    if (mode === 'start_time') setForm((c) => ({ ...c, start_time: formatTime24(selected) }));
    if (mode === 'end_time') setForm((c) => ({ ...c, end_time: formatTime24(selected) }));
  }

  async function handleSave() {
    if (!token) return;
    if (!form.date || !form.start_time || !form.end_time || !form.appointment_pay.trim()) {
      setError('Please select date, start time, end time, and appointment pay.');
      return;
    }
    if (Number(form.appointment_pay) <= 0) {
      setError('Appointment pay must be greater than zero.');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(form.date + 'T00:00:00') < today) {
      setError('Cannot set a schedule on a past date.');
      return;
    }
    if (form.start_time >= form.end_time) {
      setError('End time must be after start time.');
      return;
    }
    const duplicate = schedules.some((s) =>
      s.id !== editingId &&
      s.date === form.date &&
      s.start_time.slice(0, 5) === form.start_time
    );
    if (duplicate) {
      setError('You already have a schedule at that start time on this date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateDoctorSchedule(token, editingId, { ...form, appointment_pay: form.appointment_pay.trim() });
      } else {
        await createDoctorSchedule(token, { ...form, appointment_pay: form.appointment_pay.trim() });
      }
      resetForm();
      await fetchSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save schedule.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    setSaving(true);
    try { await deleteDoctorSchedule(token, id); await fetchSchedules(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete.'); }
    finally { setSaving(false); }
  }

  if (!user && isBusy) return null;
  if (!user || user.role !== 'doctor') return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>My Schedules</Text>
            <Text style={styles.title}>Manage your availability</Text>
          </View>
          <Pressable style={styles.headerButton} onPress={() => router.push('/doctor-dashboard')}>
            <Text style={styles.headerButtonText}>Dashboard</Text>
          </Pressable>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => { resetForm(); setShowForm((c) => !c); }}>
          <Text style={styles.primaryButtonText}>{showForm && !editingId ? 'Hide form' : 'Add schedule'}</Text>
        </Pressable>

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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{editingId ? 'Edit Schedule' : 'New Schedule'}</Text>

            <Text style={styles.fieldLabel}>Date</Text>
            <Pressable
              style={styles.pickerButton}
              onPress={() => setPickerMode((m) => m === 'date' ? null : 'date')}>
              <Text style={form.date ? styles.pickerValue : styles.pickerPlaceholder}>
                {form.date || 'Select date'}
              </Text>
              <CalendarDays size={18} color="#0369a1" />
            </Pressable>
            {pickerMode === 'date' && (
              <DateTimePicker
                key="date-picker"
                value={toDateObj(form.date)}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={onPickerChange}
              />
            )}

            <Text style={styles.fieldLabel}>Start time</Text>
            <Pressable
              style={styles.pickerButton}
              onPress={() => setPickerMode((m) => m === 'start_time' ? null : 'start_time')}>
              <Text style={form.start_time ? styles.pickerValue : styles.pickerPlaceholder}>
                {form.start_time ? formatTimeDisplay(form.start_time) : 'Select start time'}
              </Text>
              <Clock3 size={18} color="#0369a1" />
            </Pressable>
            {pickerMode === 'start_time' && (
              <DateTimePicker
                key="start-picker"
                value={toTimeObj(form.start_time)}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
              />
            )}

            <Text style={styles.fieldLabel}>End time</Text>
            <Pressable
              style={styles.pickerButton}
              onPress={() => setPickerMode((m) => m === 'end_time' ? null : 'end_time')}>
              <Text style={form.end_time ? styles.pickerValue : styles.pickerPlaceholder}>
                {form.end_time ? formatTimeDisplay(form.end_time) : 'Select end time'}
              </Text>
              <Clock3 size={18} color="#0369a1" />
            </Pressable>
            {pickerMode === 'end_time' && (
              <DateTimePicker
                key="end-picker"
                value={toTimeObj(form.end_time)}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
              />
            )}

            <Text style={styles.fieldLabel}>Appointment pay</Text>
            <View style={styles.payInputWrap}>
              <Text style={styles.payPrefix}>PHP</Text>
              <TextInput
                style={styles.payInput}
                placeholder="0.00"
                placeholderTextColor="#7ab3cc"
                keyboardType="decimal-pad"
                value={form.appointment_pay}
                onChangeText={(v) => setForm((c) => ({ ...c, appointment_pay: v }))}
              />
            </View>

            <Pressable
              style={[styles.toggleButton, form.is_available && styles.toggleButtonActive]}
              onPress={() => setForm((c) => ({ ...c, is_available: !c.is_available }))}>
              <Text style={[styles.toggleButtonText, form.is_available && styles.toggleButtonTextActive]}>
                {form.is_available ? 'Available' : 'Unavailable'}
              </Text>
            </Pressable>

            <View style={styles.row}>
              <Pressable style={styles.actionButton} onPress={handleSave} disabled={saving}>
                <Text style={styles.actionButtonText}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={resetForm}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>All Schedules</Text>
          {loading ? <ActivityIndicator color="#0369a1" /> : null}
          {filteredSchedules.map((s) => (
            <View key={s.id} style={styles.itemCard}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemTitle}>{s.date}</Text>
                <Text style={styles.itemCopy}>
                  {formatTimeDisplay(s.start_time.slice(0, 5))} — {formatTimeDisplay(s.end_time.slice(0, 5))}
                </Text>
                <Text style={styles.itemCopy}>{formatPayDisplay(s.appointment_pay)}</Text>
                <View style={[styles.badge, s.is_available ? styles.badgeAvailable : styles.badgeUnavailable]}>
                  <Text style={styles.badgeText}>{s.is_available ? 'Available' : 'Unavailable'}</Text>
                </View>
              </View>
              <View style={styles.itemRight}>
                <Pressable style={styles.smallButton} onPress={() => beginEdit(s)}>
                  <Text style={styles.smallButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => handleDelete(s.id)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!loading && !filteredSchedules.length ? <Text style={styles.emptyCopy}>No schedules match your search.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  container: { padding: 20, gap: 16 },
  header: { gap: 10 },
  backButton: { alignSelf: 'flex-start', backgroundColor: '#e0f2fe', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center' },
  backButtonText: { color: '#0369a1', fontWeight: '800', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 6 },
  headerButton: { backgroundColor: '#e0f2fe', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  headerButtonText: { color: '#0369a1', fontWeight: '800' },
  kicker: { color: '#0369a1', textTransform: 'uppercase', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#0c2340', fontSize: 28, lineHeight: 32, fontWeight: '900' },
  primaryButton: { backgroundColor: '#0369a1', borderRadius: 18, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  card: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
  cardTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  searchInput: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340' },
  fieldLabel: { color: '#4a7fa5', fontSize: 12, fontWeight: '700', marginBottom: -4 },
  pickerButton: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerPlaceholder: { color: '#7ab3cc', fontSize: 15 },
  pickerValue: { color: '#0c2340', fontSize: 15, fontWeight: '700' },
  payInputWrap: { backgroundColor: '#e0f2fe', borderRadius: 18, flexDirection: 'row', alignItems: 'center' },
  payPrefix: { color: '#0369a1', fontWeight: '800', paddingLeft: 16 },
  payInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 15, color: '#0c2340' },
  toggleButton: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#0369a1' },
  toggleButtonText: { color: '#4a7fa5', fontWeight: '800' },
  toggleButtonTextActive: { color: '#fff' },
  actionButton: { flex: 1, backgroundColor: '#0369a1', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { color: '#ffffff', fontWeight: '800' },
  ghostButton: { flex: 1, backgroundColor: '#e0f2fe', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  ghostButtonText: { color: '#0369a1', fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12 },
  itemCard: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, backgroundColor: '#f0f9ff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e0f2fe' },
  itemLeft: { flex: 1, gap: 6 },
  itemRight: { gap: 8 },
  itemTitle: { color: '#0c2340', fontWeight: '800', fontSize: 15 },
  itemCopy: { color: '#4a7fa5', fontSize: 13 },
  badge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeAvailable: { backgroundColor: '#dbeafe' },
  badgeUnavailable: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#0c2340' },
  smallButton: { backgroundColor: '#0369a1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, minWidth: 70, alignItems: 'center' },
  smallButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  deleteButton: { backgroundColor: '#fee2e2', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, minWidth: 70, alignItems: 'center' },
  deleteButtonText: { color: '#b91c1c', fontWeight: '800', fontSize: 13 },
  error: { color: '#b91c1c', fontWeight: '700' },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
});
