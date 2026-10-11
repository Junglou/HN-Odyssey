import { RouterProvider } from "react-router-dom";
import { router } from "./routes";

import { Slide, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import tokenStorage from "./utils/tokenStorage";
import axios from "axios";
import { useEffect } from "react";

function App() {
  // [FIX KIẾN TRÚC]: Silent Sync (Đồng bộ ngầm) quyền của user khi F5
  useEffect(() => {
    const refreshToken = tokenStorage.getRefreshToken();
    // Nếu có token, ta âm thầm xin token mới + quyền mới ngay khi app khởi tạo
    if (refreshToken) {
      axios
        .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        .then((res) => {
          if (res.data?.user) {
            tokenStorage.setUser(res.data.user); // Đồng bộ Permissions
          }
          if (res.data?.access_token) {
            tokenStorage.setToken(res.data.access_token);
          }
          if (res.data?.refresh_token) {
            tokenStorage.setRefreshToken(res.data.refresh_token);
          }
        })
        .catch(() => {
          // Bỏ qua lỗi ngầm, Axios interceptor sẽ tự xử lý nếu cần
        });
    }
  }, []);
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Slide}
        style={{ zIndex: 99999 }} // Đảm bảo luôn nổi trên cùng
      />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
