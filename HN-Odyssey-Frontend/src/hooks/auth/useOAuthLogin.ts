import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import tokenStorage from "../../utils/tokenStorage";

export const useOAuthLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const userParam = searchParams.get("user");
    const error = searchParams.get("error");

    if (accessToken && userParam) {
      // 1. Lưu Access Token
      tokenStorage.setToken(accessToken);

      // 2. Lưu Refresh Token (Cực kỳ quan trọng để Interceptor hoạt động)
      if (refreshToken) {
        tokenStorage.setRefreshToken(refreshToken);
      }

      // 3. Giải mã URL và lưu User
      try {
        const decodedUser = JSON.parse(decodeURIComponent(userParam));
        tokenStorage.setUser(decodedUser);
      } catch (err) {
        console.error("Lỗi parse thông tin user từ OAuth:", err);
      }

      toast.success("Đăng nhập mạng xã hội thành công!");
      navigate("/", { replace: true });
    } else if (error) {
      toast.error(`Đăng nhập thất bại: ${decodeURIComponent(error)}`);
      navigate("/login", { replace: true });
    }
  }, [searchParams, navigate]);
};
