import { useState } from "react";
import authService from "../services/auth.service";
import type { ConfirmRecoveryPayload } from "../types/auth";

export const useAccountRecoVerified = () => {
  const [loading, setLoading] = useState(false);

  const confirmRecovery = async (payload: ConfirmRecoveryPayload) => {
    setLoading(true);
    try {
      // Gọi service
      const response = await authService.confirmAccountRecovery(payload);
      return response;
    } finally {
      setLoading(false);
    }
  };

  return { confirmRecovery, loading };
};
