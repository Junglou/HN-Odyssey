import { useState } from "react";
import { toast } from "react-toastify";
// TODO: import axiosClient from "../../api/axiosClient";

// Dữ liệu khởi tạo cho form trade-in
export function useTradeInForm() {
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
    zipCode: "",
    agreeTerms: false,
    photos: [] as File[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hàm xử lý khi người dùng nhập liệu vào input/textarea
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

  // Hàm xử lý chọn phương thức đánh giá (store/shipping)
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

  // Hàm xử lý Submit Form gửi xuống Backend
  const submitTradeInRequest = async () => {
    // 1. Validate cơ bản
    if (!formData.agreeTerms) {
      toast.error("Bạn cần đồng ý với điều khoản dịch vụ trước khi gửi.");
      return false;
    }
    if (!formData.fullName || !formData.phone || !formData.category) {
      toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return false;
    }

    setIsSubmitting(true);

    try {
      // 2. Vì có chứa file ảnh, phải dùng FormData thay vì JSON thuần
      const payload = new FormData();
      payload.append("fullName", formData.fullName);
      payload.append("email", formData.email);
      payload.append("phone", formData.phone);
      payload.append("category", formData.category);
      payload.append("description", formData.description);
      payload.append("evaluationMethod", formData.evaluationMethod);

      // Nếu chọn shipping thì append thêm địa chỉ
      if (formData.evaluationMethod === "shipping") {
        payload.append("streetAddress", formData.streetAddress);
        payload.append("aptSuite", formData.aptSuite);
        payload.append("city", formData.city);
        payload.append("state", formData.state);
        payload.append("zipCode", formData.zipCode);
      }

      // Append từng file ảnh vào payload
      formData.photos.forEach((file) => {
        payload.append("photos", file);
      });

      // TODO: Mở comment khi BE đã sẵn sàng API
      // await axiosClient.post("/trade-ins/requests", payload, {
      //   headers: {
      //     "Content-Type": "multipart/form-data",
      //   },
      // });

      // Giả lập delay gọi API
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Yêu cầu Trade-in của bạn đã được gửi thành công!");

      // 3. Reset form sau khi gửi thành công
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
        zipCode: "",
        agreeTerms: false,
        photos: [],
      });
      return true;
    } catch (error) {
      console.error("Lỗi khi gửi yêu cầu Trade-in:", error);
      toast.error("Đã có lỗi xảy ra. Vui lòng thử lại sau.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    isSubmitting,
    handleInputChange,
    setEvaluationMethod,
    setCategory,
    handleFileChange,
    removePhoto,
    submitTradeInRequest,
  };
}
