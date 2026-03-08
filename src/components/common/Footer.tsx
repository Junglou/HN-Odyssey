import { Link } from "react-router-dom";
import "./Footer.css";

// 1. Nhớ đổi tên file "logo.png" thành tên file logo thực tế của bạn
import logoImage from "../../assets/images/logo2.png";

// 2. Import các Icon từ file vừa tạo
import {
  FacebookIcon,
  YoutubeIcon,
  XIcon,
  InstagramIcon,
  TiktokIcon,
} from "../../assets/icons/FooterIcons";

const Footer = () => {
  return (
    <footer className="hn-footer-wrapper">
      {/* --- TOP SECTION --- */}
      <div className="footer-top">
        {/* 1. Logo */}
        <div className="footer-top-col footer-logo-col">
          <Link to="/">
            {/* Đã gỡ bỏ style filter invert, giờ code sẽ render đúng logo gốc của bạn */}
            <img src={logoImage} alt="H&N Odyssey" />
          </Link>
        </div>

        {/* 2. Contact Info */}
        <div className="footer-top-col footer-contact-col">
          <p className="contact-text">Hotline: (+84) 028 4532 6499</p>
          <p className="contact-text">Email: support@hnnodyssey.com</p>
          <p className="contact-text">Address: 123 Abc, Ho Chi Minh City</p>
          <div className="social-icons-row">
            <div className="social-icon-wrapper">
              <FacebookIcon />
            </div>
            <div className="social-icon-wrapper">
              <YoutubeIcon />
            </div>
            <div className="social-icon-wrapper">
              <XIcon />
            </div>
            <div className="social-icon-wrapper">
              <InstagramIcon />
            </div>
            <div className="social-icon-wrapper">
              <TiktokIcon />
            </div>
          </div>
        </div>

        {/* 3. Newsletter */}
        <div className="footer-top-col footer-newsletter-col">
          <h3 className="newsletter-title">Newsletter Signup</h3>
          <p className="newsletter-desc">
            Get the latest updates straight to your inbox
          </p>
          <form
            className="newsletter-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="newsletter-input-wrapper">
              <input
                type="email"
                placeholder="Email"
                className="newsletter-input"
              />
              <span className="input-asterisk">*</span>
            </div>
            <button type="submit" className="newsletter-send-btn">
              Send
            </button>
          </form>
        </div>
      </div>

      {/* --- HORIZONTAL DIVIDER --- */}
      <div className="footer-divider"></div>

      {/* --- BOTTOM SECTION --- */}
      <div className="footer-bottom">
        {/* Col 1 */}
        <div className="footer-nav-col">
          <h4 className="nav-col-title">Categories</h4>
          <Link to="/featured" className="footer-nav-link">
            Featured
          </Link>
          <Link to="/men" className="footer-nav-link">
            Men
          </Link>
          <Link to="/women" className="footer-nav-link">
            Women
          </Link>
          <Link to="/kid" className="footer-nav-link">
            Kid
          </Link>
          <Link to="/equipment" className="footer-nav-link">
            Equipment
          </Link>
          <Link to="/emergency" className="footer-nav-link">
            Emergency Packs
          </Link>
        </div>

        {/* Col 2 */}
        <div className="footer-nav-col">
          <h4 className="nav-col-title">Support</h4>
          <Link to="/faqs" className="footer-nav-link">
            FAQS
          </Link>
          <Link to="/contact" className="footer-nav-link">
            Contact us
          </Link>
          <Link to="/shipping-policy" className="footer-nav-link">
            Shipping Policy
          </Link>
          <Link to="/return-warranty" className="footer-nav-link">
            Return & Warranty
          </Link>
        </div>

        {/* Col 3 */}
        <div className="footer-nav-col">
          <h4 className="nav-col-title">About Us</h4>
          <Link to="/about" className="footer-nav-link">
            About Us
          </Link>
          <Link to="/story" className="footer-nav-link">
            Our Story
          </Link>
          <Link to="/why-choose-us" className="footer-nav-link">
            Why Choose Us
          </Link>
          <Link to="/cookie-policy" className="footer-nav-link">
            Cookie Policy
          </Link>
        </div>

        {/* Col 4 */}
        <div className="footer-nav-col">
          <h4 className="nav-col-title">H&N Odysseys</h4>
          <Link to="/careers" className="footer-nav-link">
            Careers
          </Link>
          <Link to="/company-info" className="footer-nav-link">
            Company Information
          </Link>
          <Link to="/press" className="footer-nav-link">
            Press / Media
          </Link>
          <Link to="/partners" className="footer-nav-link">
            Partners
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
