// src/hooks/useForgot.ts
import { useState } from "react";
import axiosClient from "../api/axiosClient"; // Đảm bảo đường dẫn này đúng với dự án của bạn

export const useForgot = () => {
  const [loading, setLoading] = useState(false);

  // Hàm xử lý logic gọi API
  const forgotPassword = async (email: string) => {
    setLoading(true);
    try {
      // GỌI API THẬT
      const response = await axiosClient.post("/auth/forgot-password", {
        email,
      });

      // Trả về dữ liệu từ server (thường là message success)
      return response.data;
    } finally {
      // Block này luôn chạy để tắt loading dù API thành công hay thất bại
      setLoading(false);
    }
  };

  return { forgotPassword, loading };
};
