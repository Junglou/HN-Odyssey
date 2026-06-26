import { useState, useRef, useEffect } from "react";
import { useTradeInForm } from "../../hooks/secondCharm/useTradeInForm";
import {
  ChevronDownSolidIcon,
  UploadDropzoneIcon,
  ArrowRightIcon,
  RemovePhotoIcon,
} from "../../assets/icons/SecondCharmIcons";
import "./TradeInForm.css";

// component
function LocationDropdown({
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  // states
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // effects
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div
      className={`sc-custom-select-wrapper ${disabled ? "disabled" : ""}`}
      ref={dropdownRef}
    >
      <div
        className={`sc-custom-select-trigger ${isOpen ? "active" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={value ? "selected-text" : "placeholder-text"}>
          {selectedLabel}
        </span>
        <ChevronDownSolidIcon
          className={`sc-custom-select-icon ${isOpen ? "rotate" : ""}`}
        />
      </div>

      <div
        className={`sc-custom-select-menu ${isOpen && !disabled ? "show" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`sc-custom-select-item ${value === opt.value ? "selected" : ""}`}
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

// component chính
export default function TradeInForm() {
  const {
    formData,
    categories,
    isLoadingCategories,
    locations,
    selectedLocationCodes,
    handleProvinceChange,
    handleDistrictChange,
    handleWardChange,
    handleInputChange,
    setEvaluationMethod,
    setCategory,
    handleFileChange,
    removePhoto,
    submitTradeInRequest,
    isSubmitting,
  } = useTradeInForm();

  // states
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // effects
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // handlers
  const handleCategorySelect = (value: string) => {
    setCategory(value);
    setIsCategoryOpen(false);
    setCategorySearchTerm(""); // reset thanh tìm kiếm sau khi chọn
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()),
  );

  const renderPhotoBoxes = () => {
    const boxes = [];
    const totalBoxes = Math.max(3, formData.photos.length + 1);

    for (let i = 0; i < totalBoxes; i++) {
      if (i < formData.photos.length) {
        const fileUrl = URL.createObjectURL(formData.photos[i]);
        boxes.push(
          <div key={i} className="sc-upload-box has-image">
            <img src={fileUrl} alt={`preview ${i}`} />
            <button
              type="button"
              className="sc-remove-photo-btn"
              onClick={(e) => {
                e.stopPropagation();
                removePhoto(i);
              }}
            >
              <RemovePhotoIcon />
            </button>
          </div>,
        );
      } else {
        boxes.push(
          <div key={i} className="sc-upload-box" onClick={triggerFileInput}>
            <span className="plus">+</span>
          </div>,
        );
      }
    }
    return boxes;
  };

  return (
    <section className="sc-form-section">
      <div className="sc-form-container">
        <div className="sc-form-header">
          <h2 className="sc-form-title">Start Your Buy-Back Request</h2>
          <p className="sc-form-subtitle">
            Fill in the details below and upload photos of your item
          </p>
        </div>

        <form
          className="sc-trade-in-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await submitTradeInRequest();
          }}
        >
          <div className="sc-form-grid">
            {/* Row 1 */}
            <div className="sc-input-group">
              <label>Full Name *</label>
              <input
                type="text"
                name="fullName"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={handleInputChange}
              />
            </div>
            <div className="sc-input-group">
              <label>Email Address *</label>
              <input
                type="email"
                name="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>

            {/* Row 2 */}
            <div className="sc-input-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                name="phone"
                placeholder="+84 987 654 321"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>

            {/* Dropdown danh mục */}
            <div className="sc-input-group" ref={dropdownRef}>
              <label>Product Category *</label>
              <div
                className={`sc-custom-select ${isCategoryOpen ? "open" : ""}`}
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              >
                <div className="sc-select-value">
                  {formData.category ? (
                    categories.find((c) => c.id === formData.category)?.name
                  ) : (
                    <span className="sc-placeholder">
                      {isLoadingCategories
                        ? "Loading categories..."
                        : "Select category"}
                    </span>
                  )}
                </div>
                <ChevronDownSolidIcon
                  className={`sc-select-icon ${isCategoryOpen ? "rotate" : ""}`}
                />

                <div
                  className={`sc-select-dropdown ${isCategoryOpen ? "show" : ""}`}
                  style={{
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }} // Cố định layout cha
                >
                  {/* thanh tìm kiếm chặn click lan truyền */}
                  <div
                    className="sc-select-search-box"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#fff",
                      zIndex: 2,
                    }} // Ghim thanh tìm kiếm
                  >
                    <input
                      type="text"
                      placeholder="Search category..."
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      className="sc-category-search-input"
                    />
                  </div>

                  {/* Vùng cuộn chứa danh sách Category */}
                  <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((cat) => (
                        <div
                          key={cat.id}
                          className={`sc-select-option ${formData.category === cat.id ? "selected" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCategorySelect(cat.id);
                          }}
                        >
                          {cat.name}
                        </div>
                      ))
                    ) : (
                      <div className="sc-select-option-empty">
                        No categories found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3 - Full Width Textarea */}
            <div className="sc-input-group sc-col-span-2">
              <label>Product Description *</label>
              <textarea
                name="description"
                placeholder="Describe your item (brand, model, condition, age, etc.)"
                rows={4}
                value={formData.description}
                onChange={handleInputChange}
              ></textarea>
            </div>

            {/* Row 4 - Full Width Upload */}
            <div className="sc-input-group sc-col-span-2">
              <label>Upload Photos * (Min 3 photos)</label>

              <input
                type="file"
                multiple
                accept="image/png, image/jpeg, image/jpg"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              <div className="sc-upload-dropzone" onClick={triggerFileInput}>
                <div className="sc-upload-icon-large">
                  <UploadDropzoneIcon />
                </div>
                <p className="sc-upload-text">
                  Click to upload or drag and drop
                </p>
                <p className="sc-upload-hint">
                  PNG, JPG up to 10MB (3-6 photos recommended)
                </p>
              </div>
              <div className="sc-upload-placeholders">{renderPhotoBoxes()}</div>
            </div>

            {/* Row 5 - Evaluation Method Selection */}
            <div className="sc-input-group sc-col-span-2">
              <label>Choose Evaluation Method *</label>
              <div className="sc-evaluation-methods">
                <div
                  className={`sc-eval-card ${formData.evaluationMethod === "store" ? "selected" : ""}`}
                  onClick={() => setEvaluationMethod("store")}
                >
                  <div className="sc-eval-radio">
                    <div className="sc-radio-inner"></div>
                  </div>
                  <div className="sc-eval-content">
                    <h4>Visit Store</h4>
                    <p>
                      Bring your item to our nearest location for immediate
                      evaluation
                    </p>
                    <ul>
                      <li>Instant evaluation</li>
                      <li>Same-day payment</li>
                      <li>Expert consultation</li>
                    </ul>
                  </div>
                </div>

                <div
                  className={`sc-eval-card ${formData.evaluationMethod === "shipping" ? "selected" : ""}`}
                  onClick={() => setEvaluationMethod("shipping")}
                >
                  <div className="sc-eval-radio">
                    <div className="sc-radio-inner"></div>
                  </div>
                  <div className="sc-eval-content">
                    <h4>
                      Shipping <span className="sc-badge-popular">Popular</span>
                    </h4>
                    <p>We'll send you a shipping label to send your item</p>
                    <ul>
                      <li>Shipping kit</li>
                      <li>Insured shipping</li>
                      <li>2-3 day evaluation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 6 - Shipping Address */}
            {formData.evaluationMethod === "shipping" && (
              <div className="sc-shipping-address-box sc-col-span-2">
                <h4 className="sc-shipping-title">Shipping Address</h4>
                <div className="sc-form-grid sc-shipping-grid">
                  <div className="sc-input-group">
                    <label>Street Address *</label>
                    <input
                      type="text"
                      name="streetAddress"
                      placeholder="Ex: 65 Đường Lê Lợi"
                      value={formData.streetAddress}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="sc-input-group">
                    <label>Apt/Suite</label>
                    <input
                      type="text"
                      name="aptSuite"
                      placeholder="Ex: Tầng 2, Tòa nhà Saigon Centre"
                      value={formData.aptSuite}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* DROP DOWN TỈNH/THÀNH PHỐ */}
                  <div className="sc-input-group">
                    <label>City / Province *</label>
                    <LocationDropdown
                      value={selectedLocationCodes.province}
                      options={locations.provinces.map((prov) => ({
                        label: prov.name_with_type,
                        value: prov.code,
                      }))}
                      onChange={handleProvinceChange}
                      placeholder="-- Select Province/City --"
                    />
                  </div>

                  {/* DROP DOWN QUẬN/HUYỆN */}
                  <div className="sc-input-group">
                    <label>District *</label>
                    <LocationDropdown
                      value={selectedLocationCodes.district}
                      options={locations.districts.map((dist) => ({
                        label: dist.name_with_type,
                        value: dist.code,
                      }))}
                      onChange={handleDistrictChange}
                      placeholder="-- Select District --"
                      disabled={!selectedLocationCodes.province}
                    />
                  </div>

                  {/* DROP DOWN PHƯỜNG/XÃ */}
                  <div className="sc-input-group">
                    <label>Ward *</label>
                    <LocationDropdown
                      value={selectedLocationCodes.ward}
                      options={locations.wards.map((ward) => ({
                        label: ward.name_with_type,
                        value: ward.code,
                      }))}
                      onChange={handleWardChange}
                      placeholder="-- Select Ward --"
                      disabled={!selectedLocationCodes.district}
                    />
                  </div>

                  {/* ZIP Code */}
                  <div className="sc-input-group">
                    <label>ZIP Code</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      placeholder="Ex: 700000"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Row 7 - Terms and Checkbox */}
            <div className="sc-terms-group sc-col-span-2">
              <input
                type="checkbox"
                name="agreeTerms"
                id="agreeTerms"
                checked={formData.agreeTerms}
                onChange={handleInputChange}
              />
              <label htmlFor="agreeTerms">
                I agree to the <a href="#!">Terms & Conditions</a> and{" "}
                <a href="#!">Privacy Policy</a>
              </label>
            </div>
          </div>

          <button
            className="sc-submit-btn"
            type="submit"
            disabled={isSubmitting}
            style={{
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit Buy-Back Request"}
            {!isSubmitting && <ArrowRightIcon />}
          </button>
        </form>
      </div>
    </section>
  );
}
