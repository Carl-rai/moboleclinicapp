import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { confirmSignupVerification as confirmSignupVerificationRequest, getCurrentUser, getDashboard, login as loginRequest, requestSignupVerification as requestSignupVerificationRequest } from '@/lib/api';
import type { DashboardData, User } from '@/types/api';

type SignupPayload = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  dashboard: DashboardData | null;
  isBusy: boolean;
  login: (email: string, password: string) => Promise<User>;
  requestSignupVerification: (payload: SignupPayload) => Promise<void>;
  confirmSignupVerification: (email: string, verificationCode: string) => Promise<void>;
  hydrateDashboard: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsBusy(true);
    try {
      const data = await loginRequest(email, password);
      const nextDashboard = await getDashboard(data.access);
      setToken(data.access);
      setUser(data.user);
      setDashboard(nextDashboard);
      return data.user;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const requestSignupVerification = useCallback(async (payload: SignupPayload) => {
    setIsBusy(true);
    try {
      await requestSignupVerificationRequest(payload);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const confirmSignupVerification = useCallback(async (email: string, verificationCode: string) => {
    setIsBusy(true);
    try {
      await confirmSignupVerificationRequest({ email, verification_code: verificationCode });
    } finally {
      setIsBusy(false);
    }
  }, []);

  const hydrateDashboard = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsBusy(true);
    try {
      const [nextUser, nextDashboard] = await Promise.all([getCurrentUser(token), getDashboard(token)]);
      setUser(nextUser);
      setDashboard(nextDashboard);
    } finally {
      setIsBusy(false);
    }
  }, [token]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setDashboard(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      dashboard,
      isBusy,
      login,
      requestSignupVerification,
      confirmSignupVerification,
      hydrateDashboard,
      logout,
    }),
    [confirmSignupVerification, dashboard, hydrateDashboard, isBusy, login, logout, requestSignupVerification, token, user]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
