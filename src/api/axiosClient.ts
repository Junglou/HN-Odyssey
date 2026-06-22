import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import tokenStorage from "../utils/tokenStorage";

const axiosClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

// Yêu cầu Interceptor
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Trả về Interceptor
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 (Unauthorized) và không phải URL login/refresh => Xử lý
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/login"
    ) {
      originalRequest._retry = true;
      const refreshToken = tokenStorage.getRefreshToken();

      if (refreshToken) {
        try {
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL}/auth/refresh`,
            { refresh_token: refreshToken },
          );

          if (res.data?.access_token) {
            tokenStorage.setToken(res.data.access_token);
            if (res.data.refresh_token) {
              tokenStorage.setRefreshToken(res.data.refresh_token);
            }
            originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
            return axiosClient(originalRequest);
          }
        } catch (refreshError) {
          tokenStorage.clearAuth();
          window.location.href = "/login";
          return Promise.reject(refreshError);
        }
      } else {
        // ---- ĐÂY LÀ PHẦN LÀM LẠI ĐỂ CỨU NÚT EXPLORE ----
        tokenStorage.clearAuth();

        // 1. Lấy đường dẫn hiện tại của trình duyệt
        const currentPath = window.location.pathname;

        // 2. Liệt kê các khu vực BẮT BUỘC phải đăng nhập (Private Routes)
        const protectedRoutes = ["/profile", "/portal", "/checkout"];

        // 3. Kiểm tra xem người dùng có đang đứng ở Private Route không
        const isProtectedRoute = protectedRoutes.some((route) =>
          currentPath.startsWith(route),
        );

        // 4. CHỈ ĐÁ VỀ LOGIN NẾU ĐANG CỐ TÌNH TRUY CẬP VÙNG CẤM
        if (isProtectedRoute) {
          window.location.href = "/login";
        }
        // NẾU ĐANG Ở TRANG CHỦ / HOẶC TRANG PUBLIC -> Bỏ qua, chỉ trả về lỗi để UI xử lý (giữ nguyên khách vãng lai ở đó)

        return Promise.reject(error);
      }
    }

    const normalizedError = {
      status: error.response?.status,
      message:
        error.response?.data?.message || error.message || "Unknown error",
      data: error.response?.data,
    };

    return Promise.reject(normalizedError);
  },
);

export default axiosClient;
