import { useState } from "react";
import authService from "../../services/auth.service";
import type { AccountRecoveryPayload } from "../../types/auth";

export interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

export const useAccountRecovery = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitRequest = async (payload: AccountRecoveryPayload) => {
    setLoading(true);
    setError(null);

    try {
      // Chuyển đổi Object sang FormData để gửi File
      const formData = new FormData();
      formData.append("email", payload.email);
      formData.append("otpCode", payload.otpCode);
      formData.append("description", payload.description);

      if (payload.evidence) {
        formData.append("evidence", payload.evidence);
      }

      // Gọi Service
      await authService.requestAccountRecovery(formData);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const errorMessage =
        apiError.response?.data?.message ||
        apiError.message ||
        "Gửi yêu cầu thất bại.";

      setError(errorMessage);
      throw apiError;
    } finally {
      setLoading(false);
    }
  };

  return { submitRequest, loading, error };
};
