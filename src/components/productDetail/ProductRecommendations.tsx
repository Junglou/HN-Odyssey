// imports
import "./ProductRecommendations.css";
import ProductCard from "../products/ProductCard";

// mock data
const MOCK_RECOMMENDATIONS = [
  {
    id: "rec-1",
    name: "Summit Softshell Jacket",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/470x450",
    sku: "REC-001",
    type: "product" as const,
    desc: "Softshell jacket for outdoor activities.",
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
    price: 35.99,
    imageUrl: "https://via.placeholder.com/470x450",
    sku: "REC-003",
    type: "product" as const,
    desc: "Waterproof rain jacket.",
    tags: ["Sale"],
  },
  {
    id: "rec-4",
    name: "Expedition Shell Jacket",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/470x450",
    sku: "REC-004",
    type: "product" as const,
    desc: "Heavy duty shell jacket.",
    tags: ["Best Seller"],
  },
];

// component
export default function ProductRecommendations() {
  // render
  return (
    <div className="pdp-recommend-section">
      <h2 className="pdp-recommend-title">You’ll love these</h2>
      <div className="pdp-recommend-grid">
        {MOCK_RECOMMENDATIONS.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </div>
  );
}
