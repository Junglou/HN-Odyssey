import AccountSidebar from "../../components/profile/AccountSidebar";
import MyProfile from "../../components/profile/MyProfile";
import "./MyProfilePage.css";
import { useRecommendProduct } from "../../hooks/profile/useRecommendProduct";

const MyProfilePage = () => {
  const { products: recommendations } = useRecommendProduct();

  return (
    <div className="my-profile-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <MyProfile recommendations={recommendations} />
      </div>
    </div>
  );
};

export default MyProfilePage;
