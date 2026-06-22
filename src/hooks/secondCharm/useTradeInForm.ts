import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";

// interfaces
interface TradeInPayload {
  full_name: string;
  email: string;
  phone_number: string;
  category_id: string;
  condition_description: string;
  media_urls: string[];
  evaluation_method: string;
  agreed_to_terms: boolean;
  shipping_address?: {
    street_address: string;
    apt_suite: string;
    city: string;
    state: string;
    zip_code: string;
    district_id: number;
    ward_code: string;
  };
}

interface CategoryNode {
  _id: string;
  name: string;
  children?: CategoryNode[];
}

export interface LocationNode {
  code: string;
  name_with_type: string;
  mapping?: {
    ghn_id?: number;
    ghn_ward_code?: string;
  };
}

// hooks
export function useTradeInForm() {
  // states
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    category: "",
    description: "",
    evaluationMethod: "",
    streetAddress: "",
    aptSuite: "",
    city: "",
    state: "",
    zipCode: "700000",
    districtId: 0,
    wardCode: "",
    agreeTerms: false,
    photos: [] as File[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const [locations, setLocations] = useState({
    provinces: [] as LocationNode[],
    districts: [] as LocationNode[],
    wards: [] as LocationNode[],
  });

  const [selectedLocationCodes, setSelectedLocationCodes] = useState({
    province: "",
    district: "",
    ward: "",
  });

  // effects
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoadingCategories(true);
      try {
        const catRes = await axiosClient.get("/categories/tree-view");
        const catData: CategoryNode[] = catRes.data?.data || catRes.data || [];
        const flatList: { id: string; name: string }[] = [];

        // SỬA ĐỔI: Dùng định dạng "Parent > Child"
        const flatten = (nodes: CategoryNode[], parentPath = "") => {
          nodes.forEach((node) => {
            const currentPath = parentPath
              ? `${parentPath} > ${node.name}`
              : node.name;
            flatList.push({ id: node._id, name: currentPath });

            if (node.children && node.children.length > 0) {
              flatten(node.children, currentPath);
            }
          });
        };

        flatten(catData);
        setCategories(flatList);

        const provRes = await axiosClient.get("/shipping/locations/provinces");
        const provData = provRes.data?.data || provRes.data || [];
        setLocations((prev) => ({ ...prev, provinces: provData }));
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu khởi tạo:", error);
        toast.error("Không thể tải một số dữ liệu hệ thống.");
      } finally {
        setIsLoadingCategories(false);
      }
    };

    void fetchInitialData();
  }, []);

  // handlers
  const handleProvinceChange = async (provinceCode: string) => {
    const selectedProvince = locations.provinces.find(
      (p) => p.code === provinceCode,
    );
    const provinceName = selectedProvince?.name_with_type || "";

    setSelectedLocationCodes({
      province: provinceCode,
      district: "",
      ward: "",
    });
    setFormData((prev) => ({
      ...prev,
      city: provinceName,
      state: provinceName,
      districtId: 0,
      wardCode: "",
    }));
    setLocations((prev) => ({ ...prev, districts: [], wards: [] }));

    if (provinceCode) {
      try {
        const res = await axiosClient.get(
          `/shipping/locations/districts/${provinceCode}`,
        );
        setLocations((prev) => ({
          ...prev,
          districts: res.data?.data || res.data || [],
        }));
      } catch (error) {
        console.error("Lỗi tải Quận/Huyện", error);
      }
    }
  };

  const handleDistrictChange = async (districtCode: string) => {
    const selectedDistrict = locations.districts.find(
      (d) => d.code === districtCode,
    );

    setSelectedLocationCodes((prev) => ({
      ...prev,
      district: districtCode,
      ward: "",
    }));
    setFormData((prev) => ({
      ...prev,
      districtId: selectedDistrict?.mapping?.ghn_id || 0,
      wardCode: "",
    }));
    setLocations((prev) => ({ ...prev, wards: [] }));

    if (districtCode) {
      try {
        const res = await axiosClient.get(
          `/shipping/locations/wards/${districtCode}`,
        );
        setLocations((prev) => ({
          ...prev,
          wards: res.data?.data || res.data || [],
        }));
      } catch (error) {
        console.error("Lỗi tải Phường/Xã", error);
      }
    }
  };

  const handleWardChange = (wardCode: string) => {
    const selectedWard = locations.wards.find((w) => w.code === wardCode);

    setSelectedLocationCodes((prev) => ({ ...prev, ward: wardCode }));
    setFormData((prev) => ({
      ...prev,
      wardCode: selectedWard?.mapping?.ghn_ward_code || "",
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const setEvaluationMethod = (method: string) => {
    setFormData((prev) => ({ ...prev, evaluationMethod: method }));
  };

  const setCategory = (category: string) => {
    setFormData((prev) => ({ ...prev, category }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormData((prev) => ({
        ...prev,
        photos: [...prev.photos, ...newFiles],
      }));
    }
  };

  const removePhoto = (indexToRemove: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, index) => index !== indexToRemove),
    }));
  };

  const submitTradeInRequest = async () => {
    if (!formData.agreeTerms) {
      toast.error("Bạn cần đồng ý với điều khoản dịch vụ trước khi gửi.");
      return false;
    }
    if (!formData.fullName || !formData.phone || !formData.category) {
      toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return false;
    }

    let formattedPhone = formData.phone.trim();
    if (formattedPhone.startsWith("+84")) {
      formattedPhone = "0" + formattedPhone.slice(3);
    } else if (
      formattedPhone.startsWith("84") &&
      formattedPhone.length === 11
    ) {
      formattedPhone = "0" + formattedPhone.slice(2);
    }

    const phoneRegex = /^0[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(formattedPhone)) {
      toast.error(
        "Số điện thoại không hợp lệ. Vui lòng nhập chuẩn 10 số của Việt Nam.",
      );
      return false;
    }

    if (formData.photos.length < 3) {
      toast.error("Hệ thống yêu cầu cung cấp tối thiểu 3 hình ảnh thiết bị.");
      return false;
    }

    // GHN Validation
    if (formData.evaluationMethod === "shipping") {
      if (
        !formData.streetAddress ||
        !formData.city ||
        !formData.districtId ||
        Number(formData.districtId) === 0 ||
        !formData.wardCode ||
        formData.wardCode.trim() === ""
      ) {
        toast.error(
          "Vui lòng chọn đầy đủ Tỉnh/Thành phố, Quận/Huyện và Phường/Xã từ danh sách.",
        );
        return false;
      }
    }

    setIsSubmitting(true);

    try {
      const uploadPayload = new FormData();
      formData.photos.forEach((file) => {
        uploadPayload.append("files", file);
      });

      const uploadRes = await axiosClient.post(
        "/upload/multiple",
        uploadPayload,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      const uploadedImages = uploadRes.data?.data || [];
      const mediaUrls = uploadedImages.map((img: { path: string }) => img.path);

      if (mediaUrls.length < 3) {
        toast.error("Tải ảnh thất bại, vui lòng thử lại.");
        setIsSubmitting(false);
        return false;
      }

      const evalMethodBE =
        formData.evaluationMethod === "shipping" ? "SHIPPING" : "VISIT_STORE";

      const tradeInPayload: TradeInPayload = {
        full_name: formData.fullName,
        email: formData.email,
        phone_number: formattedPhone,
        category_id: formData.category,
        condition_description: formData.description,
        media_urls: mediaUrls,
        evaluation_method: evalMethodBE,
        agreed_to_terms: formData.agreeTerms,
      };

      if (evalMethodBE === "SHIPPING") {
        tradeInPayload.shipping_address = {
          street_address: formData.streetAddress,
          apt_suite: formData.aptSuite || "",
          city: formData.city,
          state: formData.state || formData.city,
          zip_code: formData.zipCode || "700000",
          district_id: Number(formData.districtId),
          ward_code: String(formData.wardCode),
        };
      }

      await axiosClient.post("/trade-in/request", tradeInPayload);

      toast.success("Yêu cầu Trade-in của bạn đã được gửi thành công!");

      setFormData({
        fullName: "",
        email: "",
        phone: "",
        category: "",
        description: "",
        evaluationMethod: "",
        streetAddress: "",
        aptSuite: "",
        city: "",
        state: "",
        zipCode: "700000",
        districtId: 0,
        wardCode: "",
        agreeTerms: false,
        photos: [],
      });
      setSelectedLocationCodes({ province: "", district: "", ward: "" });

      return true;
    } catch (error: unknown) {
      console.error("Lỗi khi gửi yêu cầu Trade-in:", error);
      const err = error as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const errMsg =
        err?.response?.data?.message || err?.message || "Đã có lỗi xảy ra.";
      const finalMsg = Array.isArray(errMsg) ? errMsg[0] : errMsg;
      toast.error(
        typeof finalMsg === "string"
          ? finalMsg
          : "Lỗi xác thực dữ liệu từ máy chủ.",
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    categories,
    isLoadingCategories,
    locations,
    selectedLocationCodes,
    handleProvinceChange,
    handleDistrictChange,
    handleWardChange,
    isSubmitting,
    handleInputChange,
    setEvaluationMethod,
    setCategory,
    handleFileChange,
    removePhoto,
    submitTradeInRequest,
  };
}
