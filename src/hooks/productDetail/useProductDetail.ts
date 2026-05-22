import { useState } from "react";

// mock data
const MOCK_PRODUCT = {
  id: "prd-001",
  name: "Field Utility Jacket",
  price: 35.99,
  originalPrice: 45.99,
  stock: 15,
  desc: "Based on the jacket's rugged design, durable fabric, and highly practical features like the multiple storage pockets, I would name it The Field Utility Jacket. This name highlights its purpose for active outdoor use rather than just fashion.",
  details: "- Style: Women’s Field / Utility Jacket\n- Fit: Regular fit",
  colors: [
    {
      id: "c1",
      hex: "#B1B1B1",
      name: "Taupe Gray",
      images: [
        "https://via.placeholder.com/960x740/B1B1B1/000?text=Xam+Thang",
        "https://via.placeholder.com/320x211/B1B1B1/000?text=Xam+Trai",
      ],
    },
    {
      id: "c2",
      hex: "#464646",
      name: "Dark Charcoal",
      images: [
        "https://via.placeholder.com/960x740/464646/fff?text=Den+Thang",
        "https://via.placeholder.com/320x211/464646/fff?text=Den+Trai",
      ],
    },
    {
      id: "c3",
      hex: "#827558",
      name: "Olive Brown",
      images: ["https://via.placeholder.com/960x740/827558/fff?text=Nau+Thang"],
    },
    {
      id: "c4",
      hex: "#D3D2D1",
      name: "Light Silver",
      images: ["https://via.placeholder.com/960x740/D3D2D1/000?text=Bac+Thang"],
    },
    {
      id: "c5",
      hex: "#47624F",
      name: "Forest Green",
      images: [
        "https://via.placeholder.com/960x740/47624F/fff?text=Xanh+Thang",
      ],
    },
    {
      id: "c6",
      hex: "#767366",
      name: "Khaki",
      images: [
        "https://via.placeholder.com/960x740/767366/fff?text=Khaki+Thang",
      ],
    },
  ],
  sizes: ["S", "M", "L", "XL"],
};

// hook
export function useProductDetail() {
  // states
  const [product] = useState(MOCK_PRODUCT);
  const [selectedColor, setSelectedColor] = useState(MOCK_PRODUCT.colors[0]);
  const [selectedSize, setSelectedSize] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState<number | string>(1);

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

  const handleQuantityChange = (type: "inc" | "dec") => {
    setQuantity((prev) => {
      const current = typeof prev === "number" ? prev : 1;
      if (type === "dec" && current > 1) return current - 1;
      if (type === "inc" && current < product.stock) return current + 1;
      return current;
    });
  };

  const handleQuantityInput = (value: string) => {
    if (value === "") {
      setQuantity("");
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num)) setQuantity(num);
  };

  const handleQuantityBlur = () => {
    let current =
      typeof quantity === "number"
        ? quantity
        : parseInt(quantity as string, 10);
    if (isNaN(current) || current < 1) current = 1;
    if (current > product.stock) current = product.stock;
    setQuantity(current);
  };

  return {
    product,
    selectedColor,
    selectedSize,
    activeImageIndex,
    quantity,
    handleColorChange,
    handleSizeChange,
    handleImageChange,
    handleQuantityChange,
    handleQuantityInput,
    handleQuantityBlur,
  };
}
