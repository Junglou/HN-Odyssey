import axios from "axios";

export const normalizePhone = (value: string) =>
  value.replace(/\s/g, "").trim();

export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Matches backend `RequestChangeContactDto` phone regex */
export const isValidPhone = (value: string) =>
  /^(0(3|5|7|8|9)[0-9]{8})$/.test(normalizePhone(value));

const formatApiMessage = (message: unknown): string | undefined => {
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const parts = message.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    );
    if (parts.length > 0) return parts.join(" ");
  }
  return undefined;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    return (
      formatApiMessage(
        (error.response?.data as { message?: unknown })?.message,
      ) ||
      error.message ||
      fallback
    );
  }
  if (error && typeof error === "object" && "message" in error) {
    const formatted = formatApiMessage((error as { message: unknown }).message);
    if (formatted) return formatted;
    const data = (error as { data?: { message?: unknown } }).data;
    const fromData = formatApiMessage(data?.message);
    if (fromData) return fromData;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export const isIncorrectPasswordMessage = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes("không chính xác") ||
    lower.includes("incorrect") ||
    lower.includes("wrong password") ||
    lower.includes("mật khẩu hiện tại")
  );
};

export type RequestChangeContactResponse = {
  success?: boolean;
  message?: string;
};

export type VerifyChangeContactResponse = {
  success?: boolean;
  message?: string;
};
