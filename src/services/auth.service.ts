import axiosClient from "../api/axiosClient";
import tokenStorage from "../utils/tokenStorage";
import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  VerifyOtpPayload,
  ResendOtpPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  AuthResponse,
  AccountRecoveryResponse,
  ConfirmRecoveryPayload,
  ConfirmRecoveryResponse,
} from "../types/auth";

const authService = {
  // Login
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const data = await axiosClient.post<unknown, LoginResponse>(
      "/auth/login",
      payload,
    );

    // QUAN TRỌNG: Sửa accessToken -> access_token
    if (data.access_token) {
      tokenStorage.setToken(data.access_token);

      // Lưu user info nếu có
      if (data.user) {
        tokenStorage.setUser(data.user);
      }
    }

    return data;
  },

  // Register
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    return await axiosClient.post<unknown, RegisterResponse>(
      "/auth/register",
      payload,
    );
  },

  // Logout
  logout() {
    tokenStorage.clearAuth();
  },

  // Verify OTP
  async verifyOtp(payload: VerifyOtpPayload): Promise<AuthResponse> {
    return await axiosClient.post<unknown, AuthResponse>(
      "/auth/verify-otp",
      payload,
    );
  },

  // Resend OTP
  async resendOtp(payload: ResendOtpPayload): Promise<AuthResponse> {
    return await axiosClient.post<unknown, AuthResponse>(
      "/auth/resend-otp",
      payload,
    );
  },

  // Forgot Password
  async forgotPassword(email: string): Promise<AuthResponse> {
    // API yêu cầu body { email: "..." }
    const payload: ForgotPasswordPayload = { email };
    return await axiosClient.post<unknown, AuthResponse>(
      "/auth/forgot-password",
      payload,
    );
  },

  // Reset Password
  async resetPassword(payload: ResetPasswordPayload): Promise<AuthResponse> {
    return await axiosClient.post<unknown, AuthResponse>(
      "/auth/reset-password",
      payload,
    );
  },

  // Request Account Recovery
  async requestAccountRecovery(
    formData: FormData,
  ): Promise<AccountRecoveryResponse> {
    // Lưu ý: Khi gửi File, trình duyệt sẽ tự động set Content-Type là multipart/form-data
    // Khai báo rõ ràng trong header để chắc chắn. (gợi ý từ AI)
    return await axiosClient.post<unknown, AccountRecoveryResponse>(
      "/auth/account-recovery",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
  },

  // Confirm Account Recovery
  async confirmAccountRecovery(
    payload: ConfirmRecoveryPayload,
  ): Promise<ConfirmRecoveryResponse> {
    return await axiosClient.post<unknown, ConfirmRecoveryResponse>(
      "/auth/confirm-recovery",
      payload,
    );
  },
};

export default authService;
