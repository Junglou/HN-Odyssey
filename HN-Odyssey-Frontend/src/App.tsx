import { RouterProvider } from "react-router-dom";
import { router } from "./routes";

import { Slide, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  // RouterProvider nhận router instance đã định nghĩa ở src/routes/index.tsx
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
