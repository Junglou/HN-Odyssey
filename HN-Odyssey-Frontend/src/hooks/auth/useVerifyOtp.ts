import { useState, useEffect } from "react";
import authService from "../../services/auth.service";
import type { VerifyOtpPayload, ResendOtpPayload } from "../../types/auth";
import { toast } from "react-toastify";

export interface ApiError {
  message: string;
}

export const useVerifyOtp = () => {
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  // Logic Đếm ngược
  useEffect(() => {
    // Tự động lấy kiểu dữ liệu trả về của setInterval
    let interval: ReturnType<typeof setInterval> | undefined;

    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }

    // Lúc này clearInterval sẽ chấp nhận biến interval mà không báo lỗi
    return () => clearInterval(interval);
  }, [timer]);

  // Xử lý Xác thực (Verify)
  const verify = async (payload: VerifyOtpPayload) => {
    setLoading(true);
    try {
      await authService.verifyOtp(payload);
      return true;
    } catch (err: unknown) {
      const apiError = err as ApiError;
      toast.error(apiError.message || "Mã OTP không chính xác hoặc đã hết hạn");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Xử lý Gửi lại mã (Resend)
  // Nhận vào payload object {email?} hoặc {phoneNumber?}
  const resend = async (payload: ResendOtpPayload) => {
    if (timer > 0) return; // Đang đếm ngược thì không gửi

    setLoading(true);
    try {
      await authService.resendOtp(payload);
      toast.success("Đã gửi lại mã OTP!");
      setTimer(60); // Reset bộ đếm 60s
    } catch (err: unknown) {
      const apiError = err as ApiError;
      toast.error(
        apiError.message || "Không thể gửi lại mã. Vui lòng thử lại sau.",
      );
    } finally {
      setLoading(false);
    }
  };

  return { verify, resend, loading, timer };
};
