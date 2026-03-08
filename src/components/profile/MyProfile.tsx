import "./MyProfile.css";
import type { UserProfile, ProductRecommendation } from "../../types/user";
import RecommendationList from "../common/RecommendationList";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import {
  FacebookIcon,
  InstagramIcon,
  TiktokIcon,
  XIcon,
} from "../../assets/icons/ProfileIcons";

interface MyProfileProps {
  user: UserProfile;
  recommendations: ProductRecommendation[];
  onEditProfile: () => void;
  onEditAccount: () => void;
  onChangeAvatar: () => void;
}

const MyProfile = ({
  user,
  recommendations,
  onEditProfile,
  onEditAccount,
  onChangeAvatar,
}: MyProfileProps) => {
  const navigate = useNavigate(); // Hook điều hướng

  return (
    <div className="my-profile-card">
      <div className="profile-header">
        <h1 className="profile-title">My Profile</h1>
      </div>

      <div className="profile-internal-grid">
        {/* CỘT 1, 2 GIỮ NGUYÊN ... */}
        <div className="grid-section section-avatar">
          {/* ... code avatar ... */}
          <div className="avatar-frame">
            <img src={user.avatar} alt="Avatar" className="avatar-img" />
          </div>
          <h2 className="user-fullname">{user.firstName}</h2>

          <div className="avatar-actions">
            <button className="btn-avatar-action" onClick={onChangeAvatar}>
              Change avatar
            </button>
            <button
              className="btn-avatar-action"
              onClick={() => navigate("/portal")}
            >
              Admin Portal
            </button>
          </div>
        </div>

        <div className="grid-section section-forms">
          {/* ... code forms ... */}
          <div className="info-block">
            {/* ... content ... */}
            <h3 className="block-title">Profile information</h3>
            {/* ... render info ... */}
            <div className="info-grid-row">
              <div className="info-item">
                <label>First name</label>
                <div className="info-value">name</div>
              </div>
              <div className="info-item">
                <label>Last name</label>
                <div className="info-value">name</div>
              </div>
            </div>
            {/* ... */}
            <button className="btn-edit-pill" onClick={onEditProfile}>
              Edit user profile
            </button>
          </div>
          <div className="info-block mt-between-forms">
            <h3 className="block-title">Account information</h3>
            {/* ... render info ... */}
            <button className="btn-edit-pill" onClick={onEditAccount}>
              Edit user account
            </button>
          </div>
        </div>

        {/* CỘT 3: SOCIAL - ĐÃ GẮN LINK */}
        <div className="grid-section section-social">
          <div className="social-block align-with-fields">
            <h3 className="mini-title">Linked Account</h3>
            <ul className="social-list">
              <li>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <span className="icon-wrap">
                    <FacebookIcon />
                  </span>{" "}
                  Facebook account
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <span className="icon-wrap">
                    <InstagramIcon />
                  </span>{" "}
                  Instagram account
                </a>
              </li>
              <li>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <span className="icon-wrap">
                    <XIcon />
                  </span>{" "}
                  X account
                </a>
              </li>
              <li>
                <a
                  href="https://tiktok.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <span className="icon-wrap">
                    <TiktokIcon />
                  </span>{" "}
                  Tiktok account
                </a>
              </li>
            </ul>
          </div>

          <div className="links-block align-with-account-fields">
            {/* Gắn link nội bộ */}
            <a
              className="text-link"
              onClick={() =>
                navigate("/verify-otp", { state: { type: "FORGOT_PASSWORD" } })
              }
            >
              Forgot password
            </a>
            <a
              className="text-link"
              onClick={() => navigate("/profile/loyalty")}
            >
              About Loyalty Plan
            </a>
            <a className="text-link" onClick={() => navigate("/about-us")}>
              About us
            </a>
            <a className="text-link" onClick={() => navigate("/return-policy")}>
              Return Policy
            </a>
          </div>
        </div>

        {/* CỘT 4: RECOMMENDATIONS */}
        <div className="grid-section section-recs">
          <RecommendationList products={recommendations} />
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
