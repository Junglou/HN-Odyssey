import type { UserAddress } from "../../../types/user";
import "./AddressBox.css";

interface AddressBoxProp {
  address?: UserAddress;
  index?: number;
  onAdd?: () => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}

const AddressBox = ({
  address,
  index,
  onAdd,
  onEdit,
  onDelete,
}: AddressBoxProp) => {
  {
    if (address == null) {
      return (
        <div className="address-box-container">
          <div className="add-address-box-btn-container">
            <button className="add-new-address-btn" onClick={onAdd}>
              +
            </button>
          </div>
          <div className="add-new-address-txt-container">
            <span className="lbl-text">Add new address</span>
          </div>
        </div>
      );
    }
  }
  return (
    <div className="address-box-container">
      <div className="address-box-content">
        <div className="address-box-infor">
          <div className="name-container">
            <span className="lbl-text">{address.receiverName}</span>
          </div>
          <div className="address-container">
            <span className="lbl-text">Address: </span>
            <span>{address.address}</span>
          </div>
          <div className="city-container">
            <span className="lbl-text">City: </span>
            <span>{address.city}</span>
          </div>
          <div className="country-container">
            <span className="lbl-text">Country: </span>
            <span>{address.country}</span>
          </div>
        </div>
        <div className="address-box-btn-container">
          <button
            className="address-box-edit-btn"
            onClick={() => index !== undefined && onEdit?.(index)}
          >
            Edit
          </button>
          <button
            className="address-box-remove-btn"
            onClick={() => index !== undefined && onDelete?.(index)}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressBox;
