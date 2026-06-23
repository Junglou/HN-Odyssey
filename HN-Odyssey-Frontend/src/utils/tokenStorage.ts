const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user_info";

const tokenStorage = {
  setToken: (JWT_SECRET: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, JWT_SECRET);
  },
  getToken: (): string | null => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  removeToken: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  },

  setRefreshToken: (token: string): void => {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  getRefreshToken: (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  removeRefreshToken: (): void => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  setUser: <T>(user: T): void => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getUser: <T>(): T | null => {
    const user = localStorage.getItem(USER_KEY);
    try {
      return user ? (JSON.parse(user) as T) : null;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  },
  removeUser: (): void => {
    localStorage.removeItem(USER_KEY);
  },

  clearAuth: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export default tokenStorage;
