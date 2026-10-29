// Nhớ queryID của sản phẩm vừa click từ widget gợi ý Algolia,
// để Add to cart ở trang chi tiết vẫn gửi được conversion có queryID.
const KEY = "algolia_query_map";
const TTL_MS = 55 * 60 * 1000; // Algolia chỉ nhận event trong 1 giờ sau request

interface StoredQuery {
  queryID: string;
  savedAt: number;
}

const readMap = (): Record<string, StoredQuery> => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}") as Record<
      string,
      StoredQuery
    >;
  } catch {
    return {};
  }
};

export const saveAlgoliaQuery = (productId: string, queryID?: string) => {
  if (!productId || !queryID) return;
  const map = readMap();
  map[productId] = { queryID, savedAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(map));
};

export const getAlgoliaQueryID = (productId: string): string | undefined => {
  const entry = readMap()[productId];
  if (!entry || Date.now() - entry.savedAt > TTL_MS) return undefined;
  return entry.queryID;
};
