import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Building2, CalendarDays, Menu, Microscope, MessageCircleMore, Stethoscope } from 'lucide-react-native';

import { useAuth } from '@/providers/auth-context';
import type { UserRole } from '@/types/api';

const CLINIC_QUOTES = [
  { quote: 'Your health is our highest priority — every visit, every time.', author: 'Our Promise' },
  { quote: 'Compassionate care begins the moment you walk through our doors.', author: 'Our Mission' },
  { quote: 'We treat every patient like family — with warmth, respect, and expertise.', author: 'Our Values' },
  { quote: 'Modern medicine, human touch — the perfect balance for your well-being.', author: 'Our Approach' },
  { quote: 'Healing is not just about the body — it is about peace of mind too.', author: 'Our Philosophy' },
];

const CLINIC_FEATURES = [
  { icon: Stethoscope, title: 'Expert Doctors', desc: 'Board-certified specialists across multiple fields' },
  { icon: CalendarDays, title: 'Easy Booking', desc: 'Schedule appointments in just a few taps' },
  { icon: Microscope, title: 'Lab Services', desc: 'In-house laboratory for fast, accurate results' },
  { icon: MessageCircleMore, title: 'Always Here', desc: 'Dedicated staff ready to assist you anytime' },
];

const roleCopy: Record<UserRole, string> = {
  admin: 'Control center for staff, patients, and appointment activity.',
  doctor: 'Review your schedules, appointments, and daily patient queue.',
  staff: 'Track handled bookings and support clinic operations smoothly.',
  patient: 'See your visits, updates, and appointment progress in one place.',
};

const roleAccent: Record<UserRole, string> = {
  admin: '#9c4e1b',
  doctor: '#1f6d63',
  staff: '#3659a7',
  patient: '#0369a1',
};

const roleTitles: Record<UserRole, string> = {
  admin: 'Admin Dashboard',
  doctor: 'Doctor Dashboard',
  staff: 'Staff Dashboard',
  patient: 'Patient Dashboard',
};

const roleStatRoutes: Partial<Record<UserRole, Record<string, string>>> = {
  doctor: {
    appointments_today: '/doctor-appointments',
    upcoming_appointments: '/doctor-appointments',
    completed_appointments: '/doctor-appointments',
    total_schedules: '/doctor-schedule',
    available_schedules: '/doctor-schedule',
  },
  staff: {
    handled_appointments: '/staff-appointments?tab=handled',
    confirmed_appointments: '/staff-appointments?tab=confirmed',
    pending_appointments: '/staff-appointments?tab=pending',
  },
  patient: {
    appointments_today: '/patient-appointments?tab=today',
    upcoming_appointments: '/patient-appointments?tab=upcoming',
    confirmed_appointments: '/patient-appointments?tab=confirmed',
    completed_appointments: '/patient-appointments?tab=completed',
  },
};

type MenuItem = { label: string; route?: string; action?: () => void };
type DashboardScreenProps = { role: UserRole };

