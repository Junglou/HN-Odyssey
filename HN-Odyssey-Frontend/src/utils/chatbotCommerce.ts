// Định dạng giá USD (UI hiển thị USD)
export const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value || 0,
  );

// Khoảng giá: "$50.00" hoặc "$50.00 – $65.00"
export const formatUsdRange = (min: number, max: number): string =>
  min === max ? formatUsd(min) : `${formatUsd(min)} - ${formatUsd(max)}`;

// Chuẩn hóa link ảnh: Cloudinary / link tuyệt đối / đường dẫn local của backend
export const resolveMediaUrl = (url?: string): string => {
  if (!url) return "https://placehold.co/300x300/png?text=No+Image";
  if (url.includes("https://res.cloudinary.com")) {
    return url.substring(url.indexOf("https://res.cloudinary.com"));
  }
  if (/^https?:\/\//.test(url)) return url;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
};

// GHI NHẬN ĐƠN TỪ CHATBOT
// Lưu trong sessionStorage: chỉ sống trong tab hiện tại, đóng tab là mất
const CHATBOT_REF_KEY = "chatbot_buy_now_ref";
const CHATBOT_REF_MAX_AGE_MS = 2 * 60 * 60 * 1000; // Khớp với backend

export interface ChatbotRef {
  conversationId: string;
  productId: string;
  sku: string;
  clickedAt: number;
}

export const saveChatbotRef = (ref: Omit<ChatbotRef, "clickedAt">): void => {
  try {
    sessionStorage.setItem(
      CHATBOT_REF_KEY,
      JSON.stringify({ ...ref, clickedAt: Date.now() }),
    );
  } catch {
    // Trình duyệt chặn storage -> bỏ qua, chỉ mất số liệu đo
  }
};

export const clearChatbotRef = (): void => {
  try {
    sessionStorage.removeItem(CHATBOT_REF_KEY);
  } catch {
    // bỏ qua
  }
};

export const getChatbotRef = (): ChatbotRef | undefined => {
  try {
    const raw = sessionStorage.getItem(CHATBOT_REF_KEY);
    if (!raw) return undefined;
    const ref = JSON.parse(raw) as ChatbotRef;
    if (!ref.clickedAt || Date.now() - ref.clickedAt > CHATBOT_REF_MAX_AGE_MS) {
      clearChatbotRef();
      return undefined;
    }
    return ref;
  } catch {
    clearChatbotRef();
    return undefined;
  }
};
