import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

const axiosClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // Timeout sau 10 giây
});

// Yêu cầu Interceptor
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Gắn token nếu có
    const token = localStorage.getItem("accessToken");
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
  (error) => {
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
