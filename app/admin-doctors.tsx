import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react-native';

import {
  assignStaffToDoctor,
  createDoctor,
  createSpecialization,
  deleteDoctor,
  getSpecializations,
  updateDoctor,
} from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { DoctorItem, SpecializationItem } from '@/types/api';

const emptyAddForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  password: '',
  specialization_id: null as number | null,
  contact_number: '',
};

const emptyEditForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  specialization_id: null as number | null,
  contact_number: '',
};

export default function AdminDoctorsScreen() {
  const router = useRouter();
  const { user, dashboard, hydrateDashboard, token, isBusy } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);

  const [specializations, setSpecializations] = useState<SpecializationItem[]>([]);
  const [showSpecDropdown, setShowSpecDropdown] = useState<'add' | 'edit' | null>(null);
  const [showAddSpecModal, setShowAddSpecModal] = useState(false);
  const [newSpecName, setNewSpecName] = useState('');
  const [specError, setSpecError] = useState('');
  const [specSaving, setSpecSaving] = useState(false);

  // Assign staff modal
  const [assignDoctorId, setAssignDoctorId] = useState<number | null>(null);
  const [assignStaffId, setAssignStaffId] = useState<number | null>(null);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        router.replace('/login');
        return;
      }
      hydrateDashboard();
      getSpecializations(token).then(setSpecializations).catch(() => {});
    }, [hydrateDashboard, router, token])
  );

  const doctors = useMemo(() => dashboard?.doctors ?? [], [dashboard?.doctors]);
  const staffMembers = useMemo(() => dashboard?.staff_members ?? [], [dashboard?.staff_members]);
  const filteredDoctors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return doctors;
    return doctors.filter((doctor) => {
      const haystack = [
        doctor.user.full_name,
        doctor.user.email,
        doctor.specialization,
        doctor.contact_number,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [doctors, search]);

  // Only staff with no doctor assigned, plus whoever is already assigned to this doctor
  const availableStaff = useMemo(
    () => staffMembers.filter((s) => !s.assigned_doctor || s.assigned_doctor.id === assignDoctorId),
    [staffMembers, assignDoctorId]
  );

  if (!user && isBusy) return null;
  if (!user || user.role !== 'admin') return null;

  function beginEdit(doctor: DoctorItem) {
    setShowAddForm(false);
    setEditingDoctorId(doctor.id);
    setEditForm({
      first_name: doctor.user.first_name,
      middle_name: doctor.user.middle_name,
      last_name: doctor.user.last_name,
      email: doctor.user.email,
      specialization_id: doctor.specialization_id ?? null,
      contact_number: doctor.contact_number,
    });
    setError('');
  }

  function openAssignModal(doctor: DoctorItem) {
    setAssignDoctorId(doctor.id);
    // Pre-select the currently assigned staff if any
    const current = staffMembers.find((s) => s.assigned_doctor?.id === doctor.id);
    setAssignStaffId(current?.id ?? null);
    setAssignError('');
    setAssignDropdownOpen(false);
  }

  async function handleAssignStaff() {
    if (!token || !assignDoctorId || !assignStaffId) {
      setAssignError('Please select a staff member.');
      return;
    }
    setAssignSaving(true);
    setAssignError('');
    try {
      await assignStaffToDoctor(token, assignDoctorId, assignStaffId);
      setAssignDoctorId(null);
      await hydrateDashboard();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Unable to assign staff.');
    } finally {
      setAssignSaving(false);
    }
  }

  async function handleAddSpecialization() {
    if (!token || !newSpecName.trim()) {
      setSpecError('Please enter a specialization name.');
      return;
    }
    setSpecSaving(true);
    setSpecError('');
    try {
      const created = await createSpecialization(token, newSpecName.trim());
      setSpecializations((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSpecName('');
      setShowAddSpecModal(false);
    } catch (err) {
      setSpecError(err instanceof Error ? err.message : 'Unable to add specialization.');
    } finally {
      setSpecSaving(false);
    }
  }

  async function handleAddDoctor() {
    if (!token) return;
    setError('');
    if (
      !addForm.first_name.trim() ||
      !addForm.last_name.trim() ||
      !addForm.email.trim() ||
      !addForm.password ||
      !addForm.contact_number.trim()
    ) {
      setError('Please complete all doctor fields.');
      return;
    }
    setSaving(true);
    try {
      await createDoctor(token, {
        first_name: addForm.first_name.trim(),
        middle_name: addForm.middle_name.trim(),
        last_name: addForm.last_name.trim(),
        email: addForm.email.trim().toLowerCase(),
        password: addForm.password,
        specialization_id: addForm.specialization_id,
        contact_number: addForm.contact_number.trim(),
      });
      setAddForm(emptyAddForm);
      setShowAddForm(false);
      await hydrateDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add doctor.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDoctor() {
    if (!token || !editingDoctorId) return;
    setSaving(true);
    setError('');
    try {
      await updateDoctor(token, editingDoctorId, {
        first_name: editForm.first_name.trim(),
        middle_name: editForm.middle_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        specialization_id: editForm.specialization_id,
        contact_number: editForm.contact_number.trim(),
      });
      setEditingDoctorId(null);
      await hydrateDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update doctor.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDoctor(doctorId: number) {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await deleteDoctor(token, doctorId);
      if (editingDoctorId === doctorId) setEditingDoctorId(null);
      await hydrateDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete doctor.');
    } finally {
      setSaving(false);
    }
  }

  function SpecializationPicker({
    selectedId,
    onSelect,
    context,
  }: {
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    context: 'add' | 'edit';
  }) {
    const selected = specializations.find((s) => s.id === selectedId);
    const isOpen = showSpecDropdown === context;
    return (
      <View>
        <View style={styles.row}>
          <Pressable
            style={[styles.dropdownTrigger, { flex: 1 }]}
            onPress={() => setShowSpecDropdown(isOpen ? null : context)}>
            <Text style={selected ? styles.dropdownValue : styles.dropdownPlaceholder}>
              {selected ? selected.name : 'Select specialization'}
            </Text>
            {isOpen ? <ChevronUp size={14} color="#7ab3cc" /> : <ChevronDown size={14} color="#7ab3cc" />}
          </Pressable>
          <Pressable
            style={styles.addSpecButton}
            onPress={() => {
              setSpecError('');
              setNewSpecName('');
              setShowAddSpecModal(true);
            }}>
            <Text style={styles.addSpecButtonText}>+ Add</Text>
          </Pressable>
        </View>
        {isOpen && (
          <View style={styles.dropdownList}>
            <Pressable style={styles.dropdownItem} onPress={() => { onSelect(null); setShowSpecDropdown(null); }}>
              <Text style={styles.dropdownItemText}>None</Text>
            </Pressable>
            {specializations.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.dropdownItem, s.id === selectedId && styles.dropdownItemActive]}
                onPress={() => { onSelect(s.id); setShowSpecDropdown(null); }}>
                <Text style={[styles.dropdownItemText, s.id === selectedId && styles.dropdownItemTextActive]}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
            {!specializations.length && (
              <Text style={styles.dropdownEmpty}>No specializations yet. Use the Add button.</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  const assigningDoctor = doctors.find((d) => d.id === assignDoctorId) ?? null;
  const selectedStaff = availableStaff.find((s) => s.id === assignStaffId) ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Doctors</Text>
            <Text style={styles.title}>Doctor management</Text>
            <Text style={styles.copy}>Add doctors and manage their clinic profiles.</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton} onPress={() => router.push('/admin-staff')}>
              <Text style={styles.headerButtonText}>Staff</Text>
            </Pressable>
            <Pressable style={styles.headerButton} onPress={() => router.push('/admin-dashboard')}>
              <Text style={styles.headerButtonText}>Dashboard</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            setEditingDoctorId(null);
            setShowAddForm((c) => !c);
            setError('');
          }}>
          <Text style={styles.primaryButtonText}>{showAddForm ? 'Hide add doctor' : 'Add doctor'}</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search doctors</Text>
          <TextInput
            style={styles.input}
            placeholder="Search by doctor name, email, specialization, or contact"
            placeholderTextColor="#8b8478"
            value={search}
            onChangeText={setSearch}
          />
          <Text style={styles.emptyCopy}>{filteredDoctors.length} doctor(s) shown</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {showAddForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add Doctor</Text>
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
            <SpecializationPicker
              selectedId={addForm.specialization_id}
              onSelect={(id) => setAddForm((c) => ({ ...c, specialization_id: id }))}
              context="add"
            />
            <TextInput style={styles.input} placeholder="Contact number" placeholderTextColor="#8b8478" value={addForm.contact_number} onChangeText={(v) => setAddForm((c) => ({ ...c, contact_number: v }))} />
            <Pressable style={styles.actionButton} onPress={handleAddDoctor} disabled={saving}>
              <Text style={styles.actionButtonText}>{saving ? 'Saving...' : 'Create doctor'}</Text>
            </Pressable>
          </View>
        ) : null}

        {editingDoctorId ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Edit Doctor</Text>
            <TextInput style={styles.input} placeholder="First name" placeholderTextColor="#8b8478" value={editForm.first_name} onChangeText={(v) => setEditForm((c) => ({ ...c, first_name: v }))} />
            <TextInput style={styles.input} placeholder="Middle name" placeholderTextColor="#8b8478" value={editForm.middle_name} onChangeText={(v) => setEditForm((c) => ({ ...c, middle_name: v }))} />
            <TextInput style={styles.input} placeholder="Last name" placeholderTextColor="#8b8478" value={editForm.last_name} onChangeText={(v) => setEditForm((c) => ({ ...c, last_name: v }))} />
            <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" placeholderTextColor="#8b8478" value={editForm.email} onChangeText={(v) => setEditForm((c) => ({ ...c, email: v }))} />
            <SpecializationPicker
              selectedId={editForm.specialization_id}
              onSelect={(id) => setEditForm((c) => ({ ...c, specialization_id: id }))}
              context="edit"
            />
            <TextInput style={styles.input} placeholder="Contact number" placeholderTextColor="#8b8478" value={editForm.contact_number} onChangeText={(v) => setEditForm((c) => ({ ...c, contact_number: v }))} />
            <View style={styles.row}>
              <Pressable style={styles.actionButton} onPress={handleSaveDoctor} disabled={saving}>
                <Text style={styles.actionButtonText}>{saving ? 'Saving...' : 'Save doctor'}</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => setEditingDoctorId(null)}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>All Doctors</Text>
          {filteredDoctors.map((doctor) => {
            const assignedStaff = staffMembers.filter((s) => s.assigned_doctor?.id === doctor.id);
            return (
              <View key={doctor.id} style={styles.itemCard}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemTitle}>Dr. {doctor.user.full_name}</Text>
                  <Text style={styles.itemCopy}>#{doctor.id} | {doctor.specialization || '—'}</Text>
                  <Text style={styles.itemCopy}>{doctor.user.email}</Text>
                  <Text style={styles.itemCopy}>{doctor.contact_number}</Text>
                  <Text style={styles.itemCopy}>
                    Staff: {assignedStaff.length > 0 ? assignedStaff.map((s) => s.user.full_name).join(', ') : 'None assigned'}
                  </Text>
                </View>
                <View style={styles.itemRight}>
                  <Pressable style={styles.smallButton} onPress={() => beginEdit(doctor)}>
                    <Text style={styles.smallButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.assignButton} onPress={() => openAssignModal(doctor)}>
                    <Text style={styles.assignButtonText}>Assign Staff</Text>
                  </Pressable>
                  <Pressable style={styles.deleteButton} onPress={() => handleDeleteDoctor(doctor.id)}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {!filteredDoctors.length ? <Text style={styles.emptyCopy}>No doctors match your search.</Text> : null}
        </View>

        {isBusy || saving ? <ActivityIndicator style={styles.loader} color="#0369a1" /> : null}
      </ScrollView>

      {/* Add Specialization Modal */}
      <Modal visible={showAddSpecModal} transparent animationType="fade" onRequestClose={() => setShowAddSpecModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddSpecModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Specialization</Text>
            <TextInput
              style={styles.input}
              placeholder="Specialization name"
              placeholderTextColor="#8b8478"
              value={newSpecName}
              onChangeText={setNewSpecName}
              autoFocus
            />
            {specError ? <Text style={styles.error}>{specError}</Text> : null}
            <View style={styles.row}>
              <Pressable style={styles.actionButton} onPress={handleAddSpecialization} disabled={specSaving}>
                <Text style={styles.actionButtonText}>{specSaving ? 'Saving...' : 'Add'}</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => setShowAddSpecModal(false)}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Assign Staff Modal */}
      <Modal visible={assignDoctorId !== null} transparent animationType="fade" onRequestClose={() => setAssignDoctorId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAssignDoctorId(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Assign Staff</Text>
            {assigningDoctor ? (
              <Text style={styles.modalSubtitle}>Doctor: Dr. {assigningDoctor.user.full_name}</Text>
            ) : null}

            {/* Staff dropdown */}
            <Pressable
              style={styles.dropdownTrigger}
              onPress={() => setAssignDropdownOpen((o) => !o)}>
              <Text style={selectedStaff ? styles.dropdownValue : styles.dropdownPlaceholder}>
                {selectedStaff ? selectedStaff.user.full_name : 'Select staff member'}
              </Text>
              {assignDropdownOpen ? <ChevronUp size={14} color="#7ab3cc" /> : <ChevronDown size={14} color="#7ab3cc" />}
            </Pressable>

            {assignDropdownOpen && (
              <View style={styles.dropdownList}>
                {availableStaff.map((s) => (
                  <Pressable
                    key={s.id}
                    style={[styles.dropdownItem, s.id === assignStaffId && styles.dropdownItemActive]}
                    onPress={() => { setAssignStaffId(s.id); setAssignDropdownOpen(false); }}>
                    <Text style={[styles.dropdownItemText, s.id === assignStaffId && styles.dropdownItemTextActive]}>
                      {s.user.full_name}
                    </Text>
                  </Pressable>
                ))}
                {!availableStaff.length && (
                  <Text style={styles.dropdownEmpty}>No available staff. Add staff first.</Text>
                )}
              </View>
            )}

            {assignError ? <Text style={styles.error}>{assignError}</Text> : null}

            <View style={styles.row}>
              <Pressable style={styles.actionButton} onPress={handleAssignStaff} disabled={assignSaving}>
                <Text style={styles.actionButtonText}>{assignSaving ? 'Saving...' : 'Assign'}</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => setAssignDoctorId(null)}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  itemRight: { gap: 8 },
  itemTitle: { color: '#0c2340', fontWeight: '800', fontSize: 15 },
  itemCopy: { color: '#4a7fa5', fontSize: 13, lineHeight: 18 },
  smallButton: { backgroundColor: '#0369a1', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, minWidth: 82, alignItems: 'center' },
  smallButtonText: { color: '#ffffff', fontWeight: '800' },
  assignButton: { backgroundColor: '#0ea5e9', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, minWidth: 82, alignItems: 'center' },
  assignButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
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
  addSpecButton: { backgroundColor: '#0369a1', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  addSpecButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(3,105,161,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 24, width: '100%', gap: 14, borderWidth: 1, borderColor: '#bae6fd' },
  modalTitle: { color: '#0c2340', fontSize: 20, fontWeight: '900' },
  modalSubtitle: { color: '#4a7fa5', fontSize: 14 },
});
