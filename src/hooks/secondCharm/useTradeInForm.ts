import { useState } from "react";

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
  });

  // Hàm xử lý khi người dùng nhập liệu vào input/textarea
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    // Xử lý riêng cho checkbox
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

  return {
    formData,
    handleInputChange,
    setEvaluationMethod,
  };
}
