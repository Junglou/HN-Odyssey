import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import tokenStorage from "../utils/tokenStorage";

export const SESSION_REVOKED = "SESSION_REVOKED";
export const AUTH_NOTICE_KEY = "auth_notice";

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface ApiErrorBody {
  message?: string;
  error_code?: string;
}

// Các khu vực bắt buộc đăng nhập
const PROTECTED_ROUTES = ["/profile", "/portal", "/checkout"];

// Đăng xuất cưỡng bức, lưu lý do để trang login hiển thị sau khi tải lại
const forceLogoutWithNotice = (message?: string) => {
  tokenStorage.clearAuth();
  sessionStorage.setItem(
    AUTH_NOTICE_KEY,
    message || "Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.",
  );
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

const normalizeError = (error: AxiosError<ApiErrorBody>) => ({
  status: error.response?.status,
  message: error.response?.data?.message || error.message || "Unknown error",
  data: error.response?.data,
});

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
  (error) => Promise.reject(error),
);

// Chỉ cho phép 1 request refresh tại một thời điểm.
// Các request 401 xảy ra cùng lúc sẽ chờ chung kết quả của lần refresh này.
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {
        refresh_token: tokenStorage.getRefreshToken(),
      })
      .then((res) => {
        const data = res.data;
        if (!data?.access_token) {
          throw new Error("Refresh không trả về access token");
        }
        tokenStorage.setToken(data.access_token);
        if (data.refresh_token)
          tokenStorage.setRefreshToken(data.refresh_token);
        if (data.user) tokenStorage.setUser(data.user); // cập nhật permissions mới nhất
        return data.access_token as string;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Trả về Interceptor
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    const status = error.response?.status;
    const body = error.response?.data;

    // 1. Phiên đã bị thu hồi -> đăng xuất ngay, không thử refresh
    if (status === 401 && body?.error_code === SESSION_REVOKED) {
      forceLogoutWithNotice(body.message);
      return Promise.reject(normalizeError(error));
    }

    // 2. Access token hết hạn -> refresh rồi gọi lại request
    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/login"
    ) {
      originalRequest._retry = true;

      // Tab khác đã refresh xong -> dùng luôn token mới, không refresh lại
      const sentToken = String(
        originalRequest.headers?.Authorization || "",
      ).replace("Bearer ", "");
      const currentToken = tokenStorage.getToken();
      if (currentToken && sentToken && currentToken !== sentToken) {
        originalRequest.headers.Authorization = `Bearer ${currentToken}`;
        return axiosClient(originalRequest);
      }

      if (tokenStorage.getRefreshToken()) {
        try {
          const newAccessToken = await refreshAccessToken();
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosClient(originalRequest);
        } catch (refreshError) {
          const refreshBody = axios.isAxiosError(refreshError)
            ? (refreshError.response?.data as ApiErrorBody | undefined)
            : undefined;

          if (refreshBody?.error_code === SESSION_REVOKED) {
            forceLogoutWithNotice(refreshBody.message);
          } else {
            tokenStorage.clearAuth();
            window.location.href = "/login";
          }
          return Promise.reject(normalizeError(error));
        }
      }

      // 3. Không có refresh token: chỉ đá về login nếu đang ở khu vực bắt buộc đăng nhập
      tokenStorage.clearAuth();
      const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
        window.location.pathname.startsWith(route),
      );
      if (isProtectedRoute) {
        window.location.href = "/login";
      }
      return Promise.reject(normalizeError(error));
    }

    return Promise.reject(normalizeError(error));
  },
);

export default axiosClient;
