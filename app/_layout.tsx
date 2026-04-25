import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/providers/auth-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="admin-dashboard" />
          <Stack.Screen name="admin-doctors" />
          <Stack.Screen name="admin-staff" />
          <Stack.Screen name="admin-team" />
          <Stack.Screen name="doctor-dashboard" />
          <Stack.Screen name="staff-dashboard" />
          <Stack.Screen name="patient-dashboard" />
        </Stack>
        <StatusBar style="auto" />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
