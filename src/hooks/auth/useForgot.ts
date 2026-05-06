import { useState } from "react";
import authService from "../../services/auth.service";

export const useForgot = () => {
  const [loading, setLoading] = useState(false);

  const forgotPassword = async (email: string) => {
    setLoading(true);
    try {
      // GỌI QUA SERVICE THAY VÌ GỌI API TRỰC TIẾP
      const response = await authService.forgotPassword(email);
      return response;
    } finally {
      setLoading(false);
    }
  };

  return { forgotPassword, loading };
};
