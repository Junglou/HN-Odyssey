// Login Response (snake_case từ Backend)
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    _id: string;
    email: string;
    full_name: string;
    roles: string[];
    avatar?: string;
    status: string;
    permissions?: string[];
    is_portal_access?: boolean;
  };
}

// Login Payload
export interface LoginPayload {
  account: string;
  password: string;
}

// Register Payload
export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  isSubscribed: boolean;
}

// Register Response
export interface RegisterResponse {
  message: string;
  account?: string;
}

// Verify OTP Payload (Khớp verify.dto.ts)
export interface VerifyOtpPayload {
  account: string;
  code: string;
  type: string;
}

// Resend OTP Payload (Khớp resend-otp.dto.ts.ts)
export interface ResendOtpPayload {
  account: string;
  type: string;
}

// Forgot Password Payload (Khớp forgot-password.dto.ts)
export interface ForgotPasswordPayload {
  account: string;
}

// Reset Password Payload (Khớp reset-password.dto.ts)
export interface ResetPasswordPayload {
  account: string;
  code: string;
  newPassword: string;
  confirmNewPassword: string;
}

// Generic Response
export interface AuthResponse {
  message: string;
}

// Account Recovery Payload (Khớp create-recovery.dto.ts)
export interface AccountRecoveryPayload {
  target_account: string;
  contact_email: string;
  reason: string;
  evidence: File | null;
}

// Account Recovery Response
export interface AccountRecoveryResponse {
  message: string;
  ticketId?: string;
}

// Confirm Recovery Payload (Khớp recover-account.dto.ts)
export interface ConfirmRecoveryPayload {
  account: string;
  code: string;
  newPassword: string;
  confirmNewPassword: string;
  newEmail: string;
}

// Confirm Recovery Response
export interface ConfirmRecoveryResponse {
  message: string;
  success: boolean;
}
