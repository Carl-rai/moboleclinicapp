import { Redirect } from 'expo-router';

import { getDashboardRoute } from '@/lib/navigation';
import { useAuth } from '@/providers/auth-context';

export default function DashboardScreen() {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={getDashboardRoute(user.role)} />;
}
