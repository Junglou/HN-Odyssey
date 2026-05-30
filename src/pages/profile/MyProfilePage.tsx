import AccountSidebar from "../../components/profile/AccountSidebar";
import MyProfile from "../../components/profile/MyProfile";
import MyProfileModal from "../../components/profile/ProfileModal/MyProfileModal";
import AccountInformationModal from "../../components/profile/ProfileModal/AccountInformationModal";
import AvatarModal from "../../components/profile/ProfileModal/AvatarModal";
import "./MyProfilePage.css";
import { useProfileManagement } from "../../hooks/profile/useProfileManagement";
import type { Product } from "../../types/product";
import { productList } from "../../hooks/profile/productData";

const MyProfilePage = () => {
  const {
    user,
    profileModal,
    accountModal,
    avatarModal,
    openProfileEdit,
    openAccountEdit,
    openAvatarEdit,
  } = useProfileManagement();

  const getRandomProducts = (count: number = 3): Product[] => {
    const shuffled = [...productList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Data mẫu cho RecommendationList
  const recommendations: Product[] = getRandomProducts();

  const handleChangeAvatar = () => {
    openAvatarEdit();
  };

  return (
    <div className="my-profile-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <MyProfile
          user={user}
          recommendations={recommendations}
          onEditProfile={openProfileEdit}
          onEditAccount={openAccountEdit}
          onChangeAvatar={handleChangeAvatar}
        />

        <MyProfileModal {...profileModal} />
        <AccountInformationModal {...accountModal} />
        <AvatarModal {...avatarModal} />
      </div>
    </div>
  );
};

export default MyProfilePage;
