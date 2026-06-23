// imports
import React from "react";
import { useProductBreadcrumb } from "../../hooks/productDetail/useProductBreadcrumb";
import "./ProductBreadcrumb.css";

// component
export default function ProductBreadcrumb() {
  const { breadcrumbs, handleBreadcrumbClick } = useProductBreadcrumb();

  // render
  return (
    <div className="pdp-breadcrumb">
      {breadcrumbs.map((item, idx) => (
        <React.Fragment key={idx}>
          <span
            className={item.isActive ? "active" : ""}
            onClick={() => handleBreadcrumbClick(item.path)}
            style={{ cursor: item.path ? "pointer" : "default" }}
          >
            {item.label}
          </span>
          {idx < breadcrumbs.length - 1 && (
            <span className="pdp-breadcrumb-separator">{">"}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
