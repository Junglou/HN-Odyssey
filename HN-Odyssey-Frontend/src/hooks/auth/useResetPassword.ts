import { useState } from "react";
import authService from "../../services/auth.service";
import type { ResetPasswordPayload } from "../../types/auth";

export interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

export const useResetPassword = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetPassword = async (payload: ResetPasswordPayload) => {
    setLoading(true);
    setError(null);

    try {
      // Truyền thẳng payload do type đã khớp 100% với BE
      await authService.resetPassword(payload);
      return true;
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const message = Array.isArray(apiError.response?.data?.message)
        ? apiError.response?.data?.message[0]
        : apiError.response?.data?.message || apiError.message;

      const errorMessage = message || "Đặt lại mật khẩu thất bại.";
      setError(errorMessage);
      throw apiError;
    } finally {
      setLoading(false);
    }
  };

  return { resetPassword, loading, error };
};
