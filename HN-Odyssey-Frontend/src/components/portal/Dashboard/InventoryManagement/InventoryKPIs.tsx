import "./InventoryKPIs.css";
import {
  BoxIcon,
  DollarIcon,
  TruckIcon,
  RefreshIcon,
} from "../../../../assets/icons/InventoryManagementIcons";
import type { InventoryKPI } from "../../../../hooks/portal/Dashboard/InventoryManagement/useInventoryManagement";

interface InventoryKPIsProps {
  kpis: InventoryKPI[];
}

export default function InventoryKPIs({ kpis }: InventoryKPIsProps) {
  if (!kpis || kpis.length === 0) return null;

  const renderIcon = (type: string) => {
    switch (type) {
      case "box":
        return <BoxIcon />;
      case "dollar":
        return <DollarIcon />;
      case "truck":
        return <TruckIcon />;
      case "refresh":
        return <RefreshIcon />;
      default:
        return null;
    }
  };

  return (
    <div className="ikpi-wrapper">
      <div className="ikpi-grid">
        {kpis.map((item, index) => (
          <div className="ikpi-card" key={index}>
            <div className="ikpi-icon-box">{renderIcon(item.iconType)}</div>
            <div className="ikpi-content">
              <span className="ikpi-label">{item.title}</span>
              <div className="ikpi-value-row">
                <span className="ikpi-value">{item.value}</span>
                <span className="ikpi-subtext">{item.subtext}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
