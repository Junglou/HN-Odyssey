import AccountSidebar from "../../components/profile/AccountSidebar";
import AddressManagement from "../../components/profile/AddressManagement/AddressManagement"; // Import Component mới đổi tên
import "./AddressManagementPage.css"; // CSS Layout trang
import AddressModal from "../../components/profile/AddressManagement/AddressModal/AddressModal";
import { useAddressManagement } from "../../hooks/profile/useAddressManagement";
import { productList } from "../../hooks/profile/productData";
import type { Product } from "../../types/product";

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

  const getRandomProducts = (count: number = 3): Product[] => {
    const shuffled = [...productList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const recommendations = getRandomProducts();

  return (
    <div className="my-profile-page-container">
      {/* Sidebar (Menu trái) */}
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      {/* Content (Nội dung phải) */}
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
