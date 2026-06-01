import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import axiosClient from "../../api/axiosClient";
import type {
  UserProfile,
  UserGender,
  UserStatus,
  UserReviewAccess,
  UserLoyalty,
  ProfileEmbeddedAddress,
  ProfileWishlistItem,
} from "../../types/user";
import type { UserProfileFormData } from "../../components/profile/ProfileModal/MyProfileModal";
import type {
  ContactOtpType,
  RequestContactOtpParams,
  VerifyContactOtpParams,
} from "../../components/profile/ProfileModal/AccountInformationModal";
import type { AvatarFormData } from "../../components/profile/ProfileModal/AvatarModal";

/** Alias kept for existing imports (e.g. loyalty hook). Same shape as API profile. */
export type ProfileUser = UserProfile;

type ProfileModalType = "profile" | "account" | "avatar";
type ModalMode = "edit" | "view";

interface ModalConfig {
  isOpen: boolean;
  type: ProfileModalType | null;
  mode: ModalMode;
  editingUser: UserProfile | null;
}

type ApiProfilePayload = Partial<UserProfile> & {
  role?: string;
  [key: string]: unknown;
};

const toIsoDate = (value: unknown): string | null => {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
};

const toStringId = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
};

const mapGenderFromApi = (gender?: string): UserGender => {
  const upper = (gender ?? "OTHER").toUpperCase();
  if (upper === "MALE") return "MALE";
  if (upper === "FEMALE") return "FEMALE";
  return "OTHER";
};

const mapFormGenderToApi = (
  gender: UserProfileFormData["gender"] | string,
): UserGender => {
  const upper = String(gender).toUpperCase();
  if (upper === "MALE") return "MALE";
  if (upper === "FEMALE") return "FEMALE";
  return "OTHER";
};

