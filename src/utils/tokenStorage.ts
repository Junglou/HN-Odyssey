const ACCESS_TOKEN_KEY = "access_token";
const USER_KEY = "user_info";

const tokenStorage = {
  // 1. Token (Chuỗi JWT)
  setToken: (JWT_SECRET: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, JWT_SECRET);
  },
  getToken: (): string | null => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  removeToken: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  },

  // 2. User Info (Lưu thông tin user name, email... để hiển thị nhanh)
  setUser: (user: unknown) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getUser: () => {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },
  removeUser: () => {
    localStorage.removeItem(USER_KEY);
  },

  // 3. Xóa sạch (Dùng khi Logout)
  clearAuth: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export default tokenStorage;
