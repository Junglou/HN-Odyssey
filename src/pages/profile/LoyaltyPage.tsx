import AccountSidebar from "../../components/profile/AccountSidebar";
import Loyalty from "../../components/profile/Loyalty/Loyalty";
import "./LoyaltyPage.css";
import { useProfileManagement } from "../../hooks/profile/useProfileManagement";

const LoyaltyPage = () => {
  const { user } = useProfileManagement();

  return (
    <div className="loyalty-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <Loyalty user={user} />
      </div>
    </div>
  );
};

export default LoyaltyPage;
