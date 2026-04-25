import Constants from 'expo-constants';

import type { AppointmentItem, DashboardData, DoctorItem, LoginResponse, NotificationItem, ScheduleItem, SpecializationItem, StaffItem, User } from '@/types/api';

const expoBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

if (!expoBaseUrl) {
  throw new Error('Missing EXPO_PUBLIC_API_BASE_URL. Set it in clinicapp/.env before starting Expo.');
}

export const API_BASE_URL = expoBaseUrl;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  token?: string | null;
  body?: unknown;
};

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(
      `Cannot reach the clinic API at ${API_BASE_URL}. Make sure Django is running and your device can reach it.`
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      payload?.detail ||
      payload?.non_field_errors?.[0] ||
      Object.values(payload ?? {}).flat()[0] ||
      'Something went wrong.';

    throw new Error(String(errorMessage));
  }

  return payload as T;
}

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login/', {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), password },
  });
}

export function requestSignupVerification(payload: {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
}) {
  return apiRequest<{ message: string; email: string }>('/auth/signup/request-code/', {
    method: 'POST',
    body: {
      ...payload,
      email: payload.email.trim().toLowerCase(),
    },
  });
}

export function confirmSignupVerification(payload: {
  email: string;
  verification_code: string;
}) {
  return apiRequest<{ message: string; user: User }>('/auth/signup/', {
    method: 'POST',
    body: {
      ...payload,
      email: payload.email.trim().toLowerCase(),
    },
  });
}

export function getNotifications(token: string) {
  return apiRequest<NotificationItem[]>('/notifications/', { token });
}

export function markNotificationRead(token: string, id: number) {
  return apiRequest<NotificationItem>(`/notifications/${id}/read/`, { method: 'POST', token });
}

export function markAllNotificationsRead(token: string) {
  return apiRequest<{ detail: string }>('/notifications/read-all/', { method: 'POST', token });
}

export function getDashboard(token: string) {
  return apiRequest<DashboardData>('/dashboard/', { token });
}

export function getCurrentUser(token: string) {
  return apiRequest<User>('/auth/me/', { token });
}

export function getSpecializations(token: string) {
  return apiRequest<SpecializationItem[]>('/admin/specializations/', { token });
}

export function createSpecialization(token: string, name: string) {
  return apiRequest<SpecializationItem>('/admin/specializations/', {
    method: 'POST',
    token,
    body: { name },
  });
}

export function getAdminDoctors(token: string) {
  return apiRequest<DoctorItem[]>('/admin/doctors/', { token });
}

export function getAdminStaff(token: string) {
  return apiRequest<StaffItem[]>('/admin/staff/', { token });
}

export function getAdminPatients(token: string) {
  return apiRequest<User[]>('/admin/patients/', { token });
}

export function createDoctor(
  token: string,
  payload: {
    first_name: string;
    middle_name: string;
    last_name: string;
    email: string;
    password: string;
    specialization_id: number | null;
    contact_number: string;
  }
) {
  return apiRequest<DoctorItem>('/admin/doctors/', {
    method: 'POST',
    token,
    body: {
      ...payload,
      email: payload.email.trim().toLowerCase(),
      middle_name: payload.middle_name.trim(),
    },
  });
}

export function createStaff(
  token: string,
  payload: {
    first_name: string;
    middle_name: string;
    last_name: string;
    email: string;
    password: string;
    assigned_doctor_id: number | null;
    position: string;
    contact_number: string;
  }
) {
  return apiRequest<StaffItem>('/admin/staff/', {
    method: 'POST',
    token,
    body: {
      ...payload,
      email: payload.email.trim().toLowerCase(),
      middle_name: payload.middle_name.trim(),
    },
  });
}

export function updateDoctor(
  token: string,
  doctorId: number,
  payload: {
    first_name: string;
    middle_name: string;
    last_name: string;
    email: string;
    specialization_id: number | null;
    contact_number: string;
  }
) {
  return apiRequest<DoctorItem>(`/admin/doctors/${doctorId}/`, {
    method: 'PUT',
    token,
    body: {
      ...payload,
      email: payload.email.trim().toLowerCase(),
      middle_name: payload.middle_name.trim(),
    },
  });
}

export function assignStaffToDoctor(token: string, doctorId: number, staffId: number) {
  return apiRequest<StaffItem>(`/admin/doctors/${doctorId}/assign-staff/`, {
    method: 'POST',
    token,
    body: { staff_id: staffId },
  });
}

export function deleteDoctor(token: string, doctorId: number) {
  return apiRequest<void>(`/admin/doctors/${doctorId}/`, {
    method: 'DELETE',
    token,
  });
}

export function updateStaff(
  token: string,
  staffId: number,
  payload: {
    first_name: string;
    middle_name: string;
    last_name: string;
    email: string;
    assigned_doctor_id: number | null;
    position: string;
    contact_number: string;
  }
) {
  return apiRequest<StaffItem>(`/admin/staff/${staffId}/`, {
    method: 'PUT',
    token,
    body: {
      ...payload,
      email: payload.email.trim().toLowerCase(),
      middle_name: payload.middle_name.trim(),
    },
  });
}

export function deleteStaff(token: string, staffId: number) {
  return apiRequest<void>(`/admin/staff/${staffId}/`, {
    method: 'DELETE',
    token,
  });
}

