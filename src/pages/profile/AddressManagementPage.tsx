import AccountSidebar from "../../components/profile/AccountSidebar";
import AddressManagement from "../../components/profile/AddressManagement/AddressManagement";
import "./AddressManagementPage.css";
import AddressModal from "../../components/profile/AddressManagement/AddressModal/AddressModal";
import { useAddressManagement } from "../../hooks/profile/useAddressManagement";
import { useRecommendProduct } from "../../hooks/profile/useRecommendProduct";

const AddressMangementPage = () => {
  const {
    addresses,
    modalConfig,
    openAddModal,
    openEditModal,
    deleteAddress,
    closeModal,
    handleModalSubmit,
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
          initialData={modalConfig.editingAddress}
          onClose={closeModal}
          onSubmit={handleModalSubmit}
        />
      </div>
    </div>
  );
};

export default AddressMangementPage;