export function DashboardScreen({ role }: DashboardScreenProps) {
  const router = useRouter();
  const { user, dashboard, hydrateDashboard, logout, token, isBusy } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const quoteFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (role !== 'patient') return;
    const interval = setInterval(() => {
      Animated.timing(quoteFade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setQuoteIndex((i) => (i + 1) % CLINIC_QUOTES.length);
        Animated.timing(quoteFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [role, quoteFade]);

  useFocusEffect(
    useCallback(() => {
      if (!token) { router.replace('/login'); return; }
      if (user && user.role !== role) { router.replace('/login'); return; }
      hydrateDashboard();
    }, [hydrateDashboard, router, token, user, role])
  );

  if (!user && isBusy) return null;
  if (!user) return null;
  if (user.role !== role) return null;

  const accent = roleAccent[role];
  const statRoutes = roleStatRoutes[role] ?? {};

  // Filter out unread_notifications from stats
  const statEntries = Object.entries(dashboard?.stats ?? {}).filter(
    ([key]) => key !== 'unread_notifications'
  );

  const unreadCount = dashboard?.notifications.filter((n) => !n.is_read).length ?? 0;

  const menuItems: MenuItem[] = [];
  if (role === 'doctor') {
    menuItems.push({ label: 'My Schedules', route: '/doctor-schedule' });
    menuItems.push({ label: 'Appointments', route: '/doctor-appointments' });
  }
  if (role === 'staff') {
    menuItems.push({ label: 'Doctor Schedule', route: '/staff-schedule' });
    menuItems.push({ label: 'Appointments', route: '/staff-appointments' });
  }
  if (role === 'patient') {
    menuItems.push({ label: 'Book Appointment', route: '/patient-book' });
    menuItems.push({ label: 'My Appointments', route: '/patient-appointments' });
  }
  menuItems.push({ label: 'Logout', action: () => { logout(); router.replace('/'); } });

  function handleMenuItem(item: MenuItem) {
    setMenuOpen(false);
    if (item.action) { item.action(); return; }
    if (item.route) router.push(item.route as any);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {role === 'patient' && (
          <View style={styles.clinicBanner}>
            <View style={styles.clinicBannerTop}>
              <View style={styles.clinicBannerIconWrap}>
                <Building2 size={28} color="#ffffff" />
              </View>
              <View style={styles.clinicBannerTextWrap}>
                <Text style={styles.clinicBannerName}>FilCare Clinic</Text>
                <Text style={styles.clinicBannerTagline}>Your trusted health partner </Text>
              </View>
              {/* Bell + Burger in banner */}
              <View style={styles.heroActions}>
                <Pressable style={styles.iconButton} onPress={() => router.push('/notifications')}>
                  <Bell size={20} color="#ffffff" />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </Pressable>
                <View style={styles.menuWrap}>
                  <Pressable style={styles.iconButton} onPress={() => setMenuOpen((o) => !o)}>
                    <Menu size={20} color="#ffffff" />
                  </Pressable>
                  {menuOpen && (
                    <View style={styles.menuPanel}>
                      {menuItems.map((item) => (
                        <Pressable
                          key={item.label}
                          style={[styles.menuItem, item.label === 'Logout' && styles.menuItemLogout]}
                          onPress={() => handleMenuItem(item)}>
                          <Text style={[styles.menuItemText, item.label === 'Logout' && styles.menuItemTextLogout]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
            <Animated.View style={[styles.quoteBox, { opacity: quoteFade }]}>
              <Text style={styles.quoteText}>&ldquo;{CLINIC_QUOTES[quoteIndex].quote}&rdquo;</Text>
              <Text style={styles.quoteAuthor}>— {CLINIC_QUOTES[quoteIndex].author}</Text>
            </Animated.View>
            <View style={styles.quoteDots}>
              {CLINIC_QUOTES.map((_, i) => (
                <View key={i} style={[styles.quoteDot, i === quoteIndex && styles.quoteDotActive]} />
              ))}
            </View>
          </View>
        )}

        {role !== 'patient' && (
          <View style={[styles.hero, { backgroundColor: accent }]}>
            <View style={styles.heroTop}>
              <View style={styles.heroText}>
                <Text style={styles.heroKicker}>{roleTitles[role]}</Text>
                <Text style={styles.heroTitle}>{dashboard?.user.full_name || user.full_name}</Text>
                <Text style={styles.heroCopy}>{roleCopy[role]}</Text>
              </View>
              <View style={styles.heroActions}>
                <Pressable style={styles.iconButton} onPress={() => router.push('/notifications')}>
                  <Bell size={20} color="#ffffff" />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </Pressable>
                <View style={styles.menuWrap}>
                  <Pressable style={styles.iconButton} onPress={() => setMenuOpen((o) => !o)}>
                    <Menu size={20} color="#ffffff" />
                  </Pressable>
                  {menuOpen && (
                    <View style={styles.menuPanel}>
                      {menuItems.map((item) => (
                        <Pressable
                          key={item.label}
                          style={[styles.menuItem, item.label === 'Logout' && styles.menuItemLogout]}
                          onPress={() => handleMenuItem(item)}>
                          <Text style={[styles.menuItemText, item.label === 'Logout' && styles.menuItemTextLogout]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {menuOpen && (
          <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)} />
        )}

        {role === 'patient' && (
          <View style={styles.patientGreeting}>
            <Text style={styles.patientGreetingName}>{dashboard?.user.full_name || user.full_name}</Text>
            <Text style={styles.patientGreetingCopy}>{roleCopy['patient']}</Text>
          </View>
        )}

        {dashboard?.profile ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile details</Text>
            {Object.entries(dashboard.profile).map(([key, value]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.rowLabel}>{formatLabel(key)}</Text>
                <Text style={styles.rowValue}>{value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick stats</Text>
          <View style={styles.statsGrid}>
            {statEntries.map(([key, value]) => {
              const route = statRoutes[key];
              return route ? (
                <Pressable key={key} style={styles.statCard} onPress={() => router.push(route as any)}>
                  <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
                  <Text style={styles.statLabel}>{formatLabel(key)}</Text>
                  <Text style={[styles.statHint, { color: accent }]}>Tap to view →</Text>
                </Pressable>
              ) : (
                <View key={key} style={styles.statCard}>
                  <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
                  <Text style={styles.statLabel}>{formatLabel(key)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent appointments</Text>
          {dashboard?.recent_appointments.length ? (
            dashboard.recent_appointments.slice(0, 3).map((a) => (
              <View key={a.id} style={styles.listItem}>
                <Text style={styles.listTitle}>{a.appointment_date} at {a.appointment_time}</Text>
                <Text style={styles.listCopy}>Status: {a.status} | Doctor: {a.doctor.user.full_name}</Text>
                <Text style={styles.listCopy}>{a.reason}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyCopy}>No appointments yet.</Text>
          )}
        </View>

        {role === 'patient' && (
          <View style={styles.featuresCard}>
            <Text style={styles.featuresTitle}>Why Choose Us</Text>
            <View style={styles.featuresGrid}>
              {CLINIC_FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <View key={f.title} style={styles.featureItem}>
                    <View style={styles.featureIconWrap}>
                      <Icon size={22} color="#0369a1" />
                    </View>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureDesc}>{f.desc}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  clinicBanner: {
    backgroundColor: '#0369a1',
    borderRadius: 0,
    marginHorizontal: -20,
    marginTop: -20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    gap: 16,
  },
  clinicBannerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  clinicBannerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicBannerTextWrap: { flex: 1, gap: 3 },
  clinicBannerName: { color: '#ffffff', fontSize: 22, fontWeight: '900', letterSpacing: 0.3 },
  clinicBannerTagline: { color: '#bae6fd', fontSize: 13, fontWeight: '600' },
  quoteBox: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
    gap: 8,
  },
  quoteText: { color: '#e0f2fe', fontSize: 14, lineHeight: 22, fontStyle: 'italic', fontWeight: '600' },
  quoteAuthor: { color: '#38bdf8', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  quoteDots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  quoteDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  quoteDotActive: { backgroundColor: '#38bdf8', width: 18 },
  featuresCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: '#bae6fd',
    gap: 16,
  },
  featuresTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureItem: {
    width: '47%',
    backgroundColor: '#e0f2fe',
    borderRadius: 20,
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  featureIconWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  featureTitle: { color: '#0c2340', fontSize: 13, fontWeight: '800' },
  featureDesc: { color: '#4a7fa5', fontSize: 11, lineHeight: 16 },
  patientGreeting: { paddingHorizontal: 4, gap: 4 },
  patientGreetingName: { color: '#0c2340', fontSize: 26, fontWeight: '900', lineHeight: 30 },
  patientGreetingCopy: { color: '#4a7fa5', fontSize: 13, lineHeight: 19 },
  container: { padding: 20, gap: 16 },
  hero: { borderRadius: 30, padding: 22 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  heroText: { flex: 1, gap: 8 },
  heroKicker: { color: '#bae6fd', textTransform: 'uppercase', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { color: '#ffffff', fontSize: 30, lineHeight: 34, fontWeight: '900' },
  heroCopy: { color: '#e0f2fe', fontSize: 15, lineHeight: 23 },
  heroActions: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  iconButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  menuWrap: { position: 'relative' },
  menuPanel: {
    position: 'absolute',
    top: 50,
    right: 0,
    minWidth: 180,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#bae6fd',
    padding: 8,
    gap: 6,
    zIndex: 100,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#e0f2fe' },
  menuItemLogout: { backgroundColor: '#fee2e2' },
  menuItemText: { color: '#0c2340', fontWeight: '800', fontSize: 14 },
  menuItemTextLogout: { color: '#b91c1c' },
  menuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 },
  card: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 14 },
  cardTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  statCard: { width: '48%', backgroundColor: '#e0f2fe', borderRadius: 22, padding: 16, gap: 8 },
  statValue: { fontSize: 28, fontWeight: '900' },
  statLabel: { color: '#4a7fa5', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  statHint: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: '#4a7fa5', fontWeight: '700', flex: 1 },
  rowValue: { color: '#0c2340', fontWeight: '800', flex: 1, textAlign: 'right' },
  listItem: { backgroundColor: '#e0f2fe', borderRadius: 18, padding: 14, gap: 6 },
  listTitle: { color: '#0c2340', fontWeight: '800', fontSize: 15 },
  listCopy: { color: '#4a7fa5', fontSize: 13, lineHeight: 18 },
  emptyCopy: { color: '#7ab3cc', fontStyle: 'italic' },
});
