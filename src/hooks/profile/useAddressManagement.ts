import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import type { UserAddress } from "../../types/user";
import type { AddressFormData } from "../../components/profile/AddressManagement/AddressModal/AddressModal";
import {
  type CustomerAddressApiResponse,
  mapCustomerAddressFromApi,
  mapFormDataToCreatePayload,
  mapFormDataToUpdatePayload,
} from "../../utils/mapCustomerAddress";
import tokenStorage from "../../utils/tokenStorage";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const getAuthHeaders = () => {
  const token = tokenStorage.getToken();
  return {
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
  };
};

type ModalMode = "add" | "edit" | "view";

interface ModalConfig {
  isOpen: boolean;
  mode: ModalMode;
  editingAddress: UserAddress | null;
  editingIndex: number | null;
}

export function useAddressManagement() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    mode: "add",
    editingAddress: null,
    editingIndex: null,
  });

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/users/addresses`, {
        ...getAuthHeaders(),
      });

      const payload = res.data;
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      const mapped = (list as CustomerAddressApiResponse[]).map(
        mapCustomerAddressFromApi,
      );

      setAddresses(mapped);
    } catch (err: unknown) {
      console.error("Không thể tải địa chỉ:", err);
      if (axios.isAxiosError(err)) {
        const msg =
          (err.response?.data as { message?: string })?.message ||
          err.message ||
          "Lỗi khi tải địa chỉ";
        toast.error(msg);
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
      } else {
        toast.error("Không thể tải địa chỉ.");
      }
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAddresses();
  }, [fetchAddresses]);

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const openAddModal = () => {
    setModalConfig({
      isOpen: true,
      mode: "add",
      editingAddress: null,
      editingIndex: null,
    });
  };

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

  const handleModalSubmit = async (data: AddressFormData) => {
    try {
      if (modalConfig.mode === "add") {
        const body = mapFormDataToCreatePayload(data);
        const res = await axios.post(`${API_URL}/users/addresses`, body, {
          ...getAuthHeaders(),
        });
        toast.success(
          (res.data as { message?: string })?.message ||
            "Thêm địa chỉ mới thành công!",
        );
      } else if (
        modalConfig.mode === "edit" &&
        modalConfig.editingAddress?.id
      ) {
        const body = mapFormDataToUpdatePayload(
          data,
          modalConfig.editingAddress,
        );
        const res = await axios.patch(
          `${API_URL}/users/addresses/${modalConfig.editingAddress.id}`,
          body,
          { ...getAuthHeaders() },
        );
        toast.success(
          (res.data as { message?: string })?.message ||
            "Cập nhật địa chỉ thành công!",
        );
      }
      closeModal();
      await fetchAddresses();
    } catch (err: unknown) {
      console.error("Lỗi lưu địa chỉ:", err);
      if (axios.isAxiosError(err)) {
        const msg =
          (err.response?.data as { message?: string })?.message ||
          err.message ||
          "Không thể lưu địa chỉ";
        toast.error(msg);
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
      } else {
        toast.error("Không thể lưu địa chỉ.");
      }
    }
  };

  const deleteAddress = async (index: number) => {
    const target = addresses[index];
    if (!target?.id) return;

    try {
      const res = await axios.delete(
        `${API_URL}/users/addresses/${target.id}`,
        { ...getAuthHeaders() },
      );
      toast.success(
        (res.data as { message?: string })?.message ||
          "Đã xóa địa chỉ thành công!",
      );
      await fetchAddresses();
    } catch (err: unknown) {
      console.error("Lỗi xóa địa chỉ:", err);
      if (axios.isAxiosError(err)) {
        const msg =
          (err.response?.data as { message?: string })?.message ||
          err.message ||
          "Không thể xóa địa chỉ";
        toast.error(msg);
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
      } else {
        toast.error("Không thể xóa địa chỉ.");
      }
    }
  };

  return {
    addresses,
    loading,
    modalConfig,
    closeModal,
    openAddModal,
    openEditModal,
    openViewModal,
    handleModalSubmit,
    deleteAddress,
    refresh: fetchAddresses,
  };
}

export const useAddressManager = useAddressManagement;
