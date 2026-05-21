import { useState } from "react";

// mock data
const MOCK_PRODUCT = {
  id: "prd-001",
  name: "Field Utility Jacket",
  price: 35.99,
  desc: "Based on the jacket's rugged design, durable fabric, and highly practical features like the multiple storage pockets, I would name it The Field Utility Jacket. This name highlights its purpose for active outdoor use rather than just fashion.",
  details:
    "- Style: Women’s Field / Utility Jacket\n- Fit: Regular fit – slightly tailored, comfortable without being tight\n- Hood: Attached hood with adjustable drawstrings\n- Zipper: Durable, easy-to-use full-length front zipper\n- Pockets: 2 front cargo pockets with flaps and snap closures, 1 vertical zippered chest pocket",
  colors: [
    { id: "c1", hex: "#B1B1B1", name: "Taupe Gray" },
    { id: "c2", hex: "#464646", name: "Dark Charcoal" },
    { id: "c3", hex: "#827558", name: "Olive Brown" },
    { id: "c4", hex: "#D3D2D1", name: "Light Silver" },
    { id: "c5", hex: "#47624F", name: "Forest Green" },
    { id: "c6", hex: "#767366", name: "Khaki" },
  ],
  sizes: ["S", "M", "L", "XL"],
  images: [
    "https://via.placeholder.com/960x740/e5e7eb/000?text=Hinh+Nhin+Thang",
    "https://via.placeholder.com/320x211/d1d5db/000?text=Hinh+Nhin+Trai",
    "https://via.placeholder.com/320x211/9ca3af/000?text=Hinh+Nhin+Phai",
    "https://via.placeholder.com/320x211/6b7280/000?text=Hinh+Chi+Tiet",
  ],
};

// hooks
export function useProductDetail() {
  // states
  const [product] = useState(MOCK_PRODUCT);
  const [selectedColor, setSelectedColor] = useState(MOCK_PRODUCT.colors[0]);
  const [selectedSize, setSelectedSize] = useState("M");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // handlers
  const handleColorChange = (color: (typeof MOCK_PRODUCT.colors)[0]) => {
    setSelectedColor(color);
    setActiveImageIndex(0);
  };

  const handleSizeChange = (size: string) => {
    setSelectedSize(size);
  };

  const handleImageChange = (index: number) => {
    setActiveImageIndex(index);
  };

  return {
    product,
    selectedColor,
    selectedSize,
    activeImageIndex,
    handleColorChange,
    handleSizeChange,
    handleImageChange,
  };
}
