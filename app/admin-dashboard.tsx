import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, Menu } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth-context';

export default function AdminDashboardRoute() {
  const router = useRouter();
  const { user, dashboard, hydrateDashboard, logout, token, isBusy } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) { router.replace('/login'); return; }
      if (user && user.role !== 'admin') { router.replace('/login'); return; }
      hydrateDashboard();
    }, [hydrateDashboard, router, token, user])
  );

  if (!user && isBusy) return null;
  if (!user) return null;
  if (user.role !== 'admin') return null;

  const unreadCount = dashboard?.notifications?.filter((n: any) => !n.is_read).length ?? 0;

  const menuItems = [
    { label: 'Doctors', route: '/admin-doctors' },
    { label: 'Staff', route: '/admin-staff' },
    { label: 'Schedules', route: '/admin-schedule' },
    { label: 'Appointments', route: '/admin-appointments' },
    { label: 'Logout', route: null },
  ];

  function handleMenuItem(label: string, route: string | null) {
    setMenuOpen(false);
    if (label === 'Logout') { logout(); router.replace('/'); return; }
    if (route) router.push(route as any);
  }

  // Filter out unread_notifications from stats
  const statEntries = Object.entries(dashboard?.stats ?? {}).filter(
    ([key]) => key !== 'unread_notifications'
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>Admin Dashboard</Text>
              <Text style={styles.heroTitle}>{dashboard?.user.full_name || user.full_name}</Text>
              <Text style={styles.heroCopy}>
                Review clinic totals and open the management pages for doctors and staff.
              </Text>
            </View>
            <View style={styles.heroActions}>
              {/* Bell */}
              <Pressable style={styles.iconButton} onPress={() => router.push('/notifications')}>
                <Bell size={20} color="#ffffff" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </Pressable>
              {/* Burger */}
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
                        onPress={() => handleMenuItem(item.label, item.route)}>
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

        {menuOpen && (
          <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)} />
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Clinic Overview</Text>
          <View style={styles.statsGrid}>
            {statEntries.map(([key, value]) => {
              const route = adminStatRoutes[key];
              return route ? (
                <Pressable key={key} style={styles.statCard} onPress={() => router.push(route as any)}>
                  <Text style={styles.statValue}>{value as number}</Text>
                  <Text style={styles.statLabel}>{formatLabel(key)}</Text>
                  <Text style={styles.statHint}>Tap to view →</Text>
                </Pressable>
              ) : (
                <View key={key} style={styles.statCard}>
                  <Text style={styles.statValue}>{value as number}</Text>
                  <Text style={styles.statLabel}>{formatLabel(key)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {isBusy ? <ActivityIndicator style={styles.loader} color="#0369a1" /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

const adminStatRoutes: Record<string, string> = {
  total_doctors: '/admin-doctors',
  total_staff: '/admin-staff',
  total_patients: '/admin-patients',
  total_schedules: '/admin-schedule',
  total_appointments: '/admin-appointments',
  pending_appointments: '/admin-appointments',
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  container: { padding: 20, gap: 16 },
  hero: { borderRadius: 30, padding: 22, backgroundColor: '#0369a1' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  heroText: { flex: 1, gap: 8 },
  heroKicker: { color: '#bae6fd', textTransform: 'uppercase', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { color: '#ffffff', fontSize: 30, lineHeight: 34, fontWeight: '900' },
  heroCopy: { color: '#e0f2fe', fontSize: 15, lineHeight: 23 },
  heroActions: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  iconButton: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  menuWrap: { position: 'relative' },
  menuPanel: { position: 'absolute', top: 50, right: 0, minWidth: 180, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#bae6fd', padding: 8, gap: 6, zIndex: 100, shadowColor: '#0369a1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  menuItem: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#e0f2fe' },
  menuItemLogout: { backgroundColor: '#fee2e2' },
  menuItemText: { color: '#0c2340', fontWeight: '800', fontSize: 14 },
  menuItemTextLogout: { color: '#b91c1c' },
  menuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 },
  card: { backgroundColor: '#ffffff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#bae6fd', gap: 12 },
  cardTitle: { color: '#0c2340', fontSize: 18, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  statCard: { width: '48%', backgroundColor: '#e0f2fe', borderRadius: 22, padding: 16, gap: 8 },
  statValue: { color: '#0369a1', fontSize: 28, fontWeight: '900' },
  statLabel: { color: '#4a7fa5', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  statHint: { color: '#0369a1', fontSize: 11, fontWeight: '700' },
  loader: { marginVertical: 8 },
});
