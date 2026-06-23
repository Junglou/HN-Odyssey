import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import type { UserAddress } from "../../types/user";
import { mapCustomerAddressFromApi } from "../../utils/mapCustomerAddress";

// Định nghĩa cấu trúc dữ liệu địa lý của GHN
export interface LocationItem {
  code: string;
  name: string;
  name_with_type?: string;
}

// Định nghĩa State cho Form theo chuẩn Backend DTO (AC1, AC2, AC3)
export interface AddressFormState {
  name: string;
  phone: string;
  street: string;
  provinceCode: string;
  districtCode: string;
  wardCode: string;
  isDefault: boolean;
}

type ModalMode = "add" | "edit" | "view";

interface ModalConfig {
  isOpen: boolean;
  mode: ModalMode;
  editingAddress: UserAddress | null;
  editingIndex: number | null;
}

// Chuẩn hóa Error từ interceptor trả về để né strict 'any' của ESLint
interface NormalizedError {
  status?: number;
  message?: string;
  data?: unknown;
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

  // States quản lý Dropdown địa lý GHN
  const [provinces, setProvinces] = useState<LocationItem[]>([]);
  const [districts, setDistricts] = useState<LocationItem[]>([]);
  const [wards, setWards] = useState<LocationItem[]>([]);

  // Controlled State quản lý Form Data
  const [formData, setFormData] = useState<AddressFormState>({
    name: "",
    phone: "",
    street: "",
    provinceCode: "",
    districtCode: "",
    wardCode: "",
    isDefault: false,
  });

  // --- GET ADDRESSES ---
  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/users/addresses");

      const payload = res.data;
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      const mapped = list.map(mapCustomerAddressFromApi);
      setAddresses(mapped);
    } catch (error: unknown) {
      const err = error as NormalizedError;
      console.error("Không thể tải địa chỉ:", err);
      toast.error(err.message || "Đã xảy ra lỗi khi tải sổ địa chỉ.");
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAddresses();
  }, [fetchAddresses]);

  // --- GHN LOGIC: FETCH PROVINCES ---
  useEffect(() => {
    axiosClient
      .get("/shipping/locations/provinces")
      .then((res) => setProvinces(res.data || []))
      .catch(console.error);
  }, []);

  // --- GHN LOGIC: FETCH DISTRICTS KHI PROVINCE THAY ĐỔI ---
  useEffect(() => {
    if (formData.provinceCode) {
      axiosClient
        .get(`/shipping/locations/districts/${formData.provinceCode}`)
        .then((res) => setDistricts(res.data || []))
        .catch(() => setDistricts([]));
    } else {
      setDistricts([]);
      setWards([]);
    }
  }, [formData.provinceCode]);

  // --- GHN LOGIC: FETCH WARDS KHI DISTRICT THAY ĐỔI ---
  useEffect(() => {
    if (formData.districtCode) {
      axiosClient
        .get(`/shipping/locations/wards/${formData.districtCode}`)
        .then((res) => setWards(res.data || []))
        .catch(() => setWards([]));
    } else {
      setWards([]);
    }
  }, [formData.districtCode]);

  // --- HANDLERS ---
  const handleChange = (
    field: keyof AddressFormState,
    value: string | boolean,
  ) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      // Logic reset chuỗi dữ liệu (hệ quả kéo theo) khi đổi địa điểm gốc
      if (field === "provinceCode") {
        newData.districtCode = "";
        newData.wardCode = "";
      } else if (field === "districtCode") {
        newData.wardCode = "";
      }
      return newData;
    });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const openAddModal = () => {
    setFormData({
      name: "",
      phone: "",
      street: "",
      provinceCode: "",
      districtCode: "",
      wardCode: "",
      isDefault: addresses.length === 0, // Dựa theo rule backend (AC5): nếu danh sách trống, ép thành mặc định
    });
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

    setFormData({
      name: address.receiverName,
      phone: address.phone, // Đã lấy ở fetch
      street: address.address,
      provinceCode: address.cityCode,
      districtCode: address.districtCode,
      wardCode: address.wardCode,
      isDefault: address.isDefault,
    });

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

    setFormData({
      name: address.receiverName,
      phone: address.phone,
      street: address.address,
      provinceCode: address.cityCode,
      districtCode: address.districtCode,
      wardCode: address.wardCode,
      isDefault: address.isDefault,
    });

    setModalConfig({
      isOpen: true,
      mode: "view",
      editingAddress: address,
      editingIndex: index,
    });
  };

  const handleModalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 1. Validation Null
    if (
      !formData.name.trim() ||
      !formData.street.trim() ||
      !formData.provinceCode ||
      !formData.districtCode ||
      !formData.wardCode
    ) {
      toast.warning("Vui lòng điền đầy đủ các thông tin bắt buộc (*)");
      return;
    }

    // 2. Validation SĐT chuẩn nhà mạng VN (Theo AC3 CreateAddressDto)
    const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
    if (!phoneRegex.test(formData.phone)) {
      toast.warning(
        "Số điện thoại không hợp lệ (Phải là 10 số và bắt đầu bằng đầu số VN).",
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        street: formData.street.trim(),
        city_code: formData.provinceCode,
        district_code: formData.districtCode,
        ward_code: formData.wardCode,
        is_default: formData.isDefault,
      };

      if (modalConfig.mode === "add") {
        const res = await axiosClient.post("/users/addresses", payload);
        toast.success(
          (res.data as { message?: string })?.message ||
            "Thêm địa chỉ mới thành công!",
        );
      } else if (
        modalConfig.mode === "edit" &&
        modalConfig.editingAddress?.id
      ) {
        const res = await axiosClient.patch(
          `/users/addresses/${modalConfig.editingAddress.id}`,
          payload,
        );
        toast.success(
          (res.data as { message?: string })?.message ||
            "Cập nhật địa chỉ thành công!",
        );
      }

      closeModal();
      await fetchAddresses();
    } catch (error: unknown) {
      const err = error as NormalizedError;
      console.error("Lỗi lưu địa chỉ:", err);
      toast.error(err.message || "Không thể lưu địa chỉ.");
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (index: number) => {
    const target = addresses[index];
    if (!target?.id) return;

    // Backend (AC7): Không cho phép xóa địa chỉ mặc định
    if (target.isDefault) {
      toast.warning("Không thể xóa địa chỉ đang được đặt làm mặc định.");
      return;
    }

    try {
      const res = await axiosClient.delete(`/users/addresses/${target.id}`);
      toast.success(
        (res.data as { message?: string })?.message ||
          "Đã xóa địa chỉ thành công!",
      );
      await fetchAddresses();
    } catch (error: unknown) {
      const err = error as NormalizedError;
      console.error("Lỗi xóa địa chỉ:", err);
      toast.error(err.message || "Không thể xóa địa chỉ.");
    }
  };

  return {
    addresses,
    loading,
    modalConfig,
    formData,
    provinces,
    districts,
    wards,
    closeModal,
    openAddModal,
    openEditModal,
    openViewModal,
    handleModalSubmit,
    deleteAddress,
    handleChange,
    refresh: fetchAddresses,
  };
}

export const useAddressManager = useAddressManagement;
