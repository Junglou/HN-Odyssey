import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../api/axiosClient";
import { getCurrentUser } from "../../../utils/permission";

// 1. INTERFACE CHO UI

export type AuditStatusFilter = "All" | "Success" | "Failed";

export interface AuditLogFilters {
  actorEmail: string;
  action: string;
  department: string; // "" = tất cả phòng ban (đọc bảng gốc)
  status: AuditStatusFilter;
  fromDate: string; // yyyy-MM-dd
  toDate: string; // yyyy-MM-dd
}

export interface AuditViewOption {
  department: string;
  label: string;
  view: string;
}

export interface AuditLogRecord {
  id: string;
  time: string;
  actorName: string;
  actorEmail: string;
  actorCode: string;
  action: string;
  collection: string;
  department: string;
  isSuccess: boolean;
  errorReason: string;
  ip: string;
  userAgent: string;
  detail: Record<string, unknown> | null;
}

// 2. DỮ LIỆU THÔ TỪ BACKEND

interface RawActor {
  first_Name?: string;
  last_Name?: string;
  email?: string;
  fullName?: string;
}

interface RawAuditLog {
  _id: string;
  createdAt: string;
  action: string;
  collection_name?: string;
  actor_id?: RawActor | string | null;
  actor_email?: string;
  actor_employee_code?: string;
  department?: string;
  is_success?: boolean;
  error_reason?: string;
  ip?: string;
  user_agent?: string;
  detail?: Record<string, unknown>;
}

interface RawAuditResponse {
  data?: RawAuditLog[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    source?: string;
  };
}

// 3. HẰNG SỐ & HELPER

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_ROWS = 5000; // chặn trên để không tải quá nặng khi xuất file
const MAIN_SOURCE = "audit_logs";

export const EMPTY_AUDIT_FILTERS: AuditLogFilters = {
  actorEmail: "",
  action: "",
  department: "",
  status: "All",
  fromDate: "",
  toDate: "",
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  const msg = (error as { message?: unknown })?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (Array.isArray(msg) && msg.length > 0) return String(msg[0]);
  return fallback;
};

// Chuyển bộ lọc UI thành query param đúng tên field của AuditLogsService.findAll()
const buildParams = (filters: AuditLogFilters, page: number, limit: number) => {
  const params: Record<string, string | number> = { page, limit };
  if (filters.actorEmail.trim()) params.actor_email = filters.actorEmail.trim();
  if (filters.action.trim())
    params.action = filters.action.trim().toUpperCase();
  if (filters.department) params.department = filters.department;
  if (filters.status !== "All") {
    params.is_success = filters.status === "Success" ? "true" : "false";
  }
  // Ngày chọn theo giờ Việt Nam: từ 00:00 ngày bắt đầu đến 23:59:59 ngày kết thúc
  if (filters.fromDate) {
    params.from_date = new Date(
      `${filters.fromDate}T00:00:00+07:00`,
    ).toISOString();
  }
  if (filters.toDate) {
    params.to_date = new Date(
      `${filters.toDate}T23:59:59.999+07:00`,
    ).toISOString();
  }
  return params;
};

const mapRecord = (raw: RawAuditLog): AuditLogRecord => {
  const actor =
    raw.actor_id && typeof raw.actor_id === "object" ? raw.actor_id : null;
  const actorName =
    actor?.fullName ||
    [actor?.last_Name, actor?.first_Name].filter(Boolean).join(" ") ||
    "—";

  return {
    id: raw._id,
    time: raw.createdAt,
    actorName,
    actorEmail: raw.actor_email || actor?.email || "System",
    actorCode: raw.actor_employee_code || "",
    action: raw.action,
    collection: raw.collection_name || "—",
    department: raw.department || "—",
    isSuccess: raw.is_success !== false,
    errorReason: raw.error_reason || "",
    ip: raw.ip || "—",
    userAgent: raw.user_agent || "—",
    detail: raw.detail ?? null,
  };
};

// 4. HOOK

