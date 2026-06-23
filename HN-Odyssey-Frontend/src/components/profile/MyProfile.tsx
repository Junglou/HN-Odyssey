import "./MyProfile.css";
import RecommendationList from "../common/RecommendationList";
import type { RecommendProduct } from "../../hooks/profile/useRecommendProduct";
import { useProfileManagement } from "../../hooks/profile/useProfileManagement";
import MyProfileModal from "./ProfileModal/MyProfileModal";
import AccountInformationModal from "./ProfileModal/AccountInformationModal";
import AvatarModal from "./ProfileModal/AvatarModal";
import { useNavigate } from "react-router-dom";
import {
  FacebookIcon,
  InstagramIcon,
  TiktokIcon,
  XIcon,
} from "../../assets/icons/ProfileIcons";
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

const MyProfile = ({ recommendations }: MyProfileProps) => {
  const {
    user,
    profileModal,
    accountModal,
    avatarModal,
    openProfileEdit,
    openAccountEdit,
    openAvatarEdit,
  } = useProfileManagement();

  const navigate = useNavigate();

  const renderNullable = (val: unknown) =>
    val === null || val === undefined || val === ""
      ? "—"
      : (val as React.ReactNode);

  const fullName = getFullName(user);
  const birthday = formatDateOfBirth(user.dateOfBirth);

  return (
    <>
      <div className="my-profile-card">
        <div className="profile-header">
          <h1 className="profile-title">My Profile</h1>
        </div>

        <div className="my-profile-internal-grid">
          <div className="grid-section section-profile-main">
            <div className="profile-main-grid">
              <div className="grid-section section-avatar">
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
                <div className="info-block">
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
                <div className="info-block mt-between-forms">
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
                      <div className="info-value">************</div>
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
                  <a
                    className="text-link"
                    onClick={() =>
                      navigate("/verify-otp", {
                        state: { type: "FORGOT_PASSWORD" },
                      })
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
                  <a
                    className="text-link"
                    onClick={() => navigate("/about-us")}
                  >
                    About us
                  </a>
                  <a
                    className="text-link"
                    onClick={() => navigate("/return-policy")}
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
    </>
  );
};

export default MyProfile;
