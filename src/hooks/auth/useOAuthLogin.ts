import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import tokenStorage from "../../utils/tokenStorage";

export const useOAuthLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Lấy thông số từ thanh địa chỉ URL
    const accessToken = searchParams.get("accessToken");
    const error = searchParams.get("error");

    if (accessToken) {
      // 1. Lưu token vào Storage để gọi các API khác sau này
      tokenStorage.setToken(accessToken);

      // (Tùy chọn) Nếu hệ thống cần phân quyền dựa vào Roles ngay lập tức,
      // có thể giải mã token ở đây hoặc gọi 1 API /auth/me để lấy profile user.

      toast.success("Đăng nhập mạng xã hội thành công!");

      // 2. Xóa URL chứa token và đẩy vào trang chủ
      navigate("/", { replace: true });
    } else if (error) {
      // Nếu Backend báo lỗi (ví dụ user từ chối cấp quyền)
      toast.error(`Đăng nhập thất bại: ${decodeURIComponent(error)}`);
      navigate("/login", { replace: true });
    }
  }, [searchParams, navigate]);
};
