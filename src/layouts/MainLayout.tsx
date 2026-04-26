import { Outlet } from "react-router-dom";
import Header from "../components/common/Header";
import PromotionBar from "../components/common/PromotionBar";
import Footer from "../components/common/Footer";

const MainLayout = () => {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {/* Promotion Bar phải nằm ở đây */}
      <PromotionBar />

      {/* Header nằm ngay dưới */}
      <Header />

      {/* Nội dung các trang */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Footer ở cuối cùng */}
      <Footer />
    </div>
  );
};

export default MainLayout;
