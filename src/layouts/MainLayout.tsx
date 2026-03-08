// src/layouts/MainLayout.tsx
import { Outlet } from "react-router-dom";
import Header from "../components/common/Header";
import PromotionBar from "../components/common/PromotionBar";
import Footer from "../components/common/Footer";

const MainLayout = () => {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {/* 1. Promotion Bar phải nằm ở đây */}
      <PromotionBar />

      {/* 2. Header nằm ngay dưới */}
      <Header />

      {/* 3. Nội dung các trang */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* 4. Footer ở cuối cùng */}
      <Footer />
    </div>
  );
};

export default MainLayout;
