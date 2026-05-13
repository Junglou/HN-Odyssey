import React, { useState, useRef, useEffect } from "react";
import ExcelJS from "exceljs";
import type {
  TicketType,
  TicketItem,
  StockTicketRow,
} from "../../../../hooks/portal/Warehouse/useStockTickets";
import "./CreateTicketDrawer.css";

// icons
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import {
  TrashIcon,
  ArrowLeftIcon,
} from "../../../../assets/icons/StockManagementIcons";

// mock data inventory
const MOCK_INVENTORY = [
  { sku: "LOGI-GPX-BLK", name: "Logitech G Pro X Superlight", available: 150 },
  { sku: "KEYC-Q1P-ISO", name: "Keychron Q1 Pro", available: 50 },
  { sku: "RAZ-V2-PRO", name: "Razer Viper V2 Pro", available: 120 },
];

const MOCK_EXPORT_REASONS = [
  { value: "XUAT_HUY", label: "Xuất hủy hàng hỏng" },
  { value: "XUAT_TRA_NCC", label: "Xuất trả Nhà cung cấp" },
  { value: "XUAT_NOI_BO", label: "Xuất dùng nội bộ" },
];

export interface NewTicketPayload extends Omit<
  StockTicketRow,
  "id" | "ticketCode" | "createdDate" | "createdBy" | "status"
> {
  status: "processing" | "completed" | "cancelled";
  supplier?: string;
  exportReason?: string;
}

// props
interface CreateTicketDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: TicketType;
  onSubmit: (payload: NewTicketPayload) => void;
}

// internal type for ui
interface UITicketItem extends TicketItem {
  uiId: string;
}

// dropdown
function CustomDrawerDropdown({
  value,
  options,
  onChange,
  placeholder = "Select...",
  showSearch = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
  showSearch?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) =>
    opt.value.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="ctd-custom-dropdown" ref={dropdownRef}>
      <div
        className={`ctd-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span className={!selectedOption ? "placeholder" : ""}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon
          className={`ctd-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </div>

      <div
        className={`ctd-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {/* Ô nhập từ khóa tìm kiếm */}
        {showSearch && (
          <div className="ctd-dropdown-search">
            <input
              type="text"
              placeholder="Search SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
        )}

        {/* Render danh sách đã lọc */}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => (
            <div
              key={opt.value}
              className={`ctd-dropdown-option ${value === opt.value ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))
        ) : (
          <div className="ctd-dropdown-empty">No results found.</div>
        )}
      </div>
    </div>
  );
}

// wrapper component
export default function CreateTicketDrawer(props: CreateTicketDrawerProps) {
  if (!props.isOpen) return null;
  return (
    <CreateTicketDrawerContent
      key={props.isOpen ? "open" : "closed"}
      {...props}
    />
  );
}

