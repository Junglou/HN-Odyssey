import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";

export interface CheckoutItem {
  id: string;
  sku?: string;
  slug?: string;
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
  phone: string;
  street: string;
  provinceCode: string;
  districtCode: string;
  wardCode: string;
  country: string;
  otp: string;
  selectedAddressId: string;
}

export interface CheckoutPaymentData {
  method: "COD" | "VNPAY" | "MOMO";
}

export interface LocationItem {
  code: string;
  name: string;
  name_with_type?: string;
}

export interface SavedAddress {
  _id: string;
  name: string;
  phone: string;
  street: string;
  city_code: string;
  district_code: string;
  ward_code: string;
  is_default: boolean;
}

interface ApiCartItem {
  productId: string;
  sku?: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  thumbnail?: string;
}

interface ApiRecommendationItem {
  _id: string;
  slug?: string;
  name: string;
  short_description?: string;
  variants?: Array<{ sale_price?: number; price?: number }>;
  thumbnail?: string;
  images?: string[];
}

interface ApiError {
  message?: string;
}

interface ExtendedWindow extends Window {
  addTestItem?: (productId: string, sku: string) => Promise<void>;
}

export const MOCK_COUNTRIES = ["Vietnam"];

export function useCheckout() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [recommendations, setRecommendations] = useState<CheckoutItem[]>([]);

  const [provinces, setProvinces] = useState<LocationItem[]>([]);
  const [districts, setDistricts] = useState<LocationItem[]>([]);
  const [wards, setWards] = useState<LocationItem[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [availablePromos, setAvailablePromos] = useState<string[]>([]);

  const [profileInfo, setProfileInfo] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

  const [formData, setFormData] = useState<CheckoutFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    provinceCode: "",
    districtCode: "",
    wardCode: "",
    country: "Vietnam",
    otp: "",
    selectedAddressId: "new",
  });

  const [paymentData, setPaymentData] = useState<CheckoutPaymentData>({
    method: "COD",
  });

  const [promoCode, setPromoCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState({
    subtotal: 0,
    discount: 0,
    grandTotal: 0,
  });
  const [shippingFee, setShippingFee] = useState<number>(0);

  const isLogged = !!tokenStorage.getToken();

  const getSessionId = () => {
    let sid = localStorage.getItem("guestSessionId");
    if (!sid) {
      sid = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("guestSessionId", sid);
    }
    return sid;
  };
  const guestSessionId = getSessionId();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vnpResponse = params.get("vnp_ResponseCode");
    const momoResult = params.get("resultCode");
    const isSuccessPath = window.location.pathname.includes("/success");
    const isFailPath = window.location.pathname.includes("/fail");

    if (vnpResponse === "00" || momoResult === "0" || isSuccessPath) {
      setStep(3);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (
      (vnpResponse && vnpResponse !== "00") ||
      (momoResult && momoResult !== "0") ||
      isFailPath
    ) {
      toast.error("Thanh toán chưa hoàn tất hoặc đã bị hủy.");
      setStep(2);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const fetchCartData = () => {
      axiosClient
        .get(`/cart?guestSessionId=${guestSessionId}`)
        .then((res) => {
          if (res.data?.items) {
            const mappedItems = res.data.items.map((i: ApiCartItem) => ({
              id: i.productId,
              sku: i.sku,
              name: i.productName,
              description: `SKU: ${i.sku || "N/A"}`,
              price: i.unitPrice,
              quantity: i.quantity,
              image: i.thumbnail || "https://placehold.co/275x150",
            }));
            setItems(mappedItems);
            setSummary(res.data.summary);
          }
        })
        .catch(console.error);
    };

    (window as unknown as ExtendedWindow).addTestItem = async (
      productId: string,
      sku: string,
    ) => {
      try {
        await axiosClient.post("/cart/add", {
          productId: productId,
          variantSku: sku,
          quantity: 2,
          guestSessionId: !isLogged ? guestSessionId : undefined,
        });
        fetchCartData();
      } catch (error: unknown) {
        const err = error as ApiError;
        console.error("Lỗi thêm sản phẩm:", err?.message || "Không xác định");
      }
    };

    fetchCartData();

    axiosClient
      .get("/shipping/locations/provinces")
      .then((res) => setProvinces(res.data || []))
      .catch(console.error);

    axiosClient
      .get("/promotions/public/coupons/active")
      .then((res) => {
        if (res.data?.data) {
          setAvailablePromos(
            res.data.data.map((p: { code: string }) => p.code),
          );
        }
      })
      .catch(() => setAvailablePromos([]));

    if (isLogged) {
      Promise.all([
        axiosClient.get("/users/customers/profile").catch(() => null),
        axiosClient.get("/users/addresses").catch(() => null),
      ]).then(([profileRes, addrRes]) => {
        const user = profileRes?.data?.data || profileRes?.data;
        let pFName = "",
          pLName = "",
          pPhone = "",
          pEmail = "";

        if (user) {
          pFName = user.first_Name || "";
          pLName = user.last_Name || "";
          pPhone = user.phone || "";
          pEmail = user.email || "";

          setProfileInfo({
            firstName: pFName,
            lastName: pLName,
            phone: pPhone,
            email: pEmail,
          });
        }

        const addrs: SavedAddress[] = addrRes?.data?.data || [];
        setSavedAddresses(addrs);

        if (addrs.length > 0) {
          const defaultAddr = addrs.find((a) => a.is_default) || addrs[0];
          const nameParts = defaultAddr.name.split(" ");
          const addrFName = nameParts.shift() || pFName;
          const addrLName = nameParts.join(" ") || pLName;

          setFormData((prev) => ({
            ...prev,
            selectedAddressId: defaultAddr._id,
            firstName: addrFName,
            lastName: addrLName,
            phone: defaultAddr.phone || pPhone,
            email: pEmail || prev.email,
            street: defaultAddr.street,
            provinceCode: defaultAddr.city_code,
            districtCode: defaultAddr.district_code,
            wardCode: defaultAddr.ward_code,
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            selectedAddressId: "new",
            firstName: pFName,
            lastName: pLName,
            phone: pPhone,
            email: pEmail || prev.email,
          }));
        }
      });
    }
  }, [guestSessionId, isLogged]);

  useEffect(() => {
    if (step === 3 || summary.subtotal > 0) {
      const currentTotal = summary.subtotal > 0 ? summary.subtotal : 0;
      const excludeIds = items.map((i) => i.id).join(",");

      axiosClient
        .get(
          `/recommendations/cart?session_id=${guestSessionId}&current_cart_total=${currentTotal}&exclude_ids=${excludeIds}`,
        )
        .then((res) => {
          const responseData = Array.isArray(res.data)
            ? res.data
            : res.data?.data;

          if (Array.isArray(responseData)) {
            const recs = responseData
              .slice(0, 6)
              .map((p: ApiRecommendationItem) => ({
                id: p._id,
                slug: p.slug || "",
                name: p.name,
                description: p.short_description || "Sản phẩm gợi ý",
                price:
                  p.variants?.[0]?.sale_price || p.variants?.[0]?.price || 0,
                quantity: 1,
                image:
                  p.thumbnail ||
                  p.images?.[0] ||
                  "https://placehold.co/275x150",
              }));
            setRecommendations(recs);
          }
        })
        .catch(console.error);
    }
  }, [guestSessionId, summary.subtotal, step, items]);

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

  useEffect(() => {
    if (
      items.length === 0 ||
      !formData.provinceCode ||
      !formData.districtCode
    ) {
      return;
    }

    const FREESHIP_THRESHOLD_USD = 200;

    if (summary.subtotal >= FREESHIP_THRESHOLD_USD) {
      setShippingFee(0);
      return;
    }

    const payload = {
      cityCode: formData.provinceCode,
      districtCode: formData.districtCode,
      items: items.map((i) => ({
        product_id: i.id,
        sku: i.sku || i.id,
        quantity: i.quantity,
        weight: 0.5,
      })),
      isInstant: false,
    };

    axiosClient
      .post("/shipping/calculate", payload)
      .then((res) => setShippingFee(res.data.shipping_fee || 0))
      .catch(() => setShippingFee(0));
  }, [formData.provinceCode, formData.districtCode, items, summary.subtotal]);

  useEffect(() => {
    if (!promoCode) {
      setVoucherDiscount(0);
      return;
    }

    const timer = setTimeout(() => {
      if (summary.subtotal > 0) {
        axiosClient
          .post("/promotions/coupons/apply", {
            code: promoCode.trim(),
            cart_total: Number(summary.subtotal) || 0,
          })
          .then((res) => {
            const discountValue =
              res.data?.data?.discount || res.data?.data?.discount_amount || 0;
            setVoucherDiscount(discountValue);
          })
          .catch(() => {
            setVoucherDiscount(0);
          });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [promoCode, summary.subtotal]);

  const handleChange = (field: keyof CheckoutFormData, value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "provinceCode") {
        newData.districtCode = "";
        newData.wardCode = "";
      } else if (field === "districtCode") {
        newData.wardCode = "";
      }
      return newData;
    });
  };

  const handleSelectAddress = (id: string) => {
    if (id === "new") {
      setFormData((prev) => ({
        ...prev,
        selectedAddressId: "new",
        firstName: profileInfo.firstName || prev.firstName,
        lastName: profileInfo.lastName || prev.lastName,
        phone: profileInfo.phone || prev.phone,
        street: "",
        provinceCode: "",
        districtCode: "",
        wardCode: "",
      }));
      return;
    }
    const addr = savedAddresses.find((a) => a._id === id);
    if (addr) {
      const nameParts = addr.name.split(" ");
      const fName = nameParts.shift() || profileInfo.firstName;
      const lName = nameParts.join(" ") || profileInfo.lastName;
      setFormData((prev) => ({
        ...prev,
        selectedAddressId: addr._id,
        firstName: fName,
        lastName: lName,
        phone: addr.phone || profileInfo.phone,
        street: addr.street,
        provinceCode: addr.city_code,
        districtCode: addr.district_code,
        wardCode: addr.ward_code,
      }));
    }
  };

  const handlePaymentChange = (
    field: keyof CheckoutPaymentData,
    value: string,
  ) => {
    setPaymentData(
      (prev) => ({ ...prev, [field]: value }) as unknown as CheckoutPaymentData,
    );
  };

  const getShippingPayload = () => ({
    name: `${formData.firstName} ${formData.lastName}`.trim(),
    phone: formData.phone,
    email: formData.email,
    address: formData.street,
    city_code: formData.provinceCode,
    district_code: formData.districtCode,
    ward_code: formData.wardCode,
  });

  const handleSendOtp = async () => {
    if (!formData.phone || !formData.email) {
      toast.warning(
        "Vui lòng nhập email và số điện thoại để nhận mã xác thực.",
      );
      return;
    }
    setLoading(true);
    try {
      await axiosClient.post("/orders/guest/init", {
        shippingInfo: getShippingPayload(),
        cartSessionId: guestSessionId,
        phone: formData.phone,
      });
      setOtpTimer(60);
      toast.success(`Mã xác thực đã được gửi đến hộp thư ${formData.email}`);
      const timerInterval = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: unknown) {
      const err = error as ApiError;
      toast.error(err?.message || "Hệ thống gặp sự cố khi gửi mã xác thực.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (step === 1) {
      if (
        !formData.firstName ||
        !formData.email ||
        !formData.street ||
        !formData.provinceCode ||
        !formData.districtCode ||
        !formData.wardCode
      ) {
        toast.error(
          "Các trường thông tin giao hàng hiện chưa đầy đủ, vui lòng bổ sung.",
        );
        return;
      }

      if (!isLogged) {
        if (!formData.otp) {
          toast.error("Yêu cầu nhập mã xác thực OTP trước khi tiếp tục.");
          return;
        }
        setLoading(true);
        try {
          await axiosClient.post("/orders/guest/verify-otp", {
            email: formData.email,
            otpCode: formData.otp,
            cartSessionId: guestSessionId,
          });
          setStep(2);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error: unknown) {
          const err = error as ApiError;
          toast.error(
            err?.message || "Mã xác thực không hợp lệ, vui lòng kiểm tra lại.",
          );
        } finally {
          setLoading(false);
        }
      } else {
        setStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    if (step === 2) {
      setLoading(true);
      try {
        const payload = {
          source: "CART",
          guestSessionId: !isLogged ? guestSessionId : undefined,
          shippingInfo: getShippingPayload(),
          paymentMethod: paymentData.method,
          note: isGift ? "Đơn hàng sử dụng cho mục đích làm quà tặng" : "",
          voucherCode: promoCode || undefined,
        };

        const res = await axiosClient.post("/orders", payload);

        if (res.data?.paymentUrl) {
          window.location.href = res.data.paymentUrl;
        } else {
          toast.success("Tiến trình đặt hàng đã hoàn tất.");
          setStep(3);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (error: unknown) {
        const err = error as ApiError;
        toast.error(
          err?.message || "Phát sinh lỗi trong quá trình khởi tạo đơn hàng.",
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const handleReturnHome = () => {
    window.location.href = "/";
  };

  const handleApplyPromoCode = (inputCode: string) => {
    if (!inputCode || inputCode.trim() === "") {
      setVoucherDiscount(0);
      return;
    }

    if (summary.subtotal > 0) {
      axiosClient
        .post("/promotions/coupons/apply", {
          code: inputCode.trim(),
          cart_total: Number(summary.subtotal) || 0,
        })
        .then((res) => {
          const discountValue =
            res.data?.data?.discount || res.data?.data?.discount_amount || 0;
          setVoucherDiscount(discountValue);
          setPromoCode(inputCode.trim());
        })
        .catch(() => {
          setVoucherDiscount(0);
          toast.error(
            "Thông tin nhập vào không trùng khớp với các mã giảm giá hiện có.",
          );
        });
    }
  };

  const EXCHANGE_RATE = 25400; // Tỷ giá 1 USD = 25,400 VNĐ
  const shippingFeeUSD = shippingFee > 0 ? shippingFee / EXCHANGE_RATE : 0;

  return {
    step,
    items,
    recommendations,
    provinces,
    districts,
    wards,
    savedAddresses,
    isLogged,
    formData,
    paymentData,
    promoCode,
    isSubscribed,
    isGift,
    otpTimer,
    loading,
    subtotal: summary.subtotal,
    shippingFee: shippingFee > 0 ? `${shippingFeeUSD.toFixed(2)}$` : "Free",
    taxes: 0,
    discountAmount: voucherDiscount,
    total: Math.max(
      0,
      summary.subtotal - summary.discount + shippingFeeUSD - voucherDiscount,
    ),
    availablePromos,
    setPromoCode,
    setIsSubscribed,
    setIsGift,
    handleChange,
    handleSelectAddress,
    handlePaymentChange,
    handleSendOtp,
    handlePlaceOrder,
    handleReturnHome,
    handleApplyPromoCode,
    setStep,
  };
}
