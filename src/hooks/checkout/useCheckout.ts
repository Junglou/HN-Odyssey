// imports
import { useState } from "react";
import { toast } from "react-toastify";

// interfaces
export interface CheckoutItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  image: string;
}

export interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  otp: string;
}

// data
const INITIAL_CHECKOUT_ITEMS: CheckoutItem[] = [
  {
    id: "1",
    name: "Vital 1",
    description: "Basic wound care and essential first aid treatment.",
    price: 35.99,
    quantity: 2,
    image: "https://placehold.co/275x150/png?text=Vital+1",
  },
  {
    id: "2",
    name: "Ration 1",
    description: "Instant energy supply with no cooking required.",
    price: 5.99,
    quantity: 2,
    image: "https://placehold.co/275x150/png?text=Ration+1",
  },
  {
    id: "3",
    name: "Solo kit 1",
    description: "a knife, fire starter, paracord, and multi-gear.",
    price: 15.99,
    quantity: 2,
    image: "https://placehold.co/275x150/png?text=Solo+kit+1",
  },
];

// Dữ liệu mẫu cho Dropdown
export const MOCK_COUNTRIES = [
  "Vietnam",
  "United States",
  "United Kingdom",
  "Japan",
  "South Korea",
  "Australia",
];

export const MOCK_STATES = [
  "Ho Chi Minh",
  "Ha Noi",
  "California",
  "New York",
  "Texas",
  "London",
];

export const MOCK_PROMO_CODES = ["WELCOME10", "FREESHIP", "SURVIVAL20"];

// hook
export function useCheckout() {
  // hooks/states
  const [items] = useState<CheckoutItem[]>(INITIAL_CHECKOUT_ITEMS);
  const [formData, setFormData] = useState<CheckoutFormData>({
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    phone: "",
    otp: "",
  });

  const [promoCode, setPromoCode] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  // helpers
  const subtotal = 109.78;
  const shippingFee = "Free";
  const taxes = 5.49;
  const total = 115.27;

  // handlers
  const handleChange = (field: keyof CheckoutFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSendOtp = () => {
    if (!formData.phone) {
      toast.warning("Vui lòng nhập Phone Number trước để nhận OTP.");
      return;
    }

    setLoading(true);
    // Giả lập API call
    setTimeout(() => {
      setLoading(false);
      setOtpTimer(60);
      toast.success(`Mã OTP đã được gửi đến số ${formData.phone}`);

      const timerInterval = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 1000);
  };

  const handlePlaceOrder = () => {
    if (!formData.firstName || !formData.email || !formData.address) {
      toast.error("Vui lòng điền các thông tin giao hàng bắt buộc.");
      return;
    }
    if (!formData.otp) {
      toast.error("Vui lòng nhập mã OTP xác nhận.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Đặt hàng thành công!");
      console.log("Order Placed:", {
        formData,
        isSubscribed,
        isGift,
        promoCode,
        total,
      });
    }, 1500);
  };

  return {
    items,
    formData,
    promoCode,
    isSubscribed,
    isGift,
    otpTimer,
    loading,
    subtotal,
    shippingFee,
    taxes,
    total,
    setPromoCode,
    setIsSubscribed,
    setIsGift,
    handleChange,
    handleSendOtp,
    handlePlaceOrder,
  };
}
