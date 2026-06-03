import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

export type BreadcrumbItem = {
  label: string;
  path?: string;
  isActive?: boolean;
};

export function useProductBreadcrumb() {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    const fetchBreadcrumbs = async () => {
      try {
        if (!slug) return;
        const response = await axiosClient.get(
          `/products/store/details/${slug}`,
        );
        const product = response.data;

        // Tạo breadcrumbs động
        const generatedCrumbs: BreadcrumbItem[] = [
          { label: "Trang chủ", path: "/" },
        ];

        // Lấy category gốc của sản phẩm (nếu có)
        if (product.categories && product.categories.length > 0) {
          const mainCat = product.categories[0];
          generatedCrumbs.push({
            label: mainCat.name,
            path: `/store?category=${mainCat.slug}`,
          });
        }

        // Tên SP hiện tại
        generatedCrumbs.push({ label: product.name, isActive: true });

        setBreadcrumbs(generatedCrumbs);
      } catch (error) {
        console.error("Lỗi khi tạo Breadcrumb:", error);
      }
    };

    fetchBreadcrumbs();
  }, [slug]);

  const handleBreadcrumbClick = (path?: string) => {
    if (!path) return;
    navigate(path);
  };

  return {
    breadcrumbs,
    handleBreadcrumbClick,
  };
}
