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

export interface CheckoutPaymentData {
  method: "credit_card" | "qr_pay";
  cardName: string;
  cardNumber: string;
  expDate: string;
  cvv: string;
  eWallet: "momo" | "zalo_pay" | "qr_pay" | "atm";
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

export const MOCK_RECOMMENDATIONS: CheckoutItem[] = [
  {
    id: "r1",
    name: "Solo kit 1",
    description: "a knife, fire starter, paracord, and multi-gear.",
    price: 15.99,
    quantity: 1,
    image: "https://placehold.co/275x150/png?text=Solo+kit+1",
  },
  {
    id: "r2",
    name: "Ration 1",
    description: "Instant energy supply with no cooking required.",
    price: 5.99,
    quantity: 1,
    image: "https://placehold.co/275x150/png?text=Ration+1",
  },
  {
    id: "r3",
    name: "Vital 1",
    description: "Basic wound care and essential first aid treatment.",
    price: 35.99,
    quantity: 1,
    image: "https://placehold.co/275x150/png?text=Vital+1",
  },
  {
    id: "r4",
    name: "Flashlight Kit",
    description: "High lumens tactical flashlight with extra batteries.",
    price: 22.5,
    quantity: 1,
    image: "https://placehold.co/275x150/png?text=Flashlight",
  },
  {
    id: "r5",
    name: "Thermal Blanket",
    description: "Retains 90% of body heat in emergency situations.",
    price: 12.0,
    quantity: 1,
    image: "https://placehold.co/275x150/png?text=Blanket",
  },
  {
    id: "r6",
    name: "Water Filter",
    description: "Portable water filtration system for outdoor survival.",
    price: 45.0,
    quantity: 1,
    image: "https://placehold.co/275x150/png?text=Filter",
  },
];

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  const [paymentData, setPaymentData] = useState<CheckoutPaymentData>({
    method: "credit_card",
    cardName: "",
    cardNumber: "",
    expDate: "",
    cvv: "",
    eWallet: "qr_pay",
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

  const handlePaymentChange = (
    field: keyof CheckoutPaymentData,
    value: string,
  ) => {
    setPaymentData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSendOtp = () => {
    if (!formData.phone) {
      toast.warning("Vui lòng nhập Phone Number trước để nhận OTP.");
      return;
    }
    setLoading(true);
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
    if (step === 1) {
      if (!formData.firstName || !formData.email || !formData.address) {
        toast.error("Vui lòng điền các thông tin giao hàng bắt buộc.");
        return;
      }
      if (!formData.otp) {
        toast.error("Vui lòng nhập mã OTP xác nhận.");
        return;
      }
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (step === 2) {
      if (paymentData.method === "credit_card") {
        if (!paymentData.cardName || !paymentData.cardNumber) {
          toast.error("Vui lòng điền đầy đủ thông tin thẻ.");
          return;
        }
      }

      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        toast.success("Thanh toán thành công!");
        setStep(3); // Chuyển sang bước 3: Success & Recommend
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 1500);
    }
  };

  const handleReturnHome = () => {
    window.location.href = "/";
  };

  return {
    step,
    items,
    formData,
    paymentData,
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
    handlePaymentChange,
    handleSendOtp,
    handlePlaceOrder,
    handleReturnHome,
    setStep,
  };
}
