import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react-native';

import { createStaff, deleteStaff, updateStaff } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { StaffItem } from '@/types/api';

const emptyAddForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  password: '',
  assigned_doctor_id: null as number | null,
  position: '',
  contact_number: '',
};

const emptyEditForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  assigned_doctor_id: null as number | null,
  position: '',
  contact_number: '',
};

export default function AdminStaffScreen() {
  const router = useRouter();
  const { user, dashboard, hydrateDashboard, token, isBusy } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [doctorDropdown, setDoctorDropdown] = useState<'add' | 'edit' | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        router.replace('/login');
        return;
      }
      hydrateDashboard();
    }, [hydrateDashboard, router, token])
  );

  const staffMembers = useMemo(() => dashboard?.staff_members ?? [], [dashboard?.staff_members]);
  const doctors = useMemo(() => dashboard?.doctors ?? [], [dashboard?.doctors]);
  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staffMembers;
    return staffMembers.filter((staff) => {
      const haystack = [
        staff.user.full_name,
        staff.user.email,
        staff.position,
        staff.contact_number,
        staff.assigned_doctor?.user.full_name ?? '',
        staff.assigned_doctor?.specialization ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, staffMembers]);

  if (!user && isBusy) return null;
  if (!user || user.role !== 'admin') return null;

  function beginEdit(staff: StaffItem) {
    setShowAddForm(false);
    setEditingStaffId(staff.id);
    setEditForm({
      first_name: staff.user.first_name,
      middle_name: staff.user.middle_name,
      last_name: staff.user.last_name,
      email: staff.user.email,
      assigned_doctor_id: staff.assigned_doctor?.id ?? null,
      position: staff.position,
      contact_number: staff.contact_number,
    });
    setError('');
  }

  async function handleAddStaff() {
    if (!token) return;
    setError('');
    if (
      !addForm.first_name.trim() ||
      !addForm.last_name.trim() ||
      !addForm.email.trim() ||
      !addForm.password ||
      !addForm.position.trim() ||
      !addForm.contact_number.trim()
    ) {
      setError('Please complete all staff fields.');
      return;
    }
    setSaving(true);
    try {
      await createStaff(token, {
        first_name: addForm.first_name.trim(),
        middle_name: addForm.middle_name.trim(),
        last_name: addForm.last_name.trim(),
        email: addForm.email.trim().toLowerCase(),
        password: addForm.password,
        assigned_doctor_id: addForm.assigned_doctor_id,
        position: addForm.position.trim(),
        contact_number: addForm.contact_number.trim(),
      });
      setAddForm(emptyAddForm);
      setShowAddForm(false);
      await hydrateDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add staff.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStaff() {
    if (!token || !editingStaffId) return;
    setSaving(true);
    setError('');
    try {
      await updateStaff(token, editingStaffId, {
        first_name: editForm.first_name.trim(),
        middle_name: editForm.middle_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        assigned_doctor_id: editForm.assigned_doctor_id,
        position: editForm.position.trim(),
        contact_number: editForm.contact_number.trim(),
      });
      setEditingStaffId(null);
      await hydrateDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update staff.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStaff(staffId: number) {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await deleteStaff(token, staffId);
      if (editingStaffId === staffId) setEditingStaffId(null);
      await hydrateDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete staff.');
    } finally {
      setSaving(false);
    }
  }

  function DoctorPicker({
    selectedId,
    onSelect,
    context,
  }: {
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    context: 'add' | 'edit';
  }) {
    const selected = doctors.find((d) => d.id === selectedId);
    const isOpen = doctorDropdown === context;
    // Doctors with no staff assigned, plus the one currently selected (so it stays visible when editing)
    const assignedDoctorIds = new Set(
      staffMembers
        .filter((s) => s.assigned_doctor && s.id !== editingStaffId)
        .map((s) => s.assigned_doctor!.id)
    );
    const availableDoctors = doctors.filter((d) => !assignedDoctorIds.has(d.id) || d.id === selectedId);
    return (
      <View>
        <Pressable
          style={styles.dropdownTrigger}
          onPress={() => setDoctorDropdown(isOpen ? null : context)}>
          <Text style={selected ? styles.dropdownValue : styles.dropdownPlaceholder}>
            {selected ? `Dr. ${selected.user.full_name}` : 'Assign to doctor (optional)'}
          </Text>
          {isOpen ? <ChevronUp size={14} color="#7ab3cc" /> : <ChevronDown size={14} color="#7ab3cc" />}
        </Pressable>
        {isOpen && (
          <View style={styles.dropdownList}>
            <Pressable style={styles.dropdownItem} onPress={() => { onSelect(null); setDoctorDropdown(null); }}>
              <Text style={styles.dropdownItemText}>None</Text>
            </Pressable>
            {availableDoctors.map((d) => (
              <Pressable
                key={d.id}
                style={[styles.dropdownItem, d.id === selectedId && styles.dropdownItemActive]}
                onPress={() => { onSelect(d.id); setDoctorDropdown(null); }}>
                <Text style={[styles.dropdownItemText, d.id === selectedId && styles.dropdownItemTextActive]}>
                  Dr. {d.user.full_name}{d.specialization ? ` — ${d.specialization}` : ''}
                </Text>
              </Pressable>
            ))}
            {!availableDoctors.length && (
              <Text style={styles.dropdownEmpty}>All doctors already have staff assigned.</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Staff</Text>
            <Text style={styles.title}>Staff management</Text>
            <Text style={styles.copy}>Add and manage nurses or secretaries assigned to doctors.</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton} onPress={() => router.push('/admin-doctors')}>
              <Text style={styles.headerButtonText}>Doctors</Text>
            </Pressable>
            <Pressable style={styles.headerButton} onPress={() => router.push('/admin-dashboard')}>
              <Text style={styles.headerButtonText}>Dashboard</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            setEditingStaffId(null);
            setShowAddForm((c) => !c);
            setError('');
          }}>
          <Text style={styles.primaryButtonText}>{showAddForm ? 'Hide add staff' : 'Add staff'}</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search staff</Text>
          <TextInput
            style={styles.input}
            placeholder="Search by staff name, email, position, or assigned doctor"
            placeholderTextColor="#8b8478"
            value={search}
            onChangeText={setSearch}
          />
          <Text style={styles.emptyCopy}>{filteredStaff.length} staff member(s) shown</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {showAddForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add Staff</Text>
            <TextInput style={styles.input} placeholder="First name" placeholderTextColor="#8b8478" value={addForm.first_name} onChangeText={(v) => setAddForm((c) => ({ ...c, first_name: v }))} />
            <TextInput style={styles.input} placeholder="Middle name" placeholderTextColor="#8b8478" value={addForm.middle_name} onChangeText={(v) => setAddForm((c) => ({ ...c, middle_name: v }))} />
            <TextInput style={styles.input} placeholder="Last name" placeholderTextColor="#8b8478" value={addForm.last_name} onChangeText={(v) => setAddForm((c) => ({ ...c, last_name: v }))} />
            <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" placeholderTextColor="#8b8478" value={addForm.email} onChangeText={(v) => setAddForm((c) => ({ ...c, email: v }))} />
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Temporary password"
                placeholderTextColor="#8b8478"
                secureTextEntry={!showAddPassword}
                value={addForm.password}
                onChangeText={(v) => setAddForm((c) => ({ ...c, password: v }))}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowAddPassword((v) => !v)}>
                {showAddPassword ? <EyeOff size={18} color="#0369a1" /> : <Eye size={18} color="#0369a1" />}
              </Pressable>
            </View>
            <TextInput style={styles.input} placeholder="Position" placeholderTextColor="#8b8478" value={addForm.position} onChangeText={(v) => setAddForm((c) => ({ ...c, position: v }))} />
            <TextInput style={styles.input} placeholder="Contact number" placeholderTextColor="#8b8478" value={addForm.contact_number} onChangeText={(v) => setAddForm((c) => ({ ...c, contact_number: v }))} />
            <DoctorPicker
              selectedId={addForm.assigned_doctor_id}
              onSelect={(id) => setAddForm((c) => ({ ...c, assigned_doctor_id: id }))}
              context="add"
            />
            <Pressable style={styles.actionButton} onPress={handleAddStaff} disabled={saving}>
              <Text style={styles.actionButtonText}>{saving ? 'Saving...' : 'Create staff'}</Text>
            </Pressable>
          </View>
        ) : null}

        {editingStaffId ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Edit Staff</Text>
            <TextInput style={styles.input} placeholder="First name" placeholderTextColor="#8b8478" value={editForm.first_name} onChangeText={(v) => setEditForm((c) => ({ ...c, first_name: v }))} />
            <TextInput style={styles.input} placeholder="Middle name" placeholderTextColor="#8b8478" value={editForm.middle_name} onChangeText={(v) => setEditForm((c) => ({ ...c, middle_name: v }))} />
            <TextInput style={styles.input} placeholder="Last name" placeholderTextColor="#8b8478" value={editForm.last_name} onChangeText={(v) => setEditForm((c) => ({ ...c, last_name: v }))} />
            <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" placeholderTextColor="#8b8478" value={editForm.email} onChangeText={(v) => setEditForm((c) => ({ ...c, email: v }))} />
            <TextInput style={styles.input} placeholder="Position" placeholderTextColor="#8b8478" value={editForm.position} onChangeText={(v) => setEditForm((c) => ({ ...c, position: v }))} />
            <TextInput style={styles.input} placeholder="Contact number" placeholderTextColor="#8b8478" value={editForm.contact_number} onChangeText={(v) => setEditForm((c) => ({ ...c, contact_number: v }))} />
            <DoctorPicker
              selectedId={editForm.assigned_doctor_id}
              onSelect={(id) => setEditForm((c) => ({ ...c, assigned_doctor_id: id }))}
              context="edit"
            />
            <View style={styles.row}>
              <Pressable style={styles.actionButton} onPress={handleSaveStaff} disabled={saving}>
                <Text style={styles.actionButtonText}>{saving ? 'Saving...' : 'Save staff'}</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => setEditingStaffId(null)}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>All Staff</Text>
          {filteredStaff.map((staff) => (
            <View key={staff.id} style={styles.itemCard}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemTitle}>{staff.user.full_name}</Text>
                <Text style={styles.itemCopy}>#{staff.id} | {staff.position}</Text>
                <Text style={styles.itemCopy}>{staff.user.email}</Text>
                <Text style={styles.itemCopy}>{staff.contact_number}</Text>
                <Text style={styles.itemCopy}>
                  Assigned doctor: {staff.assigned_doctor ? `Dr. ${staff.assigned_doctor.user.full_name}` : 'Unassigned'}
                </Text>
              </View>
              <View style={styles.itemRight}>
                <Pressable style={styles.smallButton} onPress={() => beginEdit(staff)}>
                  <Text style={styles.smallButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => handleDeleteStaff(staff.id)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!filteredStaff.length ? <Text style={styles.emptyCopy}>No staff members match your search.</Text> : null}
        </View>

        {isBusy || saving ? <ActivityIndicator style={styles.loader} color="#0369a1" /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  container: { padding: 20, gap: 16 },
  header: { gap: 12 },
  headerText: { gap: 8 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  headerButton: { backgroundColor: '#e0f2fe', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  headerButtonText: { color: '#0369a1', fontWeight: '800' },
  kicker: { color: '#0369a1', textTransform: 'uppercase', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#0c2340', fontSize: 30, lineHeight: 34, fontWeight: '900' },
  copy: { color: '#4a7fa5', fontSize: 15, lineHeight: 22 },
  primaryButton: { backgroundColor: '#0369a1', borderRadius: 18, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  card: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
  cardTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  input: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340' },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0f2fe', borderRadius: 18 },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0c2340' },
  eyeButton: { paddingHorizontal: 14, paddingVertical: 14 },
  actionButton: { flex: 1, backgroundColor: '#0369a1', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionButtonText: { color: '#ffffff', fontWeight: '800' },
  ghostButton: { flex: 1, backgroundColor: '#e0f2fe', borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ghostButtonText: { color: '#0369a1', fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12 },
  itemCard: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, backgroundColor: '#f0f9ff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e0f2fe' },
  itemLeft: { flex: 1, gap: 4 },
  itemRight: { gap: 10 },
  itemTitle: { color: '#0c2340', fontWeight: '800', fontSize: 15 },
  itemCopy: { color: '#4a7fa5', fontSize: 13, lineHeight: 18 },
  smallButton: { backgroundColor: '#0369a1', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, minWidth: 82, alignItems: 'center' },
  smallButtonText: { color: '#ffffff', fontWeight: '800' },
  deleteButton: { backgroundColor: '#fee2e2', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, minWidth: 82, alignItems: 'center' },
  deleteButtonText: { color: '#b91c1c', fontWeight: '800' },
  error: { color: '#b91c1c', fontWeight: '700' },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
  loader: { marginVertical: 8 },
  dropdownTrigger: { backgroundColor: '#e0f2fe', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownPlaceholder: { color: '#7ab3cc', fontSize: 15 },
  dropdownValue: { color: '#0c2340', fontSize: 15 },
  dropdownList: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#bae6fd', marginTop: 4, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12 },
  dropdownItemActive: { backgroundColor: '#e0f2fe' },
  dropdownItemText: { color: '#0c2340', fontSize: 15 },
  dropdownItemTextActive: { fontWeight: '800' },
  dropdownEmpty: { color: '#7ab3cc', fontSize: 13, padding: 12, fontStyle: 'italic' },
});
