import type { Href } from 'expo-router';

import type { UserRole } from '@/types/api';

export function getDashboardRoute(role: UserRole): Href {
  switch (role) {
    case 'admin':
      return '/admin-dashboard';
    case 'doctor':
      return '/doctor-dashboard';
    case 'staff':
      return '/staff-dashboard';
    case 'patient':
    default:
      return '/patient-dashboard';
  }
}
