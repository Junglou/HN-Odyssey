import "./VariantManagement.css";
import { CleanTrashIcon } from "../../../../assets/icons/VariantManagementIcons";
import { EditPenIcon } from "../../../../assets/icons/ProductManagementIcons";

import type { Attribute } from "../../../../hooks/portal/ProductCatalog/VariantManagement/useVariantManagement";

interface VariantManagementProps {
  data: Attribute[];
  search: string;
  actions: {
    changeSearch: (val: string) => void;
    openDrawer: (mode: "add" | "edit", attribute?: Attribute) => void;
    openDeleteModal: (id: string) => void;
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
          <h1 className="vm-title">Attribute Management</h1>
          <p className="vm-breadcrumb">
            Product Catalog / Attribute Management
          </p>
        </div>
        <button
          type="button"
          className="vm-btn-add"
          onClick={() => actions.openDrawer("add")}
        >
          Add New Attribute
        </button>
      </div>

      <div className="vm-card">
        <div className="vm-filters-row">
          <input
            type="text"
            className="vm-search-input"
            placeholder="Search by name, code..."
            value={search}
            onChange={(e) => actions.changeSearch(e.target.value)}
          />
        </div>

        <div className="vm-table-wrapper">
          <table className="vm-table">
            <thead>
              <tr>
                <th style={{ width: "20%" }}>Name</th>
                <th style={{ width: "15%" }}>Code</th>
                <th style={{ width: "15%" }}>Display Type</th>
                <th style={{ width: "25%" }}>Values</th>
                <th style={{ width: "15%" }}>Status</th>
                <th style={{ width: "10%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((attr) => (
                  <tr key={attr.id}>
                    <td className="font-medium">{attr.name}</td>
                    <td>{attr.code}</td>
                    <td>{attr.display_type}</td>
                    <td>
                      {attr.values.length} value(s){" "}
                      <span style={{ fontSize: "12px", color: "#666" }}>
                        (
                        {attr.values
                          .slice(0, 3)
                          .map((v) => v.label)
                          .join(", ")}
                        {attr.values.length > 3 ? "..." : ""})
                      </span>
                    </td>
                    <td>
                      <span
                        className={`vm-status-badge ${
                          attr.is_active ? "status-Active" : "status-Inactive"
                        }`}
                      >
                        <span className="vm-dot"></span>{" "}
                        {attr.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="vm-action-group">
                        <button
                          type="button"
                          className="vm-icon-btn"
                          title="Edit Attribute"
                          onClick={() => actions.openDrawer("edit", attr)}
                        >
                          <EditPenIcon />
                        </button>

                        <button
                          type="button"
                          className="vm-icon-btn"
                          title="Delete Attribute"
                          onClick={() => actions.openDeleteModal(attr.id)}
                        >
                          <CleanTrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="vm-td-empty">
                    No attributes found.
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
