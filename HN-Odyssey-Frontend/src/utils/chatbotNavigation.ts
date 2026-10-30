import type { ChatNavigation } from "../types/chatbot";

// MAP MÃ TRANG CỦA CHATBOT -> ROUTE THẬT
// Phải khớp với PAGES (tool "site_guide") và NAV (node "Chuẩn hóa output") trong n8n.
// Bot chỉ trả mã trang, FE tự đổi sang route -> bot không thể đưa link sai.
interface ChatNavPage {
  path: string;
  label: string; // Chữ trên nút trong khung chat (UI tiếng Anh)
  sections: string[];
}

export const CHAT_NAV_PAGES: Record<string, ChatNavPage> = {
  HOME: { path: "/", label: "Home", sections: ["categories", "just-for-you"] },
  PRODUCTS: { path: "/products", label: "Products", sections: ["filters"] },
  CART: {
    path: "/cart",
    label: "Cart",
    sections: ["cart-items", "order-summary"],
  },
  CHECKOUT: {
    path: "/checkout",
    label: "Checkout",
    sections: ["shipping-info", "guest-otp", "payment-method", "voucher"],
  },
  BLOG: { path: "/blog", label: "Blog", sections: [] },
  LOYALTY: {
    path: "/loyalty",
    label: "Explorer Rewards",
    sections: ["how-it-works", "tiers", "redeem", "benefits"],
  },
  TRADE_IN: {
    path: "/second-charm-form",
    label: "Second Charm",
    sections: ["how-it-works", "form", "faq"],
  },
  LOGIN: {
    path: "/login",
    label: "Log in",
    sections: ["forgot-password", "account-help", "social-login"],
  },
  REGISTER: { path: "/register", label: "Sign up", sections: [] },
  ACCOUNT_RECOVERY: {
    path: "/account-recovery",
    label: "Account recovery",
    sections: [],
  },
  PROFILE: {
    path: "/profile",
    label: "My Profile",
    sections: [
      "avatar",
      "profile-info",
      "account-info",
      "change-password",
      "linked-accounts",
    ],
  },
  ADDRESSES: {
    path: "/profile/address-management",
    label: "Address Management",
    sections: ["address-list"],
  },
  MY_ORDERS: {
    path: "/profile/orders",
    label: "Order Management",
    sections: ["status-filter"],
  },
  PURCHASE_HISTORY: {
    path: "/profile/history",
    label: "Purchase History",
    sections: [],
  },
  WISHLIST: { path: "/profile/wishlist", label: "My Wishlist", sections: [] },
  MY_COUPONS: { path: "/profile/coupon", label: "My Coupon", sections: [] },
  MY_LOYALTY: { path: "/profile/loyalty", label: "My Loyalty", sections: [] },
  RECENTLY_VIEWED: {
    path: "/profile/recent",
    label: "Recently Viewed",
    sections: [],
  },
  ABOUT_US: { path: "/pages/about-us", label: "About us", sections: [] },
  RETURN_POLICY: {
    path: "/pages/return-policy",
    label: "Return Policy",
    sections: [],
  },
};

// Vị trí có ở mọi trang (thanh đầu trang)
const GLOBAL_SECTIONS = ["header-search", "header-cart", "header-account"];

// Danh mục mở thẳng được (khớp menu trên Header)
const PRODUCT_CATEGORIES = [
  "featured",
  "men",
  "women",
  "kid",
  "equipment",
  "emergency-packs",
];

export interface ResolvedChatNavigation {
  path?: string; // Có cả query, vd "/products?category=women"
  section?: string;
  buttonLabel: string;
}

// Kiểm tra lại mã do bot gửi theo whitelist của FE, trả về route + vị trí cần làm nổi bật
export const resolveChatNavigation = (
  nav?: ChatNavigation,
): ResolvedChatNavigation | null => {
  if (!nav) return null;

  const page = nav.page ? CHAT_NAV_PAGES[nav.page] : undefined;
  const section =
    nav.section &&
    (GLOBAL_SECTIONS.includes(nav.section) ||
      page?.sections.includes(nav.section))
      ? nav.section
      : undefined;

  if (!page && !section) return null;

  let path = page?.path;
  if (
    path &&
    nav.page === "PRODUCTS" &&
    nav.category &&
    PRODUCT_CATEGORIES.includes(nav.category)
  ) {
    path = `${path}?category=${nav.category}`;
  }

  return {
    path,
    section,
    buttonLabel: page ? `Open ${page.label}` : "Show me",
  };
};

// LÀM NỔI BẬT VỊ TRÍ: tìm phần tử có data-chat-guide="<section>", cuộn tới và nhấp nháy viền
const HIGHLIGHT_CLASS = "chat-guide-highlight";
const HIGHLIGHT_MS = 4000;
const FIND_TIMEOUT_MS = 5000; // Trang mới cần thời gian tải dữ liệu
const FIND_INTERVAL_MS = 150;

let activeElement: HTMLElement | null = null;
let activeTimer: ReturnType<typeof setTimeout> | null = null;

export const highlightChatGuide = (section?: string, delayMs = 0): void => {
  if (!section) return;
  const startedAt = Date.now() + delayMs;

  const tryFind = () => {
    const el = document.querySelector<HTMLElement>(
      `[data-chat-guide="${section}"]`,
    );

    if (!el) {
      if (Date.now() - startedAt < FIND_TIMEOUT_MS)
        setTimeout(tryFind, FIND_INTERVAL_MS);
      return;
    }

    if (activeTimer) clearTimeout(activeTimer);
    activeElement?.classList.remove(HIGHLIGHT_CLASS);

    if (section.startsWith("header-")) {
      // Header ẩn khi cuộn xuống -> về đầu trang để header hiện lại
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Khối cao hơn màn hình thì cuộn tới đầu khối, khối nhỏ thì để giữa màn hình
      const isTall = el.offsetHeight > window.innerHeight * 0.8;
      el.scrollIntoView({
        behavior: "smooth",
        block: isTall ? "start" : "center",
      });
    }

    el.classList.add(HIGHLIGHT_CLASS);
    activeElement = el;
    activeTimer = setTimeout(() => {
      el.classList.remove(HIGHLIGHT_CLASS);
      activeElement = null;
      activeTimer = null;
    }, HIGHLIGHT_MS);
  };

  // Vừa chuyển trang: đợi trang mới render, tránh bắt nhầm phần tử của trang cũ
  setTimeout(tryFind, delayMs);
};
