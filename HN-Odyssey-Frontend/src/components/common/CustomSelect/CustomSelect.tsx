import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import "./CustomSelect.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Hiện ô tìm kiếm trong danh sách — nên bật khi danh sách dài (tỉnh/thành, chiến dịch...) */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Giữ hành vi `required` của form giống <select> gốc (chặn submit khi chưa chọn) */
  required?: boolean;
  /** md: ô nhập trong form; sm: bộ lọc gọn trên thanh tiêu đề */
  size?: "md" | "sm";
  id?: string;
  className?: string;
  style?: CSSProperties;
}

// Bỏ dấu tiếng Việt: gõ "ho chi minh" vẫn tìm ra "Hồ Chí Minh"
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search...",
  required = false,
  size = "md",
  id,
  className = "",
  style,
}: CustomSelectProps) {
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const [dropUp, setDropUp] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = normalize(query);
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, query, searchable]);

  const open = () => {
    if (disabled) return;
    // Phía dưới không đủ chỗ (vd. ô cuối trong modal có thanh cuộn) → mở lên trên
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 300 && rect.top > spaceBelow);
    }
    setIsOpen(true);
    setQuery("");
    setHighlight(options.findIndex((o) => o.value === value));
  };

  const close = () => {
    setIsOpen(false);
    setQuery("");
  };

  const choose = (opt: SelectOption) => {
    onChange(opt.value);
    close();
    triggerRef.current?.focus();
  };

  // Bấm ra ngoài thì đóng
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Mở ra thì con trỏ vào sẵn ô tìm kiếm
  useEffect(() => {
    if (isOpen && searchable) searchRef.current?.focus();
  }, [isOpen, searchable]);

  // Dùng phím mũi tên thì cuộn tới mục đang sáng
  useEffect(() => {
    if (!isOpen || highlight < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight, isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        open();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        triggerRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => Math.min(filtered.length - 1, h + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlight]) choose(filtered[highlight]);
        break;
      case " ":
        // Trong ô tìm kiếm thì phím cách là gõ chữ, không phải chọn
        if (!searchable) {
          e.preventDefault();
          if (filtered[highlight]) choose(filtered[highlight]);
        }
        break;
      case "Tab":
        close();
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      id={id}
      className={`cs-root cs-${size} ${disabled ? "cs-disabled" : ""} ${className}`}
      style={style}
    >
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-disabled={disabled}
        className={`cs-trigger ${isOpen ? "active" : ""}`}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
      >
        <span className={selected ? "cs-value" : "cs-placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          className={`cs-arrow ${isOpen ? "open" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Ô ẩn để form vẫn chặn submit khi bắt buộc mà chưa chọn (giống thẻ select gốc có required) */}
      {required && (
        <input
          className="cs-native-proxy"
          tabIndex={-1}
          aria-hidden="true"
          required
          disabled={disabled}
          value={value}
          onChange={() => undefined}
        />
      )}

      {isOpen && (
        <div className={`cs-panel ${dropUp ? "up" : ""}`}>
          {searchable && (
            <div className="cs-search">
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}

          <div ref={listRef} id={listId} role="listbox" className="cs-list">
            {filtered.length === 0 ? (
              <div className="cs-empty">No results found</div>
            ) : (
              filtered.map((opt, i) => (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  data-index={i}
                  className={`cs-option ${opt.value === value ? "selected" : ""} ${
                    i === highlight ? "highlighted" : ""
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(opt)}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
