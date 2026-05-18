// imports
import { useTradeInForm } from "../../hooks/secondCharm/useTradeInForm";
import {
  ChevronDownSolidIcon,
  UploadDropzoneIcon,
  ArrowRightIcon,
} from "../../assets/icons/SecondCharmIcons";
import "./TradeInForm.css";

// component
export default function TradeInForm() {
  const { formData, handleInputChange, setEvaluationMethod } = useTradeInForm();

  // render
  return (
    <section className="sc-form-section">
      <div className="sc-form-container">
        <div className="sc-form-header">
          <h2 className="sc-form-title">Start Your Buy-Back Request</h2>
          <p className="sc-form-subtitle">
            Fill in the details below and upload photos of your item
          </p>
        </div>

        <form className="sc-trade-in-form" onSubmit={(e) => e.preventDefault()}>
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
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
            <div className="sc-input-group">
              <label>Product Category *</label>
              <div className="sc-select-wrapper">
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                >
                  <option value="" disabled>
                    Select category
                  </option>
                  <option value="equipment">Equipment</option>
                  <option value="apparel">Apparel</option>
                  <option value="footwear">Footwear</option>
                </select>
                <ChevronDownSolidIcon className="sc-select-icon" />
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
              <div className="sc-upload-dropzone">
                <div className="sc-upload-icon-large">
                  {/* Sử dụng component Icon ở đây */}
                  <UploadDropzoneIcon />
                </div>
                <p className="sc-upload-text">
                  Click to upload or drag and drop
                </p>
                <p className="sc-upload-hint">
                  PNG, JPG up to 10MB (3-6 photos recommended)
                </p>
              </div>
              <div className="sc-upload-placeholders">
                <div className="sc-upload-box">
                  <span className="plus">+</span>
                </div>
                <div className="sc-upload-box">
                  <span className="plus">+</span>
                </div>
                <div className="sc-upload-box">
                  <span className="plus">+</span>
                </div>
              </div>
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

            {/* Row 6 - Shipping Address (Conditional) */}
            {formData.evaluationMethod === "shipping" && (
              <div className="sc-shipping-address-box sc-col-span-2">
                <h4 className="sc-shipping-title">Shipping Address</h4>
                <div className="sc-form-grid sc-shipping-grid">
                  <div className="sc-input-group">
                    <label>Street Address</label>
                    <input
                      type="text"
                      name="streetAddress"
                      placeholder="123 Main Street"
                      value={formData.streetAddress}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="sc-input-group">
                    <label>Apt/Suite</label>
                    <input
                      type="text"
                      name="aptSuite"
                      placeholder="Apt 4B"
                      value={formData.aptSuite}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="sc-input-group">
                    <label>City</label>
                    <input
                      type="text"
                      name="city"
                      placeholder="New York"
                      value={formData.city}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="sc-input-group">
                    <label>State</label>
                    <input
                      type="text"
                      name="state"
                      placeholder="NY"
                      value={formData.state}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="sc-input-group">
                    <label>ZIP Code</label>
                    <input
                      type="text"
                      name="zipCode"
                      placeholder="10001"
                      value={formData.zipCode}
                      onChange={handleInputChange}
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

          <button className="sc-submit-btn" type="submit">
            Submit Buy-Back Request
            {/* Sử dụng component Icon ở đây */}
            <ArrowRightIcon />
          </button>
        </form>
      </div>
    </section>
  );
}
