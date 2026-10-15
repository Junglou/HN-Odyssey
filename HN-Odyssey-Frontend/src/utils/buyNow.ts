// "Mua ngay": truyền đúng 1 món qua URL checkout, không đụng tới các món khác trong giỏ
export interface BuyNowItem {
  productId: string;
  sku: string;
}

export const buildBuyNowCheckoutUrl = (item: BuyNowItem): string => {
  const params = new URLSearchParams({
    buyProductId: item.productId,
    buySku: item.sku,
  });
  return `/checkout?${params.toString()}`;
};

export const getBuyNowItemFromSearch = (search: string): BuyNowItem | null => {
  const params = new URLSearchParams(search);
  const productId = params.get("buyProductId");
  const sku = params.get("buySku");
  return productId && sku ? { productId, sku } : null;
};
