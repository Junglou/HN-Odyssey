import "./AddressManagement.css";
import type { UserAddress } from "../../../types/user";
import RecommendationList from "../../common/RecommendationList";
import AddressBox from "./AddressBox";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import type { Product } from "../../../types/product";

interface AddressProps {
  address: UserAddress[];
  recommendations: Product[];
  onAddAddress?: () => void;
  onEditAddress?: (index: number) => void;
  onDeleteAddress?: (index: number) => void;
}

const AddressManagement = ({
  address,
  recommendations,
  onAddAddress,
  onEditAddress,
  onDeleteAddress,
}: AddressProps) => {
  const navigate = useNavigate(); // Hook điều hướng

  return (
    <div className="my-profile-card">
      <div className="profile-header">
        <h1 className="profile-title">Address Management</h1>
      </div>

      <div className="address-box-internal-grid">
        {/* CỘT 1: Box quản lý địa chỉ */}
        <div className="grid-section section-address">
          {address.map((items, index) => (
            <AddressBox
              key={index}
              address={items}
              index={index}
              onEdit={onEditAddress}
              onDelete={onDeleteAddress}
            />
          ))}
          <AddressBox onAdd={onAddAddress} />
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
