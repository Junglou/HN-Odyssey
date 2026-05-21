import { useState } from "react";

const MOCK_TABS = ["All", "New arrivals", "Best sellers", "Tops", "Bottoms"];
const MOCK_SORT_OPTIONS = [
  "Price: Low to High",
  "Price: High to Low",
  "Newest",
];

export function useProductMain() {
  const [tabs] = useState<string[]>(MOCK_TABS);
  const [sortOptions] = useState<string[]>(MOCK_SORT_OPTIONS);

  return {
    tabs,
    sortOptions,
  };
}
