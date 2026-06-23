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
    const response = await axiosClient.post("/auth/login", payload);
    const data = response.data as LoginResponse;
    if (data.access_token) {
      tokenStorage.setToken(data.access_token);
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
    const response = await axiosClient.post("/auth/register", payload);
    const data = response.data as RegisterResponse;
    return data;
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

  // Forgot Password
  async forgotPassword(account: string): Promise<AuthResponse> {
    const payload: ForgotPasswordPayload = { account };
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
