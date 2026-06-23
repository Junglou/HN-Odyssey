// imports
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import "./Footer.css";

// nhớ đổi tên file logo.png thành tên file logo thực tế của bạn
import logoImage from "../../assets/images/logo2.png";

// import các icon
import {
  FacebookIcon,
  YoutubeIcon,
  XIcon,
  InstagramIcon,
  TiktokIcon,
} from "../../assets/icons/FooterIcons";

// component
export default function Footer() {
  // hooks/states
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // handlers
  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.warning("Vui lòng nhập địa chỉ email của bạn.");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Cảm ơn bạn đã đăng ký nhận tin!");
      setEmail("");
    }, 1000);
  };

  // render
  return (
    <footer className="hn-footer-wrapper">
      {/* top section */}
      <div className="footer-top">
        {/* logo */}
        <div className="footer-top-col footer-logo-col">
          <Link to="/">
            <img src={logoImage} alt="H&N Odyssey" />
          </Link>
        </div>

        {/* contact */}
        <div className="footer-top-col footer-contact-col">
          <p className="contact-text">Hotline: (+84) 028 4532 6499</p>
          <p className="contact-text">Email: support@hnnodyssey.com</p>
          <p className="contact-text">Address: 123 Abc, Ho Chi Minh City</p>

          <div className="social-icons-row">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-wrapper"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-wrapper"
            >
              <YoutubeIcon />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-wrapper"
            >
              <XIcon />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-wrapper"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-wrapper"
            >
              <TiktokIcon />
            </a>
          </div>
        </div>

        {/* newsletter */}
        <div className="footer-top-col footer-newsletter-col">
          <h4 className="newsletter-title">Join our newsletter</h4>
          <p className="newsletter-desc">
            We'll send you a nice letter once per week. No spam.
          </p>
          <form className="newsletter-form" onSubmit={handleSubscribe}>
            <div className="newsletter-input-wrapper">
              <input
                type="email"
                placeholder="Enter your email"
                className="newsletter-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <span className="input-asterisk">*</span>
            </div>
            <button
              type="submit"
              className="newsletter-send-btn"
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>

      {/* horizontal divider */}
      <div className="footer-divider"></div>

      {/* bottom section */}
      <div className="footer-bottom">
        {/* shop links */}
        <div className="footer-nav-col">
          <h4 className="nav-col-title">Shop</h4>
          <Link to="/products/tools" className="footer-nav-link">
            Tools
          </Link>
          <Link to="/products/equipment" className="footer-nav-link">
            Equipment
          </Link>
          <Link to="/products/clothing" className="footer-nav-link">
            Clothing
          </Link>
          <Link to="/products/accessories" className="footer-nav-link">
            Accessories
          </Link>
        </div>

        {/* support links */}
        <div className="footer-nav-col">
          <h4 className="nav-col-title">Support</h4>
          <Link to="/pages/faqs" className="footer-nav-link">
            FAQs
          </Link>
          <Link to="/pages/contact" className="footer-nav-link">
            Contact us
          </Link>
          <Link to="/pages/shipping-policy" className="footer-nav-link">
            Shipping Policy
          </Link>
          <Link to="/pages/return-warranty" className="footer-nav-link">
            Return & Warranty
          </Link>
        </div>

        {/* about links */}
        <div className="footer-nav-col">
          <h4 className="nav-col-title">About Us</h4>
          <Link to="/pages/about" className="footer-nav-link">
            About Us
          </Link>
          <Link to="/pages/story" className="footer-nav-link">
            Our Story
          </Link>
          <Link to="/pages/why-choose-us" className="footer-nav-link">
            Why Choose Us
          </Link>
          <Link to="/pages/cookie-policy" className="footer-nav-link">
            Cookie Policy
          </Link>
        </div>

        {/* company links */}
        <div className="footer-nav-col">
          <h4 className="nav-col-title">H&N Odysseys</h4>
          <Link to="/pages/careers" className="footer-nav-link">
            Careers
          </Link>
          <Link to="/pages/company-info" className="footer-nav-link">
            Company Information
          </Link>
          <Link to="/pages/press" className="footer-nav-link">
            Press / Media
          </Link>
          <Link to="/pages/partners" className="footer-nav-link">
            Partners
          </Link>
        </div>
      </div>
    </footer>
  );
}