const parseBirthdayToApiDate = (birthday: string): string | null => {
  const trimmed = birthday.trim();
  if (!trimmed) return null;

  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;

  const [dd, mm, yyyy] = parts;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(date.getTime())) return null;

  return `${yyyy.padStart(4, "0")}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string })?.message ||
      error.message ||
      fallback
    );
  }
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return fallback;
};

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const isAllowedAvatarFile = (file: File): boolean => {
  const type = file.type.toLowerCase();
  if (ALLOWED_AVATAR_TYPES.has(type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" || ext === "png";
};

const getFullUploadUrl = (path: string): string => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;

  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "";

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};

const uploadImageToStorage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const uploadRes = await axiosClient.post<{ path?: string }>(
    "/upload/single",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );

  const path = uploadRes.data?.path;
  if (!path) {
    throw new Error("Không thể trích xuất đường dẫn ảnh sau khi tải lên.");
  }

  return path;
};

const buildProfileUpdatePayload = (data: UserProfileFormData) => {
  const payload: {
    first_Name: string;
    last_Name: string;
    gender: UserGender;
    dateOfBirth?: string;
  } = {
    first_Name: data.firstName.trim(),
    last_Name: data.lastName.trim(),
    gender: mapFormGenderToApi(data.gender),
  };

  const apiDate = parseBirthdayToApiDate(data.birthday);
  if (apiDate) {
    payload.dateOfBirth = apiDate;
  }

  return payload;
};

const mapAddressFromApi = (
  item: Partial<ProfileEmbeddedAddress>,
): ProfileEmbeddedAddress => ({
  _id: item._id ? String(item._id) : "",
  name: item.name ?? "",
  phone: item.phone ?? "",
  street: item.street ?? "",
  city_code: item.city_code ?? "",
  district_code: item.district_code ?? "",
  ward_code: item.ward_code ?? "",
  is_default: Boolean(item.is_default),
});

const mapWishlistFromApi = (
  item: Partial<ProfileWishlistItem>,
): ProfileWishlistItem => ({
  product: toStringId(item.product),
  variant_id: item.variant_id ? toStringId(item.variant_id) : null,
});

const createEmptyUserProfile = (): UserProfile => ({
  _id: "",
  avatar: null,
  fullName: "",
  username: "",
  email: "",
  phone: "",
  first_Name: "",
  last_Name: "",
  gender: "OTHER",
  dateOfBirth: null,
  social_auth: {},
  roles: ["CUSTOMER"],
  status: "ACTIVE",
  is_deleted: false,
  token_version: 0,
  login_attempts: 0,
  lock_until: null,
  type: "Customer",
  refresh_token: null,
  assigned_warehouse: null,
  last_login_at: null,
  createdAt: "",
  updatedAt: "",
  loyalty: {
    point: 0,
    tier: "SILVER",
    total_spent: 0,
  },
  addresses: [],
  wishlist: [],
  internal_note: "",
  is_subscribed: false,
  review_access: "ALLOWED",
  status_reason: "",
  search_preferences: {},
  followed_brands: [],
});

const mapProfileFromApi = (raw: ApiProfilePayload): UserProfile => {
  const loyaltyRaw = (raw.loyalty ?? {}) as Partial<UserLoyalty>;
  const roles = Array.isArray(raw.roles)
    ? raw.roles.map((role) => String(role))
    : raw.role
      ? [String(raw.role)]
      : ["CUSTOMER"];

  const firstName = String(raw.first_Name ?? "");
  const lastName = String(raw.last_Name ?? "");
  const email = String(raw.email ?? "");

  return {
    _id: raw._id ? String(raw._id) : "",
    avatar: raw.avatar ? getFullUploadUrl(String(raw.avatar)) : null,
    fullName:
      raw.fullName ??
      (firstName || lastName
        ? `${firstName} ${lastName}`.trim()
        : email
          ? email.split("@")[0]
          : ""),
    username: String(raw.username ?? ""),
    email,
    phone: raw.phone ? String(raw.phone) : undefined,
    first_Name: firstName,
    last_Name: lastName,
    gender: mapGenderFromApi(String(raw.gender ?? "")),
    dateOfBirth: toIsoDate(raw.dateOfBirth),
    social_auth: {
      google_id: raw.social_auth?.google_id,
      facebook_id: raw.social_auth?.facebook_id,
    },
    roles,
    status: (raw.status as UserStatus) ?? "ACTIVE",
    is_deleted: Boolean(raw.is_deleted ?? false),
    token_version: Number(raw.token_version ?? 0),
    login_attempts: Number(raw.login_attempts ?? 0),
    lock_until: toIsoDate(raw.lock_until),
    type: String(raw.type ?? "Customer"),
    refresh_token: raw.refresh_token ?? null,
    assigned_warehouse: raw.assigned_warehouse
      ? toStringId(raw.assigned_warehouse)
      : null,
    last_login_at: toIsoDate(raw.last_login_at),
    createdAt: toIsoDate(raw.createdAt) ?? "",
    updatedAt: toIsoDate(raw.updatedAt) ?? "",
    loyalty: {
      point: Number(loyaltyRaw.point ?? 0),
      tier: String(loyaltyRaw.tier ?? "SILVER"),
      total_spent: Number(loyaltyRaw.total_spent ?? 0),
    },
    addresses: Array.isArray(raw.addresses)
      ? raw.addresses.map((item) =>
          mapAddressFromApi(item as Partial<ProfileEmbeddedAddress>),
        )
      : [],
    wishlist: Array.isArray(raw.wishlist)
      ? raw.wishlist.map((item) =>
          mapWishlistFromApi(item as Partial<ProfileWishlistItem>),
        )
      : [],
    internal_note: String(raw.internal_note ?? ""),
    is_subscribed: Boolean(raw.is_subscribed ?? false),
    review_access: (raw.review_access as UserReviewAccess) ?? "ALLOWED",
    status_reason: String(raw.status_reason ?? ""),
    search_preferences: raw.search_preferences ?? {},
    followed_brands: Array.isArray(raw.followed_brands)
      ? raw.followed_brands.map(String)
      : [],
  };
};

const refreshProfileFromApi = async (): Promise<UserProfile> => {
  const res = await axiosClient.get("/users/customers/profile");
  const payload: ApiProfilePayload = res.data?.data ?? res.data ?? {};
  return mapProfileFromApi(payload);
};

export function useProfileManagement() {
  const [user, setUser] = useState<UserProfile>(createEmptyUserProfile);
  const [isAccountSubmitting, setIsAccountSubmitting] = useState(false);
  const [requestingContactOtpType, setRequestingContactOtpType] =
    useState<ContactOtpType | null>(null);
  const [verifyingContactOtpType, setVerifyingContactOtpType] =
    useState<ContactOtpType | null>(null);

  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    type: null,
    mode: "edit",
    editingUser: null,
  });

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const openModal = (type: ProfileModalType, mode: ModalMode) => {
    setModalConfig({ isOpen: true, type, mode, editingUser: user });
  };

  const submitProfile = async (data: UserProfileFormData) => {
    try {
      const res = await axiosClient.patch(
        "/users/customers/profile",
        buildProfileUpdatePayload(data),
      );
      const payload: ApiProfilePayload = res.data?.data ?? res.data ?? {};
      setUser(mapProfileFromApi(payload));
      toast.success("Cập nhật thông tin profile thành công!");
      closeModal();
    } catch (error: unknown) {
      console.error("Lỗi khi cập nhật profile:", error);
      toast.error(getErrorMessage(error, "Không thể cập nhật profile"));
    }
  };

  const requestContactOtp = async (params: RequestContactOtpParams) => {
    setRequestingContactOtpType(params.type);
    try {
      const res = await axiosClient.post<{ message?: string }>(
        "/users/customers/request-change-contact",
        {
          type: params.type,
          newValue: params.newValue.trim(),
          currentPassword: params.currentPassword,
        },
      );

      toast.success(
        res.data?.message ??
          `Verification code sent to ${params.newValue.trim()}.`,
      );
    } catch (error: unknown) {
      console.error("Failed to request contact OTP:", error);
      toast.error(getErrorMessage(error, "Could not send verification code"));
      throw error;
    } finally {
      setRequestingContactOtpType(null);
    }
  };

  const verifyContactOtp = async (params: VerifyContactOtpParams) => {
    setIsAccountSubmitting(true);
    setVerifyingContactOtpType(params.type);
    try {
      const res = await axiosClient.post<{ message?: string }>(
        "/users/customers/verify-change-contact",
        {
          code: params.code.trim(),
        },
      );

      const updated = await refreshProfileFromApi();
      setUser(updated);
      setModalConfig((prev) => ({ ...prev, editingUser: updated }));
      toast.success(
        res.data?.message ??
          (params.type === "EMAIL"
            ? "Email updated successfully."
            : "Phone number updated successfully."),
      );
    } catch (error: unknown) {
      console.error("Failed to verify contact OTP:", error);
      toast.error(getErrorMessage(error, "Could not verify the OTP code"));
      throw error;
    } finally {
      setIsAccountSubmitting(false);
      setVerifyingContactOtpType(null);
    }
  };

  const submitAvatar = async (data: AvatarFormData) => {
    const { file } = data;

    if (!isAllowedAvatarFile(file)) {
      toast.error("Avatar must be a JPG or PNG image.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error("Avatar must be 5 MB or smaller.");
      return;
    }

    try {
      const relativePath = await uploadImageToStorage(file);
      const avatarUrl = getFullUploadUrl(relativePath);

      try {
        await axiosClient.patch("/users/customers/profile", {
          avatar: relativePath,
        });
      } catch {
        await axiosClient.patch("/users/customers/avatar", {
          avatar: relativePath,
        });
      }

      setUser((prev) => ({ ...prev, avatar: avatarUrl }));
      toast.success("Cập nhật avatar thành công!");
      closeModal();

      try {
        const profileRes = await axiosClient.get("/users/customers/profile");
        const payload: ApiProfilePayload =
          profileRes.data?.data ?? profileRes.data ?? {};
        setUser(mapProfileFromApi(payload));
      } catch {
        // Keep optimistic avatar if profile refresh fails.
      }
    } catch (error: unknown) {
      console.error("Lỗi khi cập nhật avatar:", error);
      toast.error(getErrorMessage(error, "Không thể cập nhật avatar"));
    }
  };

  useEffect(() => {
    let ignore = false;

    const fetchProfile = async () => {
      try {
        const res = await axiosClient.get("/users/customers/profile");
        const payload: ApiProfilePayload = res.data?.data ?? res.data ?? {};
        const mapped = mapProfileFromApi(payload);

        if (!ignore) setUser(mapped);
      } catch (error: unknown) {
        console.error("Lỗi khi tải profile:", error);
        toast.error(getErrorMessage(error, "Không thể tải profile"));
      }
    };

    void fetchProfile();
    return () => {
      ignore = true;
    };
  }, []);

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
      onRequestContactOtp: requestContactOtp,
      onVerifyContactOtp: verifyContactOtp,
      isSubmitting: isAccountSubmitting,
      requestingOtpType: requestingContactOtpType,
      verifyingOtpType: verifyingContactOtpType,
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
    requestContactOtp,
    verifyContactOtp,
    submitAvatar,
  };
}

export const useUserManagement = useProfileManagement;
