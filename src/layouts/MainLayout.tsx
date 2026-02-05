import { Outlet } from "react-router-dom";

const MainLayout = () => {
  return (
    <div className="main-layout">
      {/* Header / Sidebar đặt ở đây */}
      <header>My Header</header>

      <main>
        {/* Outlet là nơi nội dung của DashboardPage/ProductListPage sẽ hiển thị */}
        <Outlet />
      </main>

      {/* Footer đặt ở đây */}
    </div>
  );
};

export default MainLayout;
