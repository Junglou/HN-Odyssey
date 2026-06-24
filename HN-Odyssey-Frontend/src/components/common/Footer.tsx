import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import "./Footer.css";

// Đảm bảo đường dẫn import logo chính xác với cấu trúc thư mục của H&N Odyssey
import logoImage from "../../assets/images/Logo2.png";

import {
  FacebookIcon,
  YoutubeIcon,
  XIcon,
  InstagramIcon,
  TiktokIcon,
} from "../../assets/icons/FooterIcons";

export default function Footer() {
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubscribe = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
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

  return (
    <footer className="hn-footer-wrapper">
      <div className="footer-top">
        <div className="footer-top-col footer-logo-col">
          <Link to="/">
            <img src={logoImage} alt="H&N Odyssey Logo" />
          </Link>
        </div>

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
              aria-label="Facebook"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-wrapper"
              aria-label="YouTube"
            >
              <YoutubeIcon />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-wrapper"
              aria-label="X (Twitter)"
            >
              <XIcon />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-wrapper"
              aria-label="Instagram"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-wrapper"
              aria-label="TikTok"
            >
              <TiktokIcon />
            </a>
          </div>
        </div>

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

      <div className="footer-divider"></div>

      <div className="footer-bottom">
        {/* Đồng bộ 4 Category cốt lõi từ Header để giữ layout đối xứng */}
        <div className="footer-nav-col">
          <h4 className="nav-col-title">Shop</h4>
          <Link to="/products?category=men" className="footer-nav-link">
            Men
          </Link>
          <Link to="/products?category=women" className="footer-nav-link">
            Women
          </Link>
          <Link to="/products?category=kid" className="footer-nav-link">
            Kid
          </Link>
          <Link to="/products?category=equipment" className="footer-nav-link">
            Equipment
          </Link>
        </div>

        <div className="footer-nav-col">
          <h4 className="nav-col-title">Support</h4>
          <Link to="/pages/faqs" className="footer-nav-link">
            FAQs
          </Link>
          <Link to="/pages/contact-us" className="footer-nav-link">
            Contact us
          </Link>
          <Link to="/pages/shipping-policy" className="footer-nav-link">
            Shipping Policy
          </Link>
          <Link to="/pages/return-and-warranty" className="footer-nav-link">
            Return & Warranty
          </Link>
        </div>

        <div className="footer-nav-col">
          <h4 className="nav-col-title">About Us</h4>
          <Link to="/pages/about-us" className="footer-nav-link">
            About Us
          </Link>
          <Link to="/pages/our-story" className="footer-nav-link">
            Our Story
          </Link>
          <Link to="/pages/why-choose-us" className="footer-nav-link">
            Why Choose Us
          </Link>
          <Link to="/pages/cookie-policy" className="footer-nav-link">
            Cookie Policy
          </Link>
        </div>

        <div className="footer-nav-col">
          <h4 className="nav-col-title">H&N Odysseys</h4>
          <Link to="/pages/careers" className="footer-nav-link">
            Careers
          </Link>
          <Link to="/pages/company-information" className="footer-nav-link">
            Company Information
          </Link>
          <Link to="/pages/press-media" className="footer-nav-link">
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