// main content component
function CreateTicketDrawerContent({
  onClose,
  type,
  onSubmit,
}: CreateTicketDrawerProps) {
  // general states
  const [currentType, setCurrentType] = useState<TicketType>(type);
  const [warehouse, setWarehouse] = useState("");
  const [ticketNote, setTicketNote] = useState("");
  const [items, setItems] = useState<UITicketItem[]>([]);

  const [supplier, setSupplier] = useState("");
  const [exportReason, setExportReason] = useState("");

  // form states (manual entry)
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formQuantity, setFormQuantity] = useState<number | "">("");
  const [formReason, setFormReason] = useState("");
  const [availableQty, setAvailableQty] = useState<number | null>(null);

  // refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTotalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  const alreadyAddedQty = items
    .filter((item) => item.sku === formSku)
    .reduce((sum, item) => sum + item.quantity, 0);

  // validation
  const isOverQty =
    currentType === "export" &&
    availableQty !== null &&
    Number(formQuantity) + alreadyAddedQty > availableQty;

  const isAddDisabled =
    !formSku || !formQuantity || Number(formQuantity) <= 0 || isOverQty;

  const isSubmitDisabled =
    items.length === 0 ||
    !warehouse ||
    (currentType === "import" && !supplier.trim()) ||
    (currentType === "export" && !exportReason);

  // handlers
  const handleAddToList = () => {
    if (isAddDisabled) return;
    const newItem: UITicketItem = {
      uiId: Date.now().toString(),
      sku: formSku,
      productName: formName || "Unknown Product",
      quantity: Number(formQuantity),
      reason: formReason,
    };
    setItems((prev) => [...prev, newItem]);

    setFormSku("");
    setFormName("");
    setFormQuantity("");
    setFormReason("");
    setAvailableQty(null);
  };

  const handleRemoveItem = (uiId: string) => {
    setItems((prev) => prev.filter((item) => item.uiId !== uiId));
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        alert("File Excel trống!");
        return;
      }

      const newItems: UITicketItem[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const sku = row.getCell(1).text?.trim();
        const productName = row.getCell(2).text?.trim() || "Unknown Product";
        const quantity = Number(row.getCell(3).value);
        const reason = row.getCell(4).text?.trim() || "Excel Import";

        if (sku && quantity > 0) {
          newItems.push({
            uiId: Date.now().toString() + "-" + rowNumber,
            sku,
            productName,
            quantity,
            reason,
          });
        }
      });

      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
      } else {
        alert(
          "Không tìm thấy dữ liệu hợp lệ! Định dạng chuẩn: Cột A (SKU), Cột C (Số lượng).",
        );
      }
    } catch (error) {
      console.error("Lỗi đọc Excel:", error);
      alert("File không đúng định dạng hoặc bị hỏng!");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = () => {
    if (isSubmitDisabled) return;

    const cleanItems: TicketItem[] = items.map((item) => ({
      sku: item.sku,
      productName: item.productName,
      quantity: item.quantity,
      reason: item.reason,
    }));

    onSubmit({
      type: currentType,
      status: "processing",
      totalQuantity: currentTotalQty,
      items: cleanItems,
      warehouse,
      note: ticketNote,
      supplier,
      exportReason,
    });

    onClose();
  };

  // render
  return (
    <div className="ctd-overlay">
      <div className="ctd-drawer">
        {/* header */}
        <div className="ctd-header">
          <button className="ctd-back-btn" onClick={onClose} title="Go back">
            <ArrowLeftIcon />
          </button>
          <h2>Create Ticket</h2>
        </div>

        {/* body */}
        <div className="ctd-body">
          {/* info section */}
          <div className="ctd-info-stack">
            <div className="ctd-form-group">
              <label className="ctd-label">Type</label>
              <CustomDrawerDropdown
                value={currentType}
                options={[
                  { value: "import", label: "Import" },
                  { value: "export", label: "Export" },
                ]}
                onChange={(val) => {
                  const newType = val as TicketType;
                  if (newType !== currentType) {
                    setCurrentType(newType);
                    setItems([]);
                    setFormSku("");
                    setFormName("");
                    setFormQuantity("");
                    setFormReason("");
                    setAvailableQty(null);
                    setSupplier("");
                    setExportReason("");
                  }
                }}
              />
            </div>

            {currentType === "import" ? (
              <div className="ctd-form-group">
                <label className="ctd-label">Supplier *</label>
                <input
                  type="text"
                  className="ctd-input"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Enter supplier name..."
                />
              </div>
            ) : (
              <div className="ctd-form-group">
                <label className="ctd-label">Export Reason *</label>
                <CustomDrawerDropdown
                  value={exportReason}
                  options={MOCK_EXPORT_REASONS}
                  onChange={(val) => setExportReason(val)}
                  placeholder="Select export reason..."
                />
              </div>
            )}

            <div className="ctd-form-group">
              <label className="ctd-label">Warehouse *</label>
              <CustomDrawerDropdown
                value={warehouse}
                options={[
                  { value: "WH-HN-01", label: "Main Warehouse - A1" },
                  { value: "WH-HCM-01", label: "Main Warehouse - B1" },
                ]}
                onChange={(val) => setWarehouse(val)}
                placeholder="Select warehouse..."
              />
            </div>
            <div className="ctd-form-group">
              <label className="ctd-label">Description/Note</label>
              <textarea
                className="ctd-input ctd-textarea"
                value={ticketNote}
                onChange={(e) => setTicketNote(e.target.value)}
              />
            </div>
          </div>

          {/* entry section */}
          <div className="ctd-section ctd-entry-section">
            <div className="ctd-entry-header">
              <h3>Manual Entry</h3>
              <div className="ctd-form-action">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleImportExcel}
                />
                <button
                  className="ctd-btn-outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import Excel
                </button>
                <button
                  className="ctd-btn-add"
                  onClick={handleAddToList}
                  disabled={isAddDisabled}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="ctd-form-grid">
              <div className="ctd-form-group">
                <label className="ctd-label">SKU *</label>
                {currentType === "export" ? (
                  <CustomDrawerDropdown
                    value={formSku}
                    options={MOCK_INVENTORY.map((item) => ({
                      value: item.sku,
                      label: item.sku,
                    }))}
                    showSearch={true}
                    onChange={(selectedSku) => {
                      setFormSku(selectedSku);
                      const found = MOCK_INVENTORY.find(
                        (item) => item.sku === selectedSku,
                      );
                      if (found) {
                        setFormName(found.name);
                        setAvailableQty(found.available);
                      }
                    }}
                    placeholder="Select product..."
                  />
                ) : (
                  <input
                    type="text"
                    className="ctd-input"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="Enter SKU..."
                  />
                )}
              </div>
              <div className="ctd-form-group">
                <label className="ctd-label">Product Name</label>
                <input
                  type="text"
                  className="ctd-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter name..."
                  readOnly={currentType === "export"}
                />
              </div>
              <div className="ctd-form-group">
                <label className="ctd-label ctd-label-flex">
                  <span>Qty *</span>
                  {currentType === "export" && availableQty !== null && (
                    <span className="ctd-avail-text">
                      (Avail: {availableQty})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  className={`ctd-input ${isOverQty ? "ctd-input-error" : ""}`}
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(Number(e.target.value))}
                  placeholder="0"
                  min="1"
                />
              </div>
              <div className="ctd-form-group">
                <label className="ctd-label">Note</label>
                <input
                  type="text"
                  className="ctd-input"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Line note..."
                />
              </div>
            </div>
            {isOverQty && (
              <div className="ctd-error-text">
                {alreadyAddedQty > 0
                  ? `Cannot add! You already added ${alreadyAddedQty} to the list. Available stock is ${availableQty}.`
                  : "Cannot export more than available stock!"}
              </div>
            )}
          </div>

          {/* table section */}
          <div className="ctd-section">
            <h3>Product List ({items.length})</h3>
            <div className="ctd-table-wrapper">
              <table className="ctd-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Qty</th>
                    <th>Note</th>
                    <th style={{ width: "50px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="ctd-empty">
                        No products added yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.uiId}>
                        <td className="ctd-font-mono">{item.sku}</td>
                        <td>{item.productName}</td>
                        <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                        <td>{item.reason || "-"}</td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="ctd-btn-delete"
                            onClick={() => handleRemoveItem(item.uiId)}
                            title="Remove item"
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="ctd-table-footer">
                Total Quantity: <span>{currentTotalQty}</span>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="ctd-footer">
          <button className="ctd-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ctd-btn-submit"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
          >
            Create Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