export function useAuditLogs(canExport: boolean) {
  const [records, setRecords] = useState<AuditLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [views, setViews] = useState<AuditViewOption[]>([]);
  const [source, setSource] = useState(MAIN_SOURCE);

  // filters: giá trị đang chọn/gõ. appliedFilters: giá trị đã chờ 400ms mới gọi API
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_AUDIT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AuditLogFilters>(EMPTY_AUDIT_FILTERS);

  // Danh sách MongoDB View theo phòng ban
  useEffect(() => {
    let ignore = false;
    axiosClient
      .get("/audit-logs/views")
      .then((res) => {
        const list = (res.data?.data ?? []) as AuditViewOption[];
        if (!ignore) setViews(list);
      })
      .catch(() => {
        // Không tải được thì dropdown chỉ còn "All Departments"
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilters(filters);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [filters]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosClient.get("/audit-logs", {
        params: buildParams(appliedFilters, page, pageSize),
      });
      const body = res.data as RawAuditResponse;
      setRecords((body.data ?? []).map(mapRecord));
      setTotal(body.meta?.total ?? 0);
      setTotalPages(body.meta?.total_pages ?? 0);
      setSource(body.meta?.source ?? MAIN_SOURCE);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải nhật ký hệ thống."));
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const changeFilter = <K extends keyof AuditLogFilters>(
    key: K,
    value: AuditLogFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => setFilters(EMPTY_AUDIT_FILTERS);

  const changePage = (next: number) => {
    if (next < 1 || (totalPages > 0 && next > totalPages)) return;
    setPage(next);
  };

  // đổi số dòng mỗi trang -> quay về trang 1
  const changeLimit = (next: number) => {
    if (next === pageSize) return;
    setPageSize(next);
    setPage(1);
  };

  // Xuất Excel toàn bộ kết quả theo bộ lọc hiện tại; chọn phòng ban thì đọc từ View tương ứng
  const exportExcel = async () => {
    if (!canExport) return;
    setIsExporting(true);
    try {
      const rows: AuditLogRecord[] = [];
      let currentPage = 1;
      let lastPage = 1;
      let exportSource = MAIN_SOURCE;

      do {
        const res = await axiosClient.get("/audit-logs", {
          params: buildParams(appliedFilters, currentPage, EXPORT_PAGE_SIZE),
        });
        const body = res.data as RawAuditResponse;
        rows.push(...(body.data ?? []).map(mapRecord));
        lastPage = body.meta?.total_pages ?? 1;
        exportSource = body.meta?.source ?? MAIN_SOURCE;
        currentPage += 1;
      } while (currentPage <= lastPage && rows.length < EXPORT_MAX_ROWS);

      if (rows.length === 0) {
        toast.info("Không có dữ liệu để xuất.");
        return;
      }

      // Vòng lặp dừng vì chạm giới hạn trong khi vẫn còn trang → dữ liệu bị cắt bớt
      const isTruncated = currentPage <= lastPage;

      const selectedView = views.find(
        (v) => v.department === appliedFilters.department,
      );
      const currentUser = getCurrentUser<{
        full_name?: string;
        email?: string;
        roles?: unknown;
      }>();
      const exportedBy = currentUser?.full_name
        ? `${currentUser.full_name} (${currentUser.email ?? "—"})`
        : (currentUser?.email ?? "Unknown");

      // Chỉ tải thư viện Excel khi bấm xuất, không làm nặng trang lúc mở
      const { exportAuditLogsToExcel } =
        await import("../../../utils/auditLogExcel");
      await exportAuditLogsToExcel({
        rows: rows.slice(0, EXPORT_MAX_ROWS),
        filters: appliedFilters,
        sourceName: exportSource,
        sourceLabel: selectedView
          ? `${selectedView.label} department`
          : "All departments",
        exportedBy,
        truncatedAt: isTruncated ? EXPORT_MAX_ROWS : undefined,
      });

      toast.success(
        isTruncated
          ? `Đã xuất ${EXPORT_MAX_ROWS} dòng (giới hạn tối đa). Hãy thu hẹp bộ lọc nếu cần thêm.`
          : `Đã xuất ${rows.length} dòng nhật ký.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xuất nhật ký hệ thống."));
    } finally {
      setIsExporting(false);
    }
  };

  return {
    records,
    filters,
    views,
    source,
    isLoading,
    isExporting,
    pagination: {
      page,
      totalPages,
      total,
      startIndex: (page - 1) * pageSize,
      pageSize,
    },
    actions: {
      changeFilter,
      clearFilters,
      changePage,
      changeLimit,
      exportExcel,
    },
  };
}
