import AccountSidebar from "../../components/profile/AccountSidebar";
import RecentView from "../../components/profile/RecentView/RecentView";
import "./RecentViewPage.css";
import { useRecentViewManagement } from "../../hooks/profile/useRecentViewManagement";
import { useRecommendProduct } from "../../hooks/profile/useRecommendProduct";

const RecentViewPage = () => {
  const { recentView, loading, pagination, actions } =
    useRecentViewManagement();
  const { products: recommendations } = useRecommendProduct();

  return (
    <div className="recent-view-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <RecentView
          recentView={recentView}
          recommendations={recommendations}
          loading={loading}
          pagination={pagination}
          onPageChange={(p) => actions.changePage(p)}
        />
      </div>
    </div>
  );
};

export default RecentViewPage;
