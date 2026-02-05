import { useState } from "react";
import authService from "../services/auth.service";
// Cập nhật: Import Type từ file types chung để đồng bộ
import type { LoginPayload, LoginResponse } from "../types/auth";

// Định nghĩa kiểu lỗi (Khớp với cấu trúc lỗi từ axiosClient)
export interface ApiError {
  status?: number;
  message: string;
  data?: unknown;
}

export const useLogin = () => {
  // Quản lý State Loading & Error
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Hàm xử lý nghiệp vụ
  // Thêm kiểu trả về Promise<LoginResponse> để rõ ràng hơn
  const login = async (payload: LoginPayload): Promise<LoginResponse> => {
    setLoading(true);
    setError(null);

    try {
      // Gọi Service (Service này đã trả về data thuần, không phải AxiosResponse)
      const data = await authService.login(payload);

      // Trả về data (LoginResponse) cho UI xử lý tiếp (lưu token, redirect...)
      return data;
    } catch (err: unknown) {
      // Chuẩn hóa lỗi
      const apiError = err as ApiError;
      const errorMessage = apiError.message || "Đăng nhập thất bại";

      // Cập nhật UI hiển thị lỗi
      setError(errorMessage);

      // Ném lỗi ra ngoài để Component có thể catch được (ví dụ để hiện Toast)
      throw apiError;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error };
};
