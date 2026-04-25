import { useFocusEffect, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import type { NotificationItem } from '@/types/api';

export default function NotificationsScreen() {
  const router = useRouter();
  const { token, user, isBusy } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');
  const hasFetched = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) { router.replace('/login'); return; }
      if (!hasFetched.current) {
        hasFetched.current = true;
        load();
      }
    }, [token])
  );

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try { setNotifications(await getNotifications(token)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load.'); }
    finally { setLoading(false); }
  }

  async function handleMarkRead(id: number) {
    if (!token) return;
    try {
      const updated = await markNotificationRead(token, id);
      setNotifications((prev) => prev.map((n) => n.id === updated.id ? updated : n));
    } catch { /* silent */ }
  }

  async function handleMarkAll() {
    if (!token) return;
    setMarking(true);
    try {
      await markAllNotificationsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setMarking(false);
    }
  }

  if (!user && isBusy) return null;
  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.kicker}>Notifications</Text>
              <Text style={styles.title}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </Text>
            </View>
            {unreadCount > 0 && (
              <Pressable style={styles.markAllButton} onPress={handleMarkAll} disabled={marking}>
                <Text style={styles.markAllText}>{marking ? '...' : 'Mark all read'}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Pressable style={styles.refreshButton} onPress={() => { hasFetched.current = false; load(); }}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#0369a1" style={{ marginVertical: 12 }} /> : null}

        <View style={styles.list}>
          {notifications.map((n) => (
            <Pressable
              key={n.id}
              style={[styles.item, !n.is_read && styles.itemUnread]}
              onPress={() => !n.is_read && handleMarkRead(n.id)}>
              <View style={styles.itemTop}>
                {!n.is_read && <View style={styles.dot} />}
                <Text style={[styles.itemMessage, !n.is_read && styles.itemMessageUnread]}>
                  {n.message}
                </Text>
              </View>
              <View style={styles.itemBottom}>
                <Text style={styles.itemTime}>
                  {n.created_at.slice(0, 16).replace('T', ' ')}
                </Text>
                {!n.is_read && (
                  <Text style={styles.tapHint}>Tap to mark read</Text>
                )}
              </View>
            </Pressable>
          ))}
          {!loading && !notifications.length && (
            <View style={styles.emptyWrap}>
              <Bell size={48} color="#7ab3cc" />
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f9ff' },
  container: { padding: 20, gap: 14 },
  header: { gap: 10 },
  backButton: { alignSelf: 'flex-start', backgroundColor: '#e0f2fe', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  backButtonText: { color: '#0369a1', fontWeight: '800', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: '#0369a1', textTransform: 'uppercase', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#0c2340', fontSize: 26, fontWeight: '900' },
  markAllButton: { backgroundColor: '#0369a1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  markAllText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  refreshButton: { backgroundColor: '#e0f2fe', borderRadius: 18, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  refreshButtonText: { color: '#0369a1', fontWeight: '800', fontSize: 14 },
  list: { gap: 10 },
  item: { backgroundColor: '#ffffff', borderRadius: 18, padding: 14, gap: 8, borderWidth: 1, borderColor: '#bae6fd' },
  itemUnread: { backgroundColor: '#e0f2fe', borderLeftWidth: 4, borderLeftColor: '#0369a1', borderColor: '#7dd3fc' },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#0369a1', marginTop: 4, flexShrink: 0 },
  itemMessage: { color: '#0c2340', fontSize: 14, lineHeight: 21, flex: 1 },
  itemMessageUnread: { color: '#0c2340', fontWeight: '700' },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTime: { color: '#4a7fa5', fontSize: 12 },
  tapHint: { color: '#0369a1', fontSize: 11, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: '#7ab3cc', fontSize: 16, fontStyle: 'italic' },
  error: { color: '#b91c1c', fontWeight: '700' },
});
