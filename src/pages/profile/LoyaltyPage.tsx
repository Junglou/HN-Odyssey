import AccountSidebar from "../../components/profile/AccountSidebar";
import Loyalty from "../../components/profile/Loyalty/Loyalty";
import "./LoyaltyPage.css";
import { useLoyaltyManagement } from "../../hooks/profile/useLoyaltyManagement";

const LoyaltyPage = () => {
  const { user, loyaltyInfo, history, loading } = useLoyaltyManagement();

  if (loading) {
    return (
      <div className="my-loyalty-page-container">
        <div className="sidebar-wrapper">
          <AccountSidebar />
        </div>
        <div className="content-wrapper loyalty-page-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="my-loyalty-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <Loyalty user={user} loyaltyInfo={loyaltyInfo} history={history} />
      </div>
    </div>
  );
};

export default LoyaltyPage;
