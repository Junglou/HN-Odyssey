import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import type {
  TicketType,
  TicketItem,
  StockTicketRow,
  TicketStatus,
} from "../../../../hooks/portal/Warehouse/useStockTickets";
import axiosClient from "../../../../api/axiosClient";
import "./CreateTicketDrawer.css";

// icons
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import {
  TrashIcon,
  ArrowLeftIcon,
} from "../../../../assets/icons/StockManagementIcons";

// Khai báo kiểu dữ liệu trả về từ API để tránh dùng any
interface BackendVariant {
  sku: string;
  stock?: number;
}

interface BackendProduct {
  sku: string;
  name: string;
  stock?: number;
  has_variants: boolean;
  variants?: BackendVariant[];
}

interface PreviewItem {
  row: number;
  sku: string;
  quantity: number;
  note: string;
  status: "VALID" | "INVALID";
  errors: string[];
  product_id?: string;
}

interface PreviewResponse {
  data: PreviewItem[];
  can_import?: boolean;
  can_export?: boolean;
}

interface ErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

// Hằng số tĩnh cho Lý do xuất (vẫn giữ vì đây là logic cố định của FE/BE)
const EXPORT_REASON_OPTIONS = [
  { value: "XUAT_HUY", label: "Xuất hủy hàng hỏng" },
  { value: "XUAT_TRA_NCC", label: "Xuất trả Nhà cung cấp" },
  { value: "XUAT_NOI_BO", label: "Xuất dùng nội bộ" },
];

export interface NewTicketPayload extends Omit<
  StockTicketRow,
  "id" | "ticketCode" | "createdDate" | "createdBy" | "status"
