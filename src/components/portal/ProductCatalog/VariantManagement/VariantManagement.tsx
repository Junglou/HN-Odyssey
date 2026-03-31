import "./VariantManagement.css";
import { CleanTrashIcon } from "../../../../assets/icons/VariantManagementIcons";
import { EditPenIcon } from "../../../../assets/icons/ProductManagementIcons";

// type và logic quản lý biến thể
import type { Variant } from "../../../../hooks/portal/ProductCatalog/VariantManagement/useVariantManagement";

// component quản lý biến thể
interface VariantManagementProps {
  data: Variant[];
  search: string;
  actions: {
    changeSearch: (val: string) => void;
    openDrawer: (mode: "add" | "edit", variant?: Variant) => void;
    deleteSingle: (id: number) => void;
  };
}

export default function VariantManagement({
  data,
  search,
  actions,
}: VariantManagementProps) {
  return (
    <div className="vm-container">
      <div className="vm-header">
        <div>
          <h1 className="vm-title">Variant Management</h1>
          <p className="vm-breadcrumb">Product Catalog / Variant Management</p>
        </div>
        <button
          type="button"
          className="vm-btn-add"
          onClick={() => actions.openDrawer("add")}
        >
          Add New Variant
        </button>
      </div>

      <div className="vm-card">
        <div className="vm-filters-row">
          <input
            type="text"
            className="vm-search-input"
            placeholder="Search by name or value..."
            aria-label="Search variants"
            value={search}
            onChange={(e) => actions.changeSearch(e.target.value)}
          />
        </div>

        <div className="vm-table-wrapper">
          <table className="vm-table">
            <thead>
              <tr>
                <th style={{ width: "25%" }}>Variant Name</th>
                <th style={{ width: "40%" }}>Variant Values</th>
                <th style={{ width: "20%" }}>Status</th>
                <th style={{ width: "15%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((variant) => (
                  <tr key={variant.id}>
                    <td>{variant.name}</td>
                    <td>
                      <div className="vm-values-group">
                        {variant.values.length > 0 ? (
                          variant.values.map((val) => (
                            <span
                              key={`${variant.id}-${val}`}
                              className="vm-chip"
                            >
                              {val}
                            </span>
                          ))
                        ) : (
                          <span className="vm-empty-text">Empty</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`vm-status-badge status-${variant.status}`}
                      >
                        <span className="vm-dot"></span> {variant.status}
                      </span>
                    </td>
                    <td>
                      <div className="vm-action-group">
                        <button
                          type="button"
                          className="vm-icon-btn"
                          title="Edit Variant"
                          onClick={() => actions.openDrawer("edit", variant)}
                        >
                          <EditPenIcon />
                        </button>

                        <button
                          type="button"
                          className="vm-icon-btn"
                          title="Delete Variant"
                          onClick={() => actions.deleteSingle(variant.id)}
                        >
                          <CleanTrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="vm-td-empty">
                    No variants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
