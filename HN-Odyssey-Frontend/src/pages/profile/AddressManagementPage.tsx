import "./ProfilePageLayout.css";
import "./AddressManagementPage.css";

import AccountSidebar from "../../components/profile/AccountSidebar";
import AddressManagement from "../../components/profile/AddressManagement/AddressManagement";
import AddressModal from "../../components/profile/AddressManagement/AddressModal/AddressModal";
import { useAddressManagement } from "../../hooks/profile/useAddressManagement";
import { useRecommendProduct } from "../../hooks/profile/useRecommendProduct";

const AddressMangementPage = () => {
  const {
    addresses,
    modalConfig,
    formData,
    provinces,
    districts,
    wards,
    openAddModal,
    openEditModal,
    deleteAddress,
    closeModal,
    handleModalSubmit,
    handleChange,
  } = useAddressManagement();

  const { products: recommendations } = useRecommendProduct();

  return (
    <div className="my-profile-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <AddressManagement
          address={addresses}
          recommendations={recommendations}
          onAddAddress={openAddModal}
          onEditAddress={openEditModal}
          onDeleteAddress={deleteAddress}
        />

        <AddressModal
          isOpen={modalConfig.isOpen}
          mode={modalConfig.mode}
          onClose={closeModal}
          onSubmit={handleModalSubmit}
          // Truyền các biến từ hook xuống Modal
          formData={formData}
          provinces={provinces}
          districts={districts}
          wards={wards}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default AddressMangementPage;
