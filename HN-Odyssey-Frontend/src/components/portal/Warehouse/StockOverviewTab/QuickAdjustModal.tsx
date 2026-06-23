import React, { useState, useRef, useEffect } from "react";
import "./QuickAdjustModal.css";
import { CloseIcon } from "../../../../assets/icons/RoleManagementIcons";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import type {
  AdjustPayload,
  ThresholdPayload,
} from "../../../../hooks/portal/Warehouse/useStockOverview";

interface QuickAdjustModalProps {
  isOpen: boolean;
  sku: string;
  productName: string;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  onClose: () => void;
  onSubmitAdjust: (payload: AdjustPayload) => void;
  onSubmitThreshold: (payload: ThresholdPayload) => void;
}

function ModalSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
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

  const currentLabel =
    options.find((opt) => opt.value === value)?.label || options[0]?.label;

  return (
    <div className="qam-custom-select" ref={dropdownRef}>
      <div
        className={`qam-select-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{currentLabel}</span>
        <ChevronDownIcon
          className={`qam-select-arrow ${isOpen ? "open" : ""}`}
        />
      </div>
      <div
        className={`qam-select-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`qam-select-option ${value === opt.value ? "selected" : ""}`}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuickAdjustModal({
  isOpen,
  sku,
  productName,
  currentStock,
  minStock,
  maxStock,
  onClose,
  onSubmitAdjust,
  onSubmitThreshold,
}: QuickAdjustModalProps) {
  // Tabs Navigation
  const [activeTab, setActiveTab] = useState<"adjust" | "threshold">("adjust");

  // State Adjust
  const [type, setType] = useState("add");
  const [quantity, setQuantity] = useState<number | "">("");
  const [reason, setReason] = useState("");

  // State Thresholds
  const [minInput, setMinInput] = useState<number | "">(minStock ?? 0);
  const [maxInput, setMaxInput] = useState<number | "">(maxStock ?? 999);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setMinInput(minStock ?? 0);
      setMaxInput(maxStock ?? 999);
    }
  }

  if (!isOpen) return null;

  const quantityNum = Number(quantity);
  const stockToUse = currentStock !== undefined ? currentStock : 0;
  const newStock =
    type === "add" ? stockToUse + quantityNum : stockToUse - quantityNum;

  const isOverRemove =
    type === "remove" &&
    currentStock !== undefined &&
    quantityNum > currentStock;
  const isOverMax =
    type === "add" &&
    maxStock !== undefined &&
    newStock > maxStock &&
    quantityNum > 0;
  const isUnderMin =
    type === "remove" &&
    minStock !== undefined &&
    newStock < minStock &&
    quantityNum > 0 &&
    !isOverRemove;

  const adjustOptions = [
    { value: "add", label: "Add Stock" },
    ...(currentStock === undefined || currentStock > 0
      ? [{ value: "remove", label: "Remove Stock" }]
      : []),
  ];

  const handleCloseModal = () => {
    setType("add");
    setQuantity("");
    setReason("");
    setActiveTab("adjust");
    onClose();
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0 || !reason.trim() || isOverRemove)
      return;

    onSubmitAdjust({ type, quantity: Number(quantity), reason });
    handleCloseModal();
  };

  const handleThresholdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (minInput === "" || maxInput === "") return;
    onSubmitThreshold({
      minStock: Number(minInput),
      maxStock: Number(maxInput),
    });
    handleCloseModal();
  };

  return (
    <div className="qam-modal-overlay">
      <div className="qam-modal-box">
        <div className="qam-modal-header">
          <div className="qam-header-content">
            <h2 className="qam-modal-title">Inventory Management</h2>
            <p className="qam-modal-subtitle">
              Target: <strong>{sku}</strong> - {productName}
            </p>
            {currentStock !== undefined && (
              <p className="qam-modal-subtitle qam-mt-4">
                Current Stock: <strong>{currentStock}</strong>
              </p>
            )}
          </div>
          <button
            className="qam-modal-close"
            onClick={handleCloseModal}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="qam-tabs-header">
          <button
            type="button"
            className={`qam-tab-btn ${activeTab === "adjust" ? "active" : ""}`}
            onClick={() => setActiveTab("adjust")}
          >
            Quick Adjust
          </button>
          <button
            type="button"
            className={`qam-tab-btn ${activeTab === "threshold" ? "active" : ""}`}
            onClick={() => setActiveTab("threshold")}
          >
            Min/Max Limits
          </button>
        </div>

        {activeTab === "adjust" ? (
          <form onSubmit={handleAdjustSubmit} className="qam-modal-form">
            <div className="qam-form-group">
              <label>
                Adjustment Type <span className="qam-req">*</span>
              </label>
              <ModalSelect
                value={type}
                options={adjustOptions}
                onChange={(val) => {
                  setType(val);
                  setQuantity("");
                  setReason("");
                }}
              />
            </div>

            <div className="qam-form-group">
              <label>
                Quantity <span className="qam-req">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={
                  type === "remove" && currentStock !== undefined
                    ? currentStock
                    : undefined
                }
                className="qam-input"
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="Enter quantity"
                required
              />
              {isOverRemove && (
                <span className="qam-text-danger">
                  Cannot remove more than current stock ({currentStock}).
                </span>
              )}
              {isOverMax && (
                <span className="qam-text-warning">
                  Warning: Exceeds max limit (Max: {maxStock}).
                </span>
              )}
              {isUnderMin && (
                <span className="qam-text-warning">
                  Warning: Drops below safe limit (Min: {minStock}).
                </span>
              )}
            </div>

            <div className="qam-form-group">
              <label>
                Reason <span className="qam-req">*</span>
              </label>
              <textarea
                className="qam-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter details for this adjustment"
                rows={3}
                required
              />
            </div>

            <div className="qam-modal-actions">
              <button
                type="submit"
                className="qam-btn-submit"
                disabled={
                  !quantity ||
                  Number(quantity) <= 0 ||
                  !reason.trim() ||
                  isOverRemove
                }
              >
                Confirm Adjustment
              </button>
              <button
                type="button"
                className="qam-btn-cancel"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleThresholdSubmit} className="qam-modal-form">
            <div className="qam-form-group">
              <label>
                Minimum Stock Alert <span className="qam-req">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="qam-input"
                value={minInput}
                onChange={(e) =>
                  setMinInput(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                required
              />
            </div>
            <div className="qam-form-group">
              <label>
                Maximum Stock Limit <span className="qam-req">*</span>
              </label>
              <input
                type="number"
                min="1"
                className="qam-input"
                value={maxInput}
                onChange={(e) =>
                  setMaxInput(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                required
              />
            </div>
            <div className="qam-modal-actions">
              <button
                type="submit"
                className="qam-btn-submit"
                disabled={
                  minInput === "" ||
                  maxInput === "" ||
                  Number(minInput) > Number(maxInput)
                }
              >
                Save Thresholds
              </button>
              <button
                type="button"
                className="qam-btn-cancel"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
