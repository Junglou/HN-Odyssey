import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import type { UserProfile } from "../../types/user";
import {
  getErrorMessage,
  isIncorrectPasswordMessage,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  type RequestChangeContactResponse,
  type VerifyChangeContactResponse,
} from "./accountContactUtils";

export type ContactOtpType = "EMAIL" | "PHONE";

export interface UseAccountInformationModalOptions {
  isOpen: boolean;
  initialData: UserProfile | null;
  onProfileUpdated?: (profile: UserProfile) => void;
  refreshProfile?: () => Promise<UserProfile>;
}

const getResponseMessage = (
  res: { data?: RequestChangeContactResponse | VerifyChangeContactResponse },
  fallback: string,
): string => res.data?.message?.trim() || fallback;

export function useAccountInformationModal({
  isOpen,
  initialData,
  onProfileUpdated,
  refreshProfile,
}: UseAccountInformationModalOptions) {
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const newEmailRef = useRef<HTMLInputElement | null>(null);
  const newPhoneRef = useRef<HTMLInputElement | null>(null);
  const emailOtpRef = useRef<HTMLInputElement | null>(null);
  const phoneOtpRef = useRef<HTMLInputElement | null>(null);

  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestingOtpType, setRequestingOtpType] =
    useState<ContactOtpType | null>(null);
  const [verifyingOtpType, setVerifyingOtpType] =
    useState<ContactOtpType | null>(null);

  const currentEmail = (initialData?.email ?? "").trim();
  const currentPhone = normalizePhone(initialData?.phone ?? "");

  useEffect(() => {
    if (!isOpen) {
      setEmailOtpSent(false);
      setPhoneOtpSent(false);
      return;
    }

    if (passwordRef.current) passwordRef.current.value = "";
    if (newEmailRef.current) newEmailRef.current.value = "";
    if (newPhoneRef.current) newPhoneRef.current.value = "";
    if (emailOtpRef.current) emailOtpRef.current.value = "";
    if (phoneOtpRef.current) phoneOtpRef.current.value = "";

    setEmailOtpSent(false);
    setPhoneOtpSent(false);
  }, [isOpen]);

  const getCurrentPassword = (): string =>
    (passwordRef.current?.value ?? "").trim();

  const requestContactOtp = async (
    type: ContactOtpType,
    newValue: string,
    currentPassword: string,
  ) => {
    setRequestingOtpType(type);
    try {
      const res = await axiosClient.post<RequestChangeContactResponse>(
        "/users/customers/request-change-contact",
        {
          type,
          newValue,
          currentPassword,
        },
      );

      toast.success(
        getResponseMessage(
          res,
          `Verification code sent to ${newValue}. Valid for 5 minutes.`,
        ),
      );
    } catch (error: unknown) {
      console.error("Failed to request contact OTP:", error);
      const message = getErrorMessage(
        error,
        "Could not send verification code",
      );
      toast.error(message);
      throw error;
    } finally {
      setRequestingOtpType(null);
    }
  };

  const verifyContactOtp = async (type: ContactOtpType, code: string) => {
    setIsSubmitting(true);
    setVerifyingOtpType(type);
    try {
      const res = await axiosClient.post<VerifyChangeContactResponse>(
        "/users/customers/verify-change-contact",
        { code },
      );

      if (refreshProfile) {
        const updated = await refreshProfile();
        onProfileUpdated?.(updated);
      }

      toast.success(
        getResponseMessage(
          res,
          type === "EMAIL"
            ? "Email updated successfully."
            : "Phone number updated successfully.",
        ),
      );
    } catch (error: unknown) {
      console.error("Failed to verify contact OTP:", error);
      toast.error(getErrorMessage(error, "Could not verify the OTP code"));
      throw error;
    } finally {
      setIsSubmitting(false);
      setVerifyingOtpType(null);
    }
  };

  const handleSendOtp = async (type: ContactOtpType) => {
    const currentPassword = getCurrentPassword();
    if (!currentPassword) {
      toast.warning("Enter your current password before sending an OTP.");
      return;
    }

    const newValue =
      type === "EMAIL"
        ? (newEmailRef.current?.value ?? "").trim()
        : normalizePhone(newPhoneRef.current?.value ?? "");

    if (!newValue) {
      toast.warning(
        type === "EMAIL" ? "Enter a new email." : "Enter a new phone number.",
      );
      return;
    }

    if (type === "EMAIL" && !isValidEmail(newValue)) {
      toast.warning("Enter a valid email address.");
      return;
    }

    if (type === "PHONE" && !isValidPhone(newValue)) {
      toast.warning(
        "Enter a valid VN phone number (10 digits, starting with 03/05/07/08/09).",
      );
      return;
    }

    if (type === "EMAIL" && newValue === currentEmail) {
      toast.warning("New email must be different from your current email.");
      return;
    }

    if (type === "PHONE" && newValue === currentPhone) {
      toast.warning(
        "New phone must be different from your current phone number.",
      );
      return;
    }

    try {
      await requestContactOtp(type, newValue, currentPassword);
      if (type === "EMAIL") {
        setEmailOtpSent(true);
        setPhoneOtpSent(false);
      } else {
        setPhoneOtpSent(true);
        setEmailOtpSent(false);
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, "");
      if (isIncorrectPasswordMessage(message)) {
        if (passwordRef.current) passwordRef.current.value = "";
        passwordRef.current?.focus();
      }
    }
  };

  const handleVerifyOtp = async (type: ContactOtpType) => {
    if (type === "EMAIL" && !emailOtpSent) {
      toast.warning("Send an OTP to your new email first.");
      return;
    }

    if (type === "PHONE" && !phoneOtpSent) {
      toast.warning("Send an OTP to your new phone first.");
      return;
    }

    const otpRef = type === "EMAIL" ? emailOtpRef : phoneOtpRef;
    const code = (otpRef.current?.value ?? "").trim();

    if (!code || code.length < 6) {
      toast.warning("Enter the 6-digit OTP sent to your new contact.");
      return;
    }

    try {
      await verifyContactOtp(type, code);
      if (type === "EMAIL") {
        setEmailOtpSent(false);
        if (newEmailRef.current) newEmailRef.current.value = "";
      } else {
        setPhoneOtpSent(false);
        if (newPhoneRef.current) newPhoneRef.current.value = "";
      }
      if (otpRef.current) otpRef.current.value = "";
    } catch {
      // Toasts handled in verifyContactOtp.
    }
  };

  return {
    currentEmail,
    currentPhone,
    passwordRef,
    newEmailRef,
    newPhoneRef,
    emailOtpRef,
    phoneOtpRef,
    emailOtpSent,
    phoneOtpSent,
    isSubmitting,
    requestingOtpType,
    verifyingOtpType,
    handleSendOtp,
    handleVerifyOtp,
  };
}
