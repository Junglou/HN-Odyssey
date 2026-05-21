import { useState } from "react";

// mock data
const MOCK_RECOMMENDATIONS = [
  {
    id: "rec-1",
    name: "Summit Softshell Jacket",
    price: 35.99,
    originalPrice: 45.99,
    imageUrl: "https://via.placeholder.com/470x450",
    sku: "REC-001",
    type: "product" as const,
    desc: "Softshell jacket for outdoor activities.",
    discountBadge: "New",
    tags: ["New", "Outdoor"],
  },
  {
    id: "rec-2",
    name: "Alpine Puffer Jacket",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/470x450",
    sku: "REC-002",
    type: "product" as const,
    desc: "Warm puffer jacket for winter.",
    tags: ["Winter"],
  },
  {
    id: "rec-3",
    name: "Trailblazer Rain Jacket",
    price: 29.99,
    originalPrice: 35.99,
    imageUrl: "https://via.placeholder.com/470x450",
    sku: "REC-003",
    type: "product" as const,
    desc: "Waterproof rain jacket.",
    discountBadge: "-15%",
    tags: ["Sale"],
  },
  {
    id: "rec-4",
    name: "Expedition Shell Jacket",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/470x450",
    sku: "REC-004",
    type: "product" as const,
    desc: "Expedition shell jacket.",
    discountBadge: "Hot",
    tags: ["Hot"],
  },
  {
    id: "rec-5",
    name: "Classic Windbreaker",
    price: 40.0,
    imageUrl: "https://via.placeholder.com/470x450",
    sku: "REC-005",
    type: "product" as const,
    desc: "Lightweight classic windbreaker.",
    tags: ["Classic"],
  },
];

export function useProductRecommendations() {
  const [recommendations] = useState(MOCK_RECOMMENDATIONS);

  return {
    recommendations,
  };
}
