import "./AddressManagement.css";
import type { UserProfile, ProductRecommendation, UserAddress } from "../../../types/user";
import RecommendationList from "../../common/RecommendationList";
import AddressBox from "./AddressBox";
import { useNavigate } from "react-router-dom"; // Import useNavigate

interface MyProfileProps {
  user: UserProfile;
  address: UserAddress[];
  recommendations: ProductRecommendation[];
}

const AddressManagement = ({
  address,
  recommendations,
}: MyProfileProps) => {
  const navigate = useNavigate(); // Hook điều hướng

  return (
    <div className="my-profile-card">
      <div className="profile-header">
        <h1 className="profile-title">Address Management</h1>
      </div>

      <div className="address-box-internal-grid">
        {/* CỘT 1: Box quản lý địa chỉ */}
        <div className="grid-section section-address">
          {address.map((items) => (
            <AddressBox address={items}/>
          ))}
          <AddressBox />
        </div>

        {/* CỘT 2: RECOMMENDATIONS */}
        <div className="grid-section section-recs">
          <RecommendationList products={recommendations} />
          <div className="bottom-link-container">
            {/* Gắn link nội bộ */}
            <a className="text-link" onClick={() => navigate("/refund-policy")}>
              Refund Policy
            </a>
            <a className="text-link" onClick={() => navigate("/profile/loyalty")}>
              About Loyalty Plan
            </a>
            <a className="text-link" onClick={() => navigate("/about-us")}>
              About us
            </a>
            <a className="text-link" onClick={() => navigate("/Information-policy")}>
              Information Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddressManagement;
