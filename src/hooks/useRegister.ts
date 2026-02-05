import { useState } from "react";
import authService from "../services/auth.service"; // Import service vừa sửa
import type { RegisterPayload } from "../types/auth";

export interface ApiError {
  status?: number;
  message: string;
  data?: unknown;
}

export const useRegister = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = async (payload: RegisterPayload) => {
    setLoading(true);
    setError(null);

    try {
      // Gọi hàm register từ Service
      const data = await authService.register(payload);
      return data;
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || "Đăng ký thất bại";
      setError(errorMessage);
      throw apiError;
    } finally {
      setLoading(false);
    }
  };

  return { register, loading, error };
};
