import { useState } from "react";
import "./MyProfile.css";
import RecommendationList from "../common/RecommendationList";
import type { RecommendProduct } from "../../hooks/profile/useRecommendProduct";
import { useProfileManagement } from "../../hooks/profile/useProfileManagement";
import MyProfileModal from "./ProfileModal/MyProfileModal";
import AccountInformationModal from "./ProfileModal/AccountInformationModal";
import AvatarModal from "./ProfileModal/AvatarModal";
import ChangePasswordModal from "./ProfileModal/ChangePasswordModal";
import { useNavigate } from "react-router-dom";
import { FacebookIcon } from "../../assets/icons/ProfileIcons";
import type { UserProfile } from "../../types/user";

interface MyProfileProps {
  recommendations: RecommendProduct[];
}

const formatGenderLabel = (gender: UserProfile["gender"]) => {
  switch (gender) {
    case "MALE":
      return "Male";
    case "FEMALE":
      return "Female";
    default:
      return "Other";
  }
};

const formatDateOfBirth = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return "";
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const getFullName = (user: UserProfile) =>
  user.fullName?.trim() ||
  `${user.first_Name} ${user.last_Name}`.trim() ||
  user.email.split("@")[0] ||
  "";

// Logo Google nhiều màu, không khung (GoogleIcon có sẵn là icon cho nút đăng nhập nên có khung tròn riêng)
const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
    />
  </svg>
);

const MyProfile = ({ recommendations }: MyProfileProps) => {
  const {
    user,
    profileModal,
    accountModal,
    avatarModal,
    openProfileEdit,
    openAccountEdit,
    openAvatarEdit,
    setUser,
  } = useProfileManagement();

  const navigate = useNavigate();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const renderNullable = (val: unknown) =>
    val === null || val === undefined || val === ""
      ? "—"
      : (val as React.ReactNode);

  const fullName = getFullName(user);
  const birthday = formatDateOfBirth(user.dateOfBirth);

  // Trạng thái liên kết thật lấy từ social_auth (hệ thống chỉ hỗ trợ Google và Facebook)
  const linkedProviders = [
    {
      key: "google",
      label: "Google",
      Icon: GoogleLogo,
      linked: !!user.social_auth?.google_id,
    },
    {
      key: "facebook",
      label: "Facebook",
      Icon: FacebookIcon,
      linked: !!user.social_auth?.facebook_id,
    },
  ];
  const hasUnlinkedProvider = linkedProviders.some((p) => !p.linked);

  return (
    <>
      <div className="my-profile-card">
        <div className="profile-header">
          <h1 className="profile-title">My Profile</h1>
        </div>

        <div className="my-profile-internal-grid">
          <div className="grid-section section-profile-main">
            <div className="profile-main-grid">
              <div
                className="grid-section section-avatar"
                data-chat-guide="avatar"
              >
                <div className="avatar-frame">
                  {!user.avatar ? (
                    <div className="avatar-null">—</div>
                  ) : (
                    <img
                      src={user.avatar}
                      alt="Avatar"
                      className="avatar-img"
                    />
                  )}
                </div>
                <h2 className="user-fullname">{renderNullable(fullName)}</h2>
                <div className="avatar-actions">
                  <button
                    className="btn-avatar-action"
                    onClick={openAvatarEdit}
                  >
                    Change avatar
                  </button>
                  {!user.roles?.some(
                    (r) => String(r).toLowerCase() === "customer",
                  ) && (
                    <button
                      className="btn-avatar-action"
                      onClick={() => navigate("/portal")}
                    >
                      Admin Portal
                    </button>
                  )}
                </div>
              </div>

              <div className="grid-section section-forms">
                <div className="info-block" data-chat-guide="profile-info">
                  <h3 className="block-title">Profile information</h3>
                  <div className="info-grid-row">
                    <div className="info-item">
                      <label>First name</label>
                      <div className="info-value">
                        {renderNullable(user.first_Name)}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Last name</label>
                      <div className="info-value">
                        {renderNullable(user.last_Name)}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Gender</label>
                      <div className="info-value">
                        {formatGenderLabel(user.gender)}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Birthday</label>
                      <div className="info-value">
                        {renderNullable(birthday)}
                      </div>
                    </div>
                  </div>
                  <button className="btn-edit-pill" onClick={openProfileEdit}>
                    Edit user profile
                  </button>
                </div>
                <div
                  className="info-block mt-between-forms"
                  data-chat-guide="account-info"
                >
                  <h3 className="block-title">Account information</h3>
                  <div className="info-grid-row">
                    <div className="info-item">
                      <label>Username</label>
                      <div className="info-value">
                        {renderNullable(user.username)}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Password</label>
                      <div className="info-value">
                        {user.has_password === false
                          ? "Not set"
                          : "************"}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Email</label>
                      <div className="info-value">
                        {renderNullable(user.email)}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Phone</label>
                      <div className="info-value">
                        {renderNullable(user.phone)}
                      </div>
                    </div>
                  </div>
                  <button className="btn-edit-pill" onClick={openAccountEdit}>
                    Edit user account
                  </button>
                </div>
              </div>

              <div className="grid-section section-social">
                <div
                  className="profile-linked-block align-with-fields"
                  data-chat-guide="linked-accounts"
                >
                  <h3 className="mini-title">Linked Account</h3>
                  <ul className="profile-linked-list">
                    {linkedProviders.map(({ key, label, Icon, linked }) => (
                      <li key={key}>
                        <span className="icon-wrap">
                          <Icon />
                        </span>
                        <span className="linked-text">
                          <span className="linked-name">{label}</span>
                          <span
                            className={`linked-status ${linked ? "is-linked" : ""}`}
                          >
                            {linked ? "Connected" : "Not connected"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {hasUnlinkedProvider && (
                    <p className="linked-hint">
                      Sign in with Google or Facebook using this email to
                      connect it automatically.
                    </p>
                  )}
                </div>

                <div className="links-block align-with-account-fields">
                  <a
                    className="text-link"
                    onClick={() => setIsChangePasswordOpen(true)}
                    data-chat-guide="change-password"
                  >
                    {user.has_password === false
                      ? "Set password"
                      : "Change password"}
                  </a>
                  <a
                    className="text-link"
                    onClick={() => navigate("/profile/loyalty")}
                  >
                    About Loyalty Plan
                  </a>
                  <a
                    className="text-link"
                    onClick={() => navigate("/pages/about-us")}
                  >
                    About us
                  </a>
                  <a
                    className="text-link"
                    onClick={() => navigate("/pages/return-policy")}
                  >
                    Return Policy
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="grid-section section-recs">
            <RecommendationList products={recommendations} />
          </div>
        </div>
      </div>

      <MyProfileModal {...profileModal} />
      <AccountInformationModal {...accountModal} />
      <AvatarModal {...avatarModal} />
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        hasPassword={user.has_password !== false}
        onPasswordSet={() =>
          setUser((prev) => ({ ...prev, has_password: true }))
        }
      />
    </>
  );
};

export default MyProfile;
