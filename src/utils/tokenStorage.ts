const TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken"; // Bổ sung key cho Refresh Token
const USER_KEY = "user";

const tokenStorage = {
  // --- ACCESS TOKEN ---
  setToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  },
  removeToken: () => {
    localStorage.removeItem(TOKEN_KEY);
  },

  // --- REFRESH TOKEN (BỔ SUNG) ---
  setRefreshToken: (token: string) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  getRefreshToken: () => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  removeRefreshToken: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  // --- USER INFO ---
  setUser: (user: unknown) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUser: (): any => {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },
  removeUser: () => {
    localStorage.removeItem(USER_KEY);
  },

  // --- CLEAR ALL ---
  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY); // Xóa luôn Refresh Token khi logout
    localStorage.removeItem(USER_KEY);
  },
};

export default tokenStorage;
