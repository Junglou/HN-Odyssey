// Login Response
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
  account: string;
  code: string;
  type: string;
}

// Resend OTP Payload
export interface ResendOtpPayload {
  account: string;
  type: string;
}

// Forgot Password Payload (ĐÃ FIX: Đổi email thành account)
export interface ForgotPasswordPayload {
  account: string;
}

// Reset Password Payload
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

// Account Recovery Payload
export interface AccountRecoveryPayload {
  email: string;
  otpCode: string;
  description: string;
  images: File | null;
}

// Account Recovery Response
export interface AccountRecoveryResponse {
  message: string;
  ticketId?: string;
}

// Confirm Recovery Payload
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
