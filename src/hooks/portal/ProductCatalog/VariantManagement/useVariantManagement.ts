import { useState, useRef, useMemo } from "react";
import { toast } from "react-toastify";

// prop và type cho biến thể
export type VariantStatus = "Active" | "Inactive";

export interface Variant {
  id: number;
  name: string;
  values: string[];
  status: VariantStatus;
}

export interface VariantFormData {
  name: string;
  values: string;
  status: VariantStatus;
}

// mock data ban đầu
const INITIAL_VARIANTS: Variant[] = [
  {
    id: 1,
    name: "Size",
    values: ["Small(S)", "Medium(M)", "Large(L)", "Extra Large(XL)"],
    status: "Active",
  },
  {
    id: 2,
    name: "Color",
    values: ["Red", "Blue", "Green", "Black", "White"],
    status: "Active",
  },
  {
    id: 3,
    name: "Material",
    values: ["Cotton", "Polyester", "Silk"],
    status: "Inactive",
  },
  {
    id: 4,
    name: "Style",
    values: ["Casual", "Formal", "Sport"],
    status: "Active",
  },
];

const parseVariantValues = (valuesStr: string): string[] => {
  const parsed = valuesStr
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return Array.from(new Set(parsed));
};

// kiểm tra dữ liệu trước khi lưu
const validateVariant = (data: VariantFormData): boolean => {
  return data.name.trim().length > 0 && data.values.trim().length > 0;
};

export function useVariantManagement() {
  const [variants, setVariants] = useState<Variant[]>(INITIAL_VARIANTS);
  const [search, setSearch] = useState<string>("");
  const nextIdCounter = useRef<number>(5);

  // quản lý trạng thái drawer thêm/sửa
  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    editingVariant: Variant | null;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", editingVariant: null, isSubmitting: false });

  // quản lý popup xác nhận xóa
  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    variantId: number | null;
    isDeleting: boolean;
  }>({ isOpen: false, variantId: null, isDeleting: false });

  // search filter
  const filteredVariants = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return variants;

    return variants.filter((v) => {
      const matchName = v.name.toLowerCase().includes(normalizedSearch);
      const matchValues = v.values.some((val) =>
        val.toLowerCase().includes(normalizedSearch),
      );
      return matchName || matchValues;
    });
  }, [variants, search]);

  // thao tác thay đổi search, mở/đóng drawer, mở popup xóa
  const actions = {
    changeSearch: (val: string) => setSearch(val),

    openDrawer: (mode: "add" | "edit", variant?: Variant) => {
      setDrawerConfig({
        isOpen: true,
        mode,
        editingVariant: variant || null,
        isSubmitting: false,
      });
    },

    closeDrawer: () => {
      setDrawerConfig({
        isOpen: false,
        mode: "add",
        editingVariant: null,
        isSubmitting: false,
      });
    },

    deleteSingle: (id: number) => {
      setDeleteConfig({
        isOpen: true,
        variantId: id,
        isDeleting: false,
      });
    },

    closeDeleteModal: () => {
      setDeleteConfig({
        isOpen: false,
        variantId: null,
        isDeleting: false,
      });
    },
  };

  // hàm thêm mới biến thể
  const handleAddVariant = (
    data: VariantFormData,
    processedValues: string[],
  ) => {
    const newVariant: Variant = {
      id: nextIdCounter.current,
      name: data.name.trim(),
      values: processedValues,
      status: data.status,
    };
    nextIdCounter.current += 1;
    setVariants((prev) => [newVariant, ...prev]);
    toast.success("Thêm biến thể thành công!");
  };

  // hàm cập nhật biến thể
  const handleEditVariant = (
    data: VariantFormData,
    processedValues: string[],
    currentEditId: number,
  ) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === currentEditId
          ? {
              ...v,
              name: data.name.trim(),
              values: processedValues,
              status: data.status,
            }
          : v,
      ),
    );
    toast.success("Cập nhật biến thể thành công!");
  };

  // logic xử lý submit
  const handleDrawerSubmit = (data: VariantFormData) => {
    if (!validateVariant(data)) {
      toast.error("Vui lòng điền đầy đủ dữ liệu hợp lệ.");
      return;
    }

    const currentMode = drawerConfig.mode;
    const currentEditId = drawerConfig.editingVariant?.id;

    setDrawerConfig((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const processedValues = parseVariantValues(data.values);

      if (currentMode === "add") {
        handleAddVariant(data, processedValues);
      } else if (currentMode === "edit" && currentEditId) {
        handleEditVariant(data, processedValues, currentEditId);
      }

      actions.closeDrawer();
    } catch {
      toast.error("Đã xảy ra lỗi trong quá trình lưu dữ liệu.");
      setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // logic xóa trực tiếp
  const executeDelete = () => {
    if (!deleteConfig.variantId || deleteConfig.isDeleting) return;
    setDeleteConfig((prev) => ({ ...prev, isDeleting: true }));
    try {
      const idToDelete = deleteConfig.variantId;
      setVariants((prev) => prev.filter((v) => v.id !== idToDelete));

      toast.success("Đã xóa biến thể thành công!");
      actions.closeDeleteModal();
    } catch {
      toast.error("Đã xảy ra lỗi trong quá trình xóa.");
      setDeleteConfig((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  return {
    filteredVariants,
    search,
    drawerConfig,
    deleteConfig,
    actions,
    handleDrawerSubmit,
    executeDelete,
  };
}
