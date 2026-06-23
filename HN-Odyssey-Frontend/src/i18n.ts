import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Đây là 2 cuốn "từ điển" của bạn
const resources = {
  en: {
    translation: {
      featured_activities: "Featured Activities",
      odysseys: "Odysseys",
      second_charm: "2nd The Charm",
      free_shipping: "Free Shipping Across The Country",
      come_find_us: "Come Find Us",
      shipping_info_title: "SHIPPING INFORMATION",
      shipping_info_body1: "Free standard national shipping on all orders.",
      shipping_info_body2:
        "Processing and distribution time takes 2 - 4 business days.",
      shipping_partners: "Logistics Partners:",
      blog_news: "Blog & News",
      loyalty_rewards: "Loyalty & Rewards",
      explore_odysseys: "Explore Odysseys",
      go_to_form: "Go to Form",
    },
  },
  vi: {
    translation: {
      featured_activities: "Hoạt động nổi bật",
      odysseys: "Hành trình Odyssey",
      second_charm: "Cơ hội thứ hai",
      free_shipping: "Miễn phí vận chuyển toàn quốc",
      come_find_us: "Tìm cửa hàng",
      shipping_info_title: "THÔNG TIN VẬN CHUYỂN",
      shipping_info_body1:
        "Miễn phí giao hàng tiêu chuẩn toàn quốc cho mọi đơn hàng.",
      shipping_info_body2:
        "Thời gian xử lý và điều phối luân chuyển từ 2 - 4 ngày làm việc.",
      shipping_partners: "Đối tác liên kết:",
      blog_news: "Blog & Tin tức",
      loyalty_rewards: "Ưu đãi & Phần thưởng",
      explore_odysseys: "Khám phá hành trình",
      go_to_form: "Đi đến Form",
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en", // Ngôn ngữ mặc định khi mới vào web
  fallbackLng: "en", // Nếu lỗi thì trả về ngôn ngữ này
  interpolation: { escapeValue: false },
});

export default i18n;
