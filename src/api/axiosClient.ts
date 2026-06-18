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

    // Nếu lỗi 401 (Unauthorized) và không phải URL login/refresh => Xử lý Refresh Token
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/login"
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = tokenStorage.getRefreshToken(); // Cần đảm bảo util lưu được Refresh Token
        if (refreshToken) {
          // Khởi tạo call axios trực tiếp để tránh vòng lặp chặn interceptor
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL}/auth/refresh`,
            {
              refresh_token: refreshToken,
            },
          );

          if (res.data?.access_token) {
            tokenStorage.setToken(res.data.access_token);

            // Bổ sung: Cập nhật lại cả refresh_token nếu BE có cấp lại mã mới
            if (res.data.refresh_token) {
              tokenStorage.setRefreshToken(res.data.refresh_token);
            }

            originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
            return axiosClient(originalRequest); // Gọi lại API bị tạch
          }
        }
      } catch (refreshError) {
        // Refresh token cũng chết => Log out user hoàn toàn
        tokenStorage.clearAuth();
        window.location.href = "/login";
        return Promise.reject(refreshError);
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
