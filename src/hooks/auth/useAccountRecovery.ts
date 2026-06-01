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
      if (!payload.evidence) {
        throw new Error("Vui lòng đính kèm file xác minh (hình ảnh/tài liệu).");
      }

      const formData = new FormData();

      // Mapping đúng 100% với DTO của Backend bằng các key mới
      formData.append("target_account", payload.target_account);
      formData.append("contact_email", payload.contact_email);
      formData.append("reason", payload.reason);

      // Chắc chắn append vào trường "images" khớp với @UseInterceptors(FilesInterceptor('images', 3)) của Backend
      formData.append("images", payload.evidence);

      // Gọi Service
      await authService.requestAccountRecovery(formData);
      return true;
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const message = Array.isArray(apiError.response?.data?.message)
        ? apiError.response?.data?.message[0]
        : apiError.response?.data?.message || apiError.message;

      const errorMessage = message || "Gửi yêu cầu thất bại.";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { submitRequest, loading, error };
};