// Patient booking APIs
export function getPatientSpecializations(token: string) {
  return apiRequest<SpecializationItem[]>('/patient/specializations/', { token });
}

export function getPatientDoctors(token: string, specializationId: number) {
  return apiRequest<DoctorItem[]>(`/patient/doctors/?specialization_id=${specializationId}`, { token });
}

export function getPatientDoctorSchedules(token: string, doctorId: number) {
  return apiRequest<ScheduleItem[]>(`/patient/doctors/${doctorId}/schedules/`, { token });
}

export function bookAppointment(token: string, payload: { schedule_id: number; reason: string; lab_result: 'with lab result' | 'none' }) {
  return apiRequest<AppointmentItem>('/patient/book/', { method: 'POST', token, body: payload });
}

export function getDoctorAppointments(token: string) {
  return apiRequest<AppointmentItem[]>('/doctor/appointments/', { token });
}

export function markAppointmentDone(token: string, appointmentId: number, checkupResult: string) {
  return apiRequest<AppointmentItem>(`/doctor/appointments/${appointmentId}/done/`, {
    method: 'POST', token, body: { checkup_result: checkupResult },
  });
}

export function getStaffAppointments(token: string) {
  return apiRequest<AppointmentItem[]>('/staff/appointments/', { token });
}

export function staffConfirmAppointment(token: string, appointmentId: number) {
  return apiRequest<AppointmentItem>(`/staff/appointments/${appointmentId}/confirm/`, { method: 'POST', token });
}

export function staffRequireLaboratory(token: string, appointmentId: number, laboratoryRequirement: string) {
  return apiRequest<AppointmentItem>(`/staff/appointments/${appointmentId}/require-laboratory/`, {
    method: 'POST', token, body: { laboratory_requirement: laboratoryRequirement },
  });
}

export function getAdminAppointments(token: string) {
  return apiRequest<AppointmentItem[]>('/admin/appointments/', { token });
}

export function deleteAdminAppointment(token: string, appointmentId: number) {
  return apiRequest<void>(`/admin/appointments/${appointmentId}/`, {
    method: 'DELETE',
    token,
  });
}

export function getPatientAppointments(token: string) {
  return apiRequest<AppointmentItem[]>('/patient/appointments/', { token });
}

export function requestCancelAppointment(token: string, appointmentId: number, cancelReason: string) {
  return apiRequest<AppointmentItem>(`/patient/appointments/${appointmentId}/cancel-request/`, {
    method: 'POST', token, body: { cancel_reason: cancelReason },
  });
}

export function submitLabResult(token: string, appointmentId: number, labResultImage: string, labResultDescription: string) {
  return apiRequest<AppointmentItem>(`/patient/appointments/${appointmentId}/submit-lab-result/`, {
    method: 'POST', token, body: { lab_result_image: labResultImage, lab_result_description: labResultDescription },
  });
}

export function reviewLabResult(token: string, appointmentId: number, action: 'approve' | 'reject', rejectReason?: string) {
  return apiRequest<AppointmentItem>(`/doctor/appointments/${appointmentId}/review-lab-result/`, {
    method: 'POST', token, body: { action, reject_reason: rejectReason ?? '' },
  });
}

export function approveCancellation(token: string, appointmentId: number) {
  return apiRequest<AppointmentItem>(`/appointments/${appointmentId}/approve-cancellation/`, {
    method: 'POST', token,
  });
}

export function rejectCancellation(token: string, appointmentId: number) {
  return apiRequest<AppointmentItem>(`/appointments/${appointmentId}/reject-cancellation/`, {
    method: 'POST', token,
  });
}

// Schedule APIs
export function getDoctorSchedules(token: string) {
  return apiRequest<ScheduleItem[]>('/doctor/schedules/', { token });
}

export function createDoctorSchedule(token: string, payload: { date: string; start_time: string; end_time: string; appointment_pay: string; is_available: boolean }) {
  return apiRequest<ScheduleItem>('/doctor/schedules/', { method: 'POST', token, body: payload });
}

export function updateDoctorSchedule(token: string, id: number, payload: Partial<{ date: string; start_time: string; end_time: string; appointment_pay: string; is_available: boolean }>) {
  return apiRequest<ScheduleItem>(`/doctor/schedules/${id}/`, { method: 'PUT', token, body: payload });
}

export function deleteDoctorSchedule(token: string, id: number) {
  return apiRequest<void>(`/doctor/schedules/${id}/`, { method: 'DELETE', token });
}

export function getStaffDoctorSchedules(token: string) {
  return apiRequest<ScheduleItem[]>('/staff/doctor-schedules/', { token });
}

export function getAdminSchedules(token: string) {
  return apiRequest<ScheduleItem[]>('/admin/schedules/', { token });
}

export function createAdminSchedule(token: string, payload: { doctor_id: number; date: string; start_time: string; end_time: string; appointment_pay: string; is_available: boolean }) {
  return apiRequest<ScheduleItem>('/admin/schedules/', { method: 'POST', token, body: payload });
}

export function updateAdminSchedule(token: string, id: number, payload: Partial<{ date: string; start_time: string; end_time: string; appointment_pay: string; is_available: boolean }>) {
  return apiRequest<ScheduleItem>(`/admin/schedules/${id}/`, { method: 'PUT', token, body: payload });
}

export function deleteAdminSchedule(token: string, id: number) {
  return apiRequest<void>(`/admin/schedules/${id}/`, { method: 'DELETE', token });
}
