import { liteClient } from "algoliasearch/lite";

// Khởi tạo client kết nối với Algolia cho phiên bản 5.x.
// Đưa các key này vào file .env để bảo mật.
const appId = import.meta.env.VITE_ALGOLIA_APP_ID || "YOUR_APP_ID";
const searchKey = import.meta.env.VITE_ALGOLIA_SEARCH_KEY || "YOUR_SEARCH_KEY";

export const searchClient = liteClient(appId, searchKey);
export const ALGOLIA_INDEX_NAME =
  import.meta.env.VITE_ALGOLIA_INDEX_NAME || "products";
