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
      // gửi refresh token để backend chỉ đăng xuất đúng thiết bị này
      await axiosClient.post("/auth/logout", {
        refresh_token: tokenStorage.getRefreshToken(),
      });
    } catch (error) {
      console.error("Lỗi khi gọi API logout:", error);
    } finally {
      tokenStorage.clearAuth();
    }
  },

  // Đồng bộ thông tin + quyền mới nhất của tài khoản (gọi mỗi lần tải lại trang)
  async syncCurrentUser(): Promise<void> {
    if (!tokenStorage.getToken()) return;
    try {
      const response = await axiosClient.get("/auth/me");
      const body = response.data as Record<string, unknown> | undefined;
      // Phòng trường hợp Backend bọc dữ liệu trong { data: ... }
      const freshUser = (body?.data ?? body) as
        | Record<string, unknown>
        | undefined;
      if (freshUser && typeof freshUser === "object") {
        // Gộp để giữ lại các field khác mà trang Profile có thể đã lưu thêm
        const cachedUser =
          tokenStorage.getUser<Record<string, unknown>>() ?? {};
        tokenStorage.setUser({ ...cachedUser, ...freshUser });
      }
    } catch (error) {
      // 403: tài khoản đã bị khóa → xóa phiên. Lỗi mạng: giữ dữ liệu cũ để không chặn người dùng
      if ((error as { status?: number })?.status === 403) {
        tokenStorage.clearAuth();
      }
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
