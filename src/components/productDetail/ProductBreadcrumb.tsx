// imports
import "./ProductBreadcrumb.css";

// component
export default function ProductBreadcrumb() {
  // render
  return (
    <div className="pdp-breadcrumb">
      <span>Homepage</span>
      <span className="pdp-breadcrumb-separator">{">"}</span>
      <span>Woman</span>
      <span className="pdp-breadcrumb-separator">{">"}</span>
      <span>Jacket</span>
      <span className="pdp-breadcrumb-separator">{">"}</span>
      <span className="active">Field Utility Jacket</span>
    </div>
  );
}
