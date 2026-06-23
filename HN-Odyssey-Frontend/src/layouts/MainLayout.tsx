// imports
import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/common/Header";
import PromotionBar from "../components/common/PromotionBar";
import Footer from "../components/common/Footer";
import FloatingToolbox from "../components/common/FloatingToolbox/FloatingToolbox";
import "./MainLayout.css";

// layout
const MainLayout = () => {
  // hook
  const location = useLocation();

  // render
  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {/* promo bar */}
      <PromotionBar />

      {/* header */}
      <Header />

      {/* page content */}
      <main
        key={location.pathname}
        className="main-content-area"
        style={{ flex: 1 }}
      >
        <Outlet />
      </main>

      {/* footer */}
      <Footer />

      {/* floating tools */}
      <FloatingToolbox />
    </div>
  );
};

export default MainLayout;
