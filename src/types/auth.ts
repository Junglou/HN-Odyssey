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

// Verify OTP Payload
export interface VerifyOtpPayload {
  email?: string;
  phoneNumber?: string;
  otpCode: string;
}

// Resend OTP Payload
export interface ResendOtpPayload {
  email?: string;
  phoneNumber?: string;
}

// Forgot Password Payload
export interface ForgotPasswordPayload {
  email: string;
}

// Reset Password Payload
export interface ResetPasswordPayload {
  email: string; // Backend yêu cầu email/account
  otpCode?: string;
  newPassword: string;
  confirmPassword: string;
}

// Generic Response
export interface AuthResponse {
  message: string;
}

// Account Recovery Payload
export interface AccountRecoveryPayload {
  email: string;
  otpCode: string;
  description: string;
  evidence: File | null;
}

// Account Recovery Response
export interface AccountRecoveryResponse {
  message: string;
  ticketId?: string;
}

// Confirm Recovery Payload
export interface ConfirmRecoveryPayload {
  ticketId: string;
  newPassword: string;
  confirmNewPassword: string;
  newEmail: string;
  confirmNewEmail: string;
  otpCode: string;
}

// Confirm Recovery Response
export interface ConfirmRecoveryResponse {
  message: string;
  success: boolean;
}