> {
  status: TicketStatus;
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

// dropdown component
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
  const [warehouseOptions, setWarehouseOptions] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    const mockWarehouses = [
      { value: "WH-HCM-01", label: "Kho Tổng - TP.Hồ Chí Minh" },
      { value: "WH-HN-01", label: "Kho Trung Chuyển - Hà Nội" },
      { value: "WH-DN-01", label: "Kho Bán Lẻ - Đà Nẵng" },
    ];

    // Gán thẳng data giả vào state
    setWarehouseOptions(mockWarehouses);
  }, []);

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

  // Hàm check SKU đơn lẻ
  const handleCheckSku = async () => {
    const inputSku = formSku.trim();
    if (!inputSku) return;

    try {
      // API search có thể trả về nhiều kết quả khớp một phần (tên, slug, tags...)
      const res = await axiosClient.get("/products", {
        params: { search: inputSku },
      });

      const productsList: BackendProduct[] = res.data?.data || res.data || [];

      // 1. TÌM CHÍNH XÁC SẢN PHẨM CÓ MÃ SKU KHỚP 100%
      // (Khớp SKU cha HOẶC khớp SKU của một trong các biến thể)
      const exactProduct = productsList.find(
        (p) =>
          p.sku === inputSku ||
          (p.has_variants && p.variants?.some((v) => v.sku === inputSku)),
      );

      // Nếu không có sản phẩm nào khớp chính xác mã SKU đã nhập
      if (!exactProduct) {
        throw new Error("SKU_NOT_FOUND");
      }

      setFormName(exactProduct.name);

      // 2. NẾU LÀ SẢN PHẨM CÓ BIẾN THỂ
      if (exactProduct.has_variants && exactProduct.variants) {
        // Trường hợp user nhập đúng SKU của sản phẩm cha (đòi hỏi phải nhập SKU của biến thể)
        if (exactProduct.sku === inputSku) {
          toast.warning(
            "Sản phẩm này có nhiều phân loại. Vui lòng nhập mã SKU của Biến thể (Size/Màu cụ thể), không nhập SKU Sản phẩm gốc!",
          );
          setAvailableQty(null);
          setFormName("");
          return;
        }

        // Lấy đúng biến thể khớp SKU
        const variant = exactProduct.variants.find((v) => v.sku === inputSku);
        if (variant) {
          setAvailableQty(Number(variant.stock) || 0);
        } else {
          throw new Error("SKU_NOT_FOUND");
        }
      }
      // 3. NẾU LÀ SẢN PHẨM ĐƠN GIẢN (KHÔNG CÓ BIẾN THỂ)
      else {
        if (exactProduct.sku !== inputSku) {
          throw new Error("SKU_NOT_FOUND");
        }
        setAvailableQty(Number(exactProduct.stock) || 0);
      }
    } catch {
      toast.error(
        "Mã SKU không tồn tại! Vui lòng yêu cầu bộ phận Sản phẩm tạo mã này trước.",
      );
      setFormName("");
      setAvailableQty(null);
    }
  };

  // validation
  const isOverQty =
    currentType === "export" &&
    availableQty !== null &&
    Number(formQuantity) + alreadyAddedQty > availableQty;

  // [FIX]: Bổ sung điều kiện !formName để nút Add bị mờ nếu chưa Check thành công
  const isAddDisabled =
    !formSku ||
    !formName ||
    !formQuantity ||
    Number(formQuantity) <= 0 ||
    isOverQty;

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
      // 1. Tạo form data chứa file
      const formData = new FormData();
      formData.append("file", file);

      // 2. Xác định endpoint dựa trên loại phiếu đang thao tác
      const endpoint =
        currentType === "import"
          ? "/inventory/transactions/import/excel/preview"
          : "/inventory/transactions/export/excel/preview";

      // 3. Bắn file lên Backend để chạy validation nội bộ (tồn kho, SKU hợp lệ...)
      const res = await axiosClient.post(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // NestJS BaseResponse thường bọc dữ liệu trong res.data.data
      const responseData: PreviewResponse = res.data?.data || res.data;
      const previewItems: PreviewItem[] = responseData.data || [];

      if (!previewItems || previewItems.length === 0) {
        toast.error("File Excel trống hoặc không đúng định dạng!");
        return;
      }

      // 4. Phân loại item hợp lệ và không hợp lệ
      const validItems = previewItems.filter((item) => item.status === "VALID");
      const invalidItems = previewItems.filter(
        (item) => item.status === "INVALID",
      );

      // 5. Cảnh báo cho người dùng nếu có dòng lỗi
      if (invalidItems.length > 0) {
        const errorDetails = invalidItems
          .map((i) => `Dòng ${i.row} (SKU: ${i.sku}): ${i.errors.join(", ")}`)
          .join("\n");
        toast.warning(
          `Phát hiện ${invalidItems.length} dòng lỗi, các dòng này sẽ bị bỏ qua:\n\n${errorDetails}`,
        );
      }

      // 6. Map các item hợp lệ vào mảng của form
      if (validItems.length > 0) {
        const newItems: UITicketItem[] = validItems.map((item) => ({
          uiId: Date.now().toString() + "-" + item.row,
          sku: item.sku,
          productName: "Sản phẩm từ Excel", // Backend preview không trả về tên, dùng placeholder
          quantity: item.quantity,
          reason: item.note || "Excel Import",
        }));

        setItems((prev) => [...prev, ...newItems]);
      }
    } catch (error: unknown) {
      console.error("Lỗi xác thực file Excel từ BE:", error);
      const err = error as ErrorResponse;
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Lỗi khi tải file lên hệ thống!";
      toast.error(errorMessage);
    } finally {
      // Reset input để có thể up lại cùng 1 file nếu cần
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      // Xác định endpoint dựa trên loại phiếu import hay export
      const endpoint =
        currentType === "import"
          ? "/inventory/transactions/import/excel/template"
          : "/inventory/transactions/export/excel/template";

      // Yêu cầu kiểu dữ liệu trả về là blob để xử lý file nhị phân
      const response = await axiosClient.get(endpoint, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Tạo url tạm thời và kích hoạt sự kiện tải file xuống trình duyệt
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const fileName =
        currentType === "import"
          ? "Template_NhapKho.xlsx"
          : "Template_XuatKho.xlsx";
      link.setAttribute("download", fileName);

      document.body.appendChild(link);
      link.click();

      // Dọn dẹp thẻ a và url sau khi hoàn tất tải file
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      console.error("Lỗi khi tải file mẫu:", error);
      toast.error("Có lỗi xảy ra khi tải file mẫu từ hệ thống!");
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
      status: "PROCESSING",
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
                  options={EXPORT_REASON_OPTIONS}
                  onChange={(val) => setExportReason(val)}
                  placeholder="Select export reason..."
                />
              </div>
            )}

            <div className="ctd-form-group">
              <label className="ctd-label">Warehouse *</label>
              <CustomDrawerDropdown
                value={warehouse}
                options={warehouseOptions}
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
                  type="button"
                  className="ctd-btn-outline"
                  onClick={handleDownloadTemplate}
                >
                  Download Template
                </button>

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
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="ctd-input"
                    value={formSku}
                    onChange={(e) => {
                      setFormSku(e.target.value);
                      // [FIX]: Bắt buộc reset name khi đổi SKU để ép user phải Check lại
                      setFormName("");
                      setAvailableQty(null);
                    }}
                    placeholder="Enter SKU..."
                  />
                  {/* [FIX]: Bỏ check currentType, luôn hiện nút Check cho cả Import và Export */}
                  <button
                    type="button"
                    className="ctd-btn-outline"
                    onClick={handleCheckSku}
                  >
                    Check
                  </button>
                </div>
              </div>
              <div className="ctd-form-group">
                <label className="ctd-label">Product Name</label>
                <input
                  type="text"
                  className="ctd-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Click Check to get name..."
                  readOnly // [FIX]: Luôn ReadOnly, chỉ hệ thống tự điền khi Check thành công
                />
              </div>
              <div className="ctd-form-group">
                <label className="ctd-label ctd-label-flex">
                  <span>Qty *</span>
                  {/* [FIX]: Luôn hiện tồn kho hiện tại cho cả Nhập và Xuất để làm thông tin tham khảo */}
                  {availableQty !== null && (
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
