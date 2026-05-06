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
  ConfirmRecoveryPayload,
  ConfirmRecoveryResponse,
} from "../types/auth";

const authService = {
  // Login (US.02)
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const data = await axiosClient.post<unknown, LoginResponse>(
      "/auth/login",
      payload,
    );

    // Lưu Token, Refresh Token và User info
    if (data.access_token) {
      tokenStorage.setToken(data.access_token);

      // BỔ SUNG: Lưu refresh_token vào storage
      if (data.refresh_token) {
        tokenStorage.setRefreshToken(data.refresh_token);
      }

      if (data.user) {
        tokenStorage.setUser(data.user);
      }
    }

    return data;
  },

  // Register (US.01)
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    return await axiosClient.post<unknown, RegisterResponse>(
      "/auth/register",
      payload,
    );
  },

  // Logout
  async logout(): Promise<void> {
    try {
      await axiosClient.post("/auth/logout");
    } catch (error) {
      console.error("Lỗi khi gọi API logout:", error);
    } finally {
      tokenStorage.clearAuth();
    }
  },

  // Refresh Token (BỔ SUNG)
  async refreshToken(
    refreshToken: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    return await axiosClient.post("/auth/refresh", {
      refresh_token: refreshToken,
    });
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

  // Forgot Password (ĐÃ FIX MAP DỮ LIỆU)
  async forgotPassword(email: string): Promise<AuthResponse> {
    const payload: ForgotPasswordPayload = { account: email };
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
  requestAccountRecovery: async (formData: FormData) => {
    return await axiosClient.post("/auth/recovery-request", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Confirm Account Recovery
  async confirmAccountRecovery(
    payload: ConfirmRecoveryPayload,
  ): Promise<ConfirmRecoveryResponse> {
    return await axiosClient.post<unknown, ConfirmRecoveryResponse>(
      "/auth/recover-account",
      payload,
    );
  },
};

export default authService;
