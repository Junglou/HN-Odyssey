import { useState } from "react";
import { toast } from "react-toastify";
import type { UserProfile } from "../../types/user";
import type { UserProfileFormData } from "../../components/profile/ProfileModal/MyProfileModal";
import type { AccountFormData } from "../../components/profile/ProfileModal/AccountInformationModal";
import type { AvatarFormData } from "../../components/profile/ProfileModal/AvatarModal";
import { INITIAL_MOCK_USERS } from "./userData";

type ProfileModalType = "profile" | "account" | "avatar";
type ModalMode = "edit" | "view";

interface ModalConfig {
  isOpen: boolean;
  type: ProfileModalType | null;
  mode: ModalMode;
  editingUser: UserProfile | null;
}

export function useProfileManagement() {

  const [user, setUser] = useState<UserProfile>(INITIAL_MOCK_USERS);

  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    type: null,
    mode: "edit",
    editingUser: null,
  });

  // Hàm đóng modal chung cho cả 2 modal (profile + account)
  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // Mở modal theo mode và type (profile/account)
  const openModal = (type: ProfileModalType, mode: ModalMode) => {
    setModalConfig({ isOpen: true, type, mode, editingUser: user });
  };

  // Hàm nhận dữ liệu Modal => update lại
  const submitProfile = (data: UserProfileFormData) => {
    setUser((prev) => ({ ...prev, ...data }));
    toast.success("Cập nhật thông tin profile thành công!");
    closeModal();
  };

  const submitAccount = (data: AccountFormData) => {
    setUser((prev) => ({ ...prev, ...data }));
    toast.success("Cập nhật thông tin account thành công!");
    closeModal();
  };

  const submitAvatar = (data: AvatarFormData) => {
    setUser((prev) => ({ ...prev, avatar: data.avatar }));
    toast.success("Cập nhật avatar thành công!");
    closeModal();
  };

  return {
    user,
    setUser,
    modalConfig,

    profileModal: {
      isOpen: modalConfig.isOpen && modalConfig.type === "profile",
      mode: modalConfig.mode,
      initialData: modalConfig.editingUser,
      onClose: closeModal,
      onSubmit: submitProfile,
    },

    accountModal: {
      isOpen: modalConfig.isOpen && modalConfig.type === "account",
      mode: modalConfig.mode,
      initialData: modalConfig.editingUser,
      onClose: closeModal,
      onSubmit: submitAccount,
    },

    avatarModal: {
      isOpen: modalConfig.isOpen && modalConfig.type === "avatar",
      mode: modalConfig.mode,
      initialData: modalConfig.editingUser,
      onClose: closeModal,
      onSubmit: submitAvatar,
    },

    openProfileEdit: () => openModal("profile", "edit"),
    openAccountEdit: () => openModal("account", "edit"),
    openAvatarEdit: () => openModal("avatar", "edit"),
    closeModal,
    submitProfile,
    submitAccount,
    submitAvatar,
  };
}

export const useUserManagement = useProfileManagement;
