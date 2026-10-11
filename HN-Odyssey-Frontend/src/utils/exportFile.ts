import type { AxiosResponse } from "axios";

export type ExportResult =
  | { kind: "downloaded" }
  | { kind: "queued"; message: string };

const readBlobAsJson = async (
  blob: Blob,
): Promise<Record<string, unknown> | null> => {
  try {
    const parsed: unknown = JSON.parse(await blob.text());
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const saveBlobResponse = async (
  response: AxiosResponse<Blob>,
  fileName: string,
): Promise<ExportResult> => {
  const rawType = response.headers["content-type"];
  const contentType = typeof rawType === "string" ? rawType : "";

  // Backend trả 202 + JSON khi dữ liệu lớn (AC4) → KHÔNG lưu thành file
  if (response.status === 202 || contentType.includes("application/json")) {
    const json = await readBlobAsJson(response.data);
    const message =
      typeof json?.message === "string"
        ? json.message
        : "Yêu cầu xuất file đang được xử lý.";
    return { kind: "queued", message };
  }

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  return { kind: "downloaded" };
};

// Khi responseType = "blob", body lỗi cũng là Blob → phải tự parse
export const getExportErrorMessage = async (
  err: unknown,
  fallback: string,
): Promise<string> => {
  if (!err || typeof err !== "object") return fallback;
  const e = err as Record<string, unknown>;
  const status = typeof e.status === "number" ? e.status : undefined;

  if (e.data instanceof Blob) {
    const json = await readBlobAsJson(e.data);
    const msg = json?.message;
    const text =
      typeof msg === "string"
        ? msg
        : Array.isArray(msg)
          ? msg.filter((m): m is string => typeof m === "string").join(", ")
          : "";
    if (text) return status ? `[${status}] ${text}` : text;
  }

  if (status === 403) return "Tài khoản không có quyền xuất báo cáo này (403).";
  return typeof e.message === "string" ? e.message : fallback;
};
