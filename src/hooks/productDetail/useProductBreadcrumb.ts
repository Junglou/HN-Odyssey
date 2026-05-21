import { useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- Import thư viện của bạn

export type BreadcrumbItem = {
  label: string;
  path?: string;
  isActive?: boolean;
};

// Đã bổ sung đường dẫn (path) cho các mục
const MOCK_BREADCRUMBS: BreadcrumbItem[] = [
  { label: "Homepage", path: "/" },
  { label: "Woman", path: "/woman" },
  { label: "Jacket", path: "/woman/jacket" },
  { label: "Field Utility Jacket", isActive: true },
];

export function useProductBreadcrumb() {
  const [breadcrumbs] = useState<BreadcrumbItem[]>(MOCK_BREADCRUMBS);
  const navigate = useNavigate();

  const handleBreadcrumbClick = (path?: string) => {
    if (!path) return;
    navigate(path);
  };

  return {
    breadcrumbs,
    handleBreadcrumbClick,
  };
}
