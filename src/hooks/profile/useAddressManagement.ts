import { useState } from "react";
import { toast } from "react-toastify";
import type { UserAddress } from "../../types/user";
import type { AddressFormData } from "../../components/profile/AddressManagement/AddressModal/AddressModal";
import { INITIAL_MOCK_USERS } from "./userData";

// mock data
export const INITIAL_MOCK_ADDRESS = INITIAL_MOCK_USERS.userAddresses || [];

type ModalMode = "add" | "edit" | "view";

interface ModalConfig {
  isOpen: boolean;
  mode: ModalMode;
  editingAddress: UserAddress | null;
  editingIndex: number | null;
}

export function useAddressManagement() {
  // Các state chính
  const [addresses, setAddresses] =
    useState<UserAddress[]>(INITIAL_MOCK_ADDRESS);

  // Các state điều khiển popup modal
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    mode: "add",
    editingAddress: null,
    editingIndex: null,
  });

  // Hàm đóng modal
  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // Mở modal để thêm địa chỉ mới
  const openAddModal = () => {
    setModalConfig({
      isOpen: true,
      mode: "add",
      editingAddress: null,
      editingIndex: null,
    });
  };

  // Mở modal để chỉnh sửa địa chỉ
  const openEditModal = (index: number) => {
    const address = addresses[index];
    if (!address) return;

    setModalConfig({
      isOpen: true,
      mode: "edit",
      editingAddress: address,
      editingIndex: index,
    });
  };

  // Mở modal để xem địa chỉ
  const openViewModal = (index: number) => {
    const address = addresses[index];
    if (!address) return;

    setModalConfig({
      isOpen: true,
      mode: "view",
      editingAddress: address,
      editingIndex: index,
    });
  };

  // Hàm nhận dữ liệu Modal => update lại
  const handleModalSubmit = (data: AddressFormData) => {
    if (modalConfig.mode === "add") {
      const newAddress: UserAddress = {
        receiverName: data.receiverName,
        address: data.address,
        city: data.city,
        country: data.country,
      };
      setAddresses([newAddress, ...addresses]);
      toast.success("Thêm địa chỉ mới thành công!");
    } else if (
      modalConfig.mode === "edit" &&
      modalConfig.editingIndex !== null
    ) {
      const updatedAddress: UserAddress = {
        receiverName: data.receiverName,
        address: data.address,
        city: data.city,
        country: data.country,
      };
      setAddresses(
        addresses.map((address, index) =>
          index === modalConfig.editingIndex ? updatedAddress : address,
        ),
      );
      toast.success("Cập nhật địa chỉ thành công!");
    }
    closeModal();
  };

  // Xóa địa chỉ đơn lẻ
  const deleteAddress = (index: number) => {
    setAddresses(addresses.filter((_, i) => i !== index));
    toast.success("Đã xóa địa chỉ thành công!");
  };

  return {
    addresses,
    modalConfig,
    closeModal,
    openAddModal,
    openEditModal,
    openViewModal,
    handleModalSubmit,
    deleteAddress,
  };
}

export const useAddressManager = useAddressManagement;
