export type SpecializationItem = {
  id: number;
  name: string;
};

export type UserRole = 'admin' | 'doctor' | 'staff' | 'patient';

export type User = {
  id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  email: string;
  role: UserRole;
  created_at: string;
};

export type NotificationItem = {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type AppointmentItem = {
  id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string;
  lab_result: 'with lab result' | 'none';
  cancel_reason: string;
  checkup_result: string;
  needs_laboratory: boolean;
  laboratory_requirement: string;
  lab_result_image: string;
  lab_result_description: string;
  lab_result_submitted: boolean;
  lab_result_status: '' | 'pending_review' | 'approved' | 'rejected';
  lab_result_reject_reason: string;
  created_at: string;
  patient: User;
  doctor: {
    id: number;
    specialization: string;
    contact_number: string;
    user: User;
  };
  schedule: {
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    appointment_pay: string;
    is_available: boolean;
  };
  handled_by: {
    id: number;
    position: string;
    contact_number: string;
    assigned_doctor: DoctorItem | null;
    user: User;
  } | null;
};

export type DoctorItem = {
  id: number;
  specialization: string;
  specialization_id: number | null;
  contact_number: string;
  staff_count?: number;
  user: User;
};

export type StaffItem = {
  id: number;
  position: string;
  contact_number: string;
  assigned_doctor: DoctorItem | null;
  user: User;
};

export type ScheduleItem = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  appointment_pay: string;
  is_available: boolean;
  doctor: DoctorItem;
};

export type DashboardData = {
  user: User;
  stats: Record<string, number>;
  profile?: Record<string, string> | null;
  notifications: NotificationItem[];
  recent_appointments: AppointmentItem[];
  doctors?: DoctorItem[];
  staff_members?: StaffItem[];
};

export type LoginResponse = {
  access: string;
  refresh: string;
  user: User;
};
