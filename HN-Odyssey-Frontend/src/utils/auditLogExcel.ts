import ExcelJS from "exceljs";
import type {
  AuditLogFilters,
  AuditLogRecord,
} from "../hooks/portal/System/useAuditLogs";

export interface AuditExcelOptions {
  rows: AuditLogRecord[];
  filters: AuditLogFilters;
  sourceName: string; // tên collection / MongoDB View đã đọc
  sourceLabel: string; // VD: "Sales department"
  exportedBy: string;
  truncatedAt?: number; // có giá trị khi dữ liệu bị cắt ở giới hạn tối đa
}

// MÀU & FONT (đồng bộ màu Portal)
const COLOR = {
  dark: "FF111827",
  muted: "FF6B7280",
  white: "FFFFFFFF",
  border: "FFE5E7EB",
  headerFill: "FFF5E1CD",
  headerBorder: "FFEAC6A8",
  labelFill: "FFF3F4F6",
  zebra: "FFFAFAFA",
  successFill: "FFDCFCE7",
  successText: "FF15803D",
  failedFill: "FFFEE2E2",
  failedText: "FFB91C1C",
};
const FONT_NAME = "Arial";
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_CELL_LENGTH = 32000; // Excel giới hạn 32.767 ký tự / ô

interface ColumnDef {
  header: string;
  width: number;
  align?: "left" | "center";
  wrap?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { header: "No.", width: 6, align: "center" },
  { header: "Time (GMT+7)", width: 20, align: "center" },
  { header: "Actor Email", width: 30 },
  { header: "Employee Code", width: 15, align: "center" },
  { header: "Actor Name", width: 22, wrap: true },
  { header: "Department", width: 14, align: "center" },
  { header: "Action", width: 26 },
  { header: "Collection", width: 18 },
  { header: "Status", width: 11, align: "center" },
  { header: "Error Reason", width: 30, wrap: true },
  { header: "IP Address", width: 16, align: "center" },
  { header: "User Agent", width: 40, wrap: true },
  { header: "Detail", width: 60, wrap: true },
];

// HELPER

const solidFill = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

const thinBorder = (argb: string = COLOR.border): Partial<ExcelJS.Borders> => ({
  top: { style: "thin", color: { argb } },
  left: { style: "thin", color: { argb } },
  bottom: { style: "thin", color: { argb } },
  right: { style: "thin", color: { argb } },
});

const styleRange = (
  sheet: ExcelJS.Worksheet,
  row: number,
  fromCol: number,
  toCol: number,
  apply: (cell: ExcelJS.Cell) => void,
) => {
  for (let col = fromCol; col <= toCol; col++) apply(sheet.getCell(row, col));
};

const formatVnDateTime = (date: Date) =>
  date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// "2026-10-22" -> "22/10/2026"
const formatInputDate = (value: string) => {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
};

// ExcelJS ghi Date theo giờ UTC → cộng 7 giờ để ô Excel hiển thị đúng giờ Việt Nam
const toExcelVnDate = (iso: string) =>
  new Date(new Date(iso).getTime() + VN_OFFSET_MS);

const truncate = (text: string) =>
  text.length > MAX_CELL_LENGTH
    ? `${text.slice(0, MAX_CELL_LENGTH)}… (truncated)`
    : text;

const countBy = (
  rows: AuditLogRecord[],
  getKey: (row: AuditLogRecord) => string,
): [string, number][] => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = getKey(row) || "—";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
};

// SHEET 1: BÁO CÁO CHI TIẾT

function buildReportSheet(workbook: ExcelJS.Workbook, opts: AuditExcelOptions) {
  const { rows, filters } = opts;
  const lastCol = COLUMNS.length;

  const sheet = workbook.addWorksheet("Audit Logs", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    // "&&" để in ra ký tự "&" (vì "&N" là mã tổng số trang)
    headerFooter: {
      oddFooter: "&L&8H&&N Odyssey — System Audit Log Report&R&8Page &P / &N",
    },
  });

  COLUMNS.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width;
  });

  // 1. Tiêu đề
  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = "H&N ODYSSEY — SYSTEM AUDIT LOG REPORT";
  titleCell.font = {
    name: FONT_NAME,
    size: 16,
    bold: true,
    color: { argb: COLOR.white },
  };
  titleCell.fill = solidFill(COLOR.dark);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 34;

  sheet.mergeCells(2, 1, 2, lastCol);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value =
    "Báo cáo nhật ký hoạt động hệ thống — dùng cho mục đích kiểm tra và đối soát nội bộ";
  subtitleCell.font = {
    name: FONT_NAME,
    size: 10,
    italic: true,
    color: { argb: COLOR.muted },
  };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 20;

  // 2. Khối thông tin xuất file
  const successCount = rows.filter((r) => r.isSuccess).length;
  const failedCount = rows.length - successCount;

  const timeRange =
    filters.fromDate || filters.toDate
      ? `${filters.fromDate ? formatInputDate(filters.fromDate) : "Beginning"}  →  ${
          filters.toDate ? formatInputDate(filters.toDate) : "Now"
        }`
      : "All time";

  const otherFilters = [
    filters.actorEmail.trim()
      ? `Actor email contains "${filters.actorEmail.trim()}"`
      : "",
    filters.action.trim()
      ? `Action = ${filters.action.trim().toUpperCase()}`
      : "",
    filters.status !== "All" ? `Status = ${filters.status}` : "",
  ].filter(Boolean);

  const infoRows: [string, string][] = [
    ["Exported at", `${formatVnDateTime(new Date())} (GMT+7)`],
    ["Exported by", opts.exportedBy],
    ["Data source", `${opts.sourceName}  (${opts.sourceLabel})`],
    ["Time range", timeRange],
    ["Other filters", otherFilters.length ? otherFilters.join("; ") : "None"],
    [
      "Total records",
      opts.truncatedAt
        ? `${rows.length} records (limited to the first ${opts.truncatedAt})`
        : `${rows.length} records`,
    ],
    ["Result", `Success: ${successCount}     |     Failed: ${failedCount}`],
  ];

  let rowNo = 4;
  infoRows.forEach(([label, value]) => {
    sheet.mergeCells(rowNo, 1, rowNo, 2);
    sheet.mergeCells(rowNo, 3, rowNo, lastCol);

    styleRange(sheet, rowNo, 1, lastCol, (cell) => {
      cell.border = thinBorder();
    });
    styleRange(sheet, rowNo, 1, 2, (cell) => {
      cell.fill = solidFill(COLOR.labelFill);
    });

    const labelCell = sheet.getCell(rowNo, 1);
    labelCell.value = label;
    labelCell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: COLOR.dark },
    };
    labelCell.alignment = { vertical: "middle", indent: 1 };

    const valueCell = sheet.getCell(rowNo, 3);
    valueCell.value = value;
    valueCell.font = { name: FONT_NAME, size: 10, color: { argb: COLOR.dark } };
    valueCell.alignment = { vertical: "middle", indent: 1, wrapText: true };

    sheet.getRow(rowNo).height = 20;
    rowNo++;
  });

  // 3. Header bảng
  const headerRowNo = rowNo + 1;
  const headerRow = sheet.getRow(headerRowNo);
  COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: COLOR.dark },
    };
    cell.fill = solidFill(COLOR.headerFill);
    cell.border = thinBorder(COLOR.headerBorder);
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  });
  headerRow.height = 26;

  // 4. Dữ liệu
  rows.forEach((record, index) => {
    const row = sheet.getRow(headerRowNo + 1 + index);
    const values: (string | number | Date)[] = [
      index + 1,
      toExcelVnDate(record.time),
      record.actorEmail,
      record.actorCode || "—",
      record.actorName,
      record.department,
      record.action,
      record.collection,
      record.isSuccess ? "Success" : "Failed",
      record.errorReason || "—",
      record.ip,
      record.userAgent,
      record.detail ? truncate(JSON.stringify(record.detail)) : "—",
    ];

    values.forEach((value, colIndex) => {
      const col = COLUMNS[colIndex];
      const cell = row.getCell(colIndex + 1);
      cell.value = value;
      cell.font = { name: FONT_NAME, size: 10, color: { argb: COLOR.dark } };
      cell.border = thinBorder();
      cell.alignment = {
        horizontal: col.align ?? "left",
        vertical: "top",
        wrapText: col.wrap ?? false,
      };
      if (index % 2 === 1) cell.fill = solidFill(COLOR.zebra);
    });

    // Cột Time: kiểu ngày giờ thật để sắp xếp / lọc được trong Excel
    row.getCell(2).numFmt = "dd/mm/yyyy hh:mm:ss";

    // Cột Status: tô màu theo kết quả
    const statusCell = row.getCell(9);
    statusCell.fill = solidFill(
      record.isSuccess ? COLOR.successFill : COLOR.failedFill,
    );
    statusCell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: record.isSuccess ? COLOR.successText : COLOR.failedText },
    };

    // Cột Action: font đậm, dễ dò
    row.getCell(7).font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: COLOR.dark },
    };
  });

  const lastDataRow = headerRowNo + rows.length;

  // 5. Ghi chú khi dữ liệu bị cắt bớt
  if (opts.truncatedAt) {
    const noteRow = lastDataRow + 2;
    sheet.mergeCells(noteRow, 1, noteRow, lastCol);
    const noteCell = sheet.getCell(noteRow, 1);
    noteCell.value = `Lưu ý: báo cáo chỉ gồm ${opts.truncatedAt} bản ghi đầu tiên. Hãy thu hẹp bộ lọc để xuất đầy đủ.`;
    noteCell.font = {
      name: FONT_NAME,
      size: 10,
      italic: true,
      color: { argb: COLOR.failedText },
    };
  }

  // 6. Cố định header khi cuộn + nút lọc + lặp header khi in
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: headerRowNo }];
  sheet.autoFilter = {
    from: { row: headerRowNo, column: 1 },
    to: { row: Math.max(lastDataRow, headerRowNo), column: lastCol },
  };
  sheet.pageSetup.printTitlesRow = `${headerRowNo}:${headerRowNo}`;
}

// SHEET 2: TỔNG HỢP

function writeSummarySection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  firstHeader: string,
  data: [string, number][],
  total: number,
): number {
  let row = startRow;

  // Tiêu đề nhóm
  sheet.mergeCells(row, 1, row, 3);
  styleRange(sheet, row, 1, 3, (cell) => {
    cell.fill = solidFill(COLOR.headerFill);
    cell.border = thinBorder(COLOR.headerBorder);
  });
  const titleCell = sheet.getCell(row, 1);
  titleCell.value = title;
  titleCell.font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: COLOR.dark },
  };
  titleCell.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(row).height = 22;
  row++;

  // Header cột
  [firstHeader, "Count", "% of total"].forEach((header, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = header;
    cell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: COLOR.dark },
    };
    cell.fill = solidFill(COLOR.labelFill);
    cell.border = thinBorder();
    cell.alignment =
      i === 0
        ? { vertical: "middle", indent: 1 }
        : { horizontal: "center", vertical: "middle" };
  });
  row++;

  if (data.length === 0) {
    sheet.mergeCells(row, 1, row, 3);
    const emptyCell = sheet.getCell(row, 1);
    emptyCell.value = "No data";
    emptyCell.font = {
      name: FONT_NAME,
      size: 10,
      italic: true,
      color: { argb: COLOR.muted },
    };
    emptyCell.alignment = { horizontal: "center" };
    return row + 2;
  }

  data.forEach(([label, count], index) => {
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = label;
    labelCell.alignment = { vertical: "middle", indent: 1 };

    const countCell = sheet.getCell(row, 2);
    countCell.value = count;
    countCell.alignment = { horizontal: "center", vertical: "middle" };

    const percentCell = sheet.getCell(row, 3);
    percentCell.value = total > 0 ? count / total : 0;
    percentCell.numFmt = "0.0%";
    percentCell.alignment = { horizontal: "center", vertical: "middle" };

    styleRange(sheet, row, 1, 3, (cell) => {
      cell.font = { name: FONT_NAME, size: 10, color: { argb: COLOR.dark } };
      cell.border = thinBorder();
      if (index % 2 === 1) cell.fill = solidFill(COLOR.zebra);
    });
    row++;
  });

  return row + 1; // chừa 1 dòng trống giữa các nhóm
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  opts: AuditExcelOptions,
) {
  const { rows } = opts;
  const total = rows.length;

  const sheet = workbook.addWorksheet("Summary", {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.getColumn(1).width = 40;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 14;

  sheet.mergeCells(1, 1, 1, 3);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = "AUDIT LOG SUMMARY";
  titleCell.font = {
    name: FONT_NAME,
    size: 14,
    bold: true,
    color: { argb: COLOR.white },
  };
  titleCell.fill = solidFill(COLOR.dark);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(2, 1, 2, 3);
  const subCell = sheet.getCell(2, 1);
  subCell.value = `${opts.sourceName} (${opts.sourceLabel}) — ${total} records`;
  subCell.font = {
    name: FONT_NAME,
    size: 10,
    italic: true,
    color: { argb: COLOR.muted },
  };
  subCell.alignment = { horizontal: "center", vertical: "middle" };

  const successCount = rows.filter((r) => r.isSuccess).length;

  let row = 4;
  row = writeSummarySection(
    sheet,
    row,
    "By Status",
    "Status",
    [
      ["Success", successCount],
      ["Failed", total - successCount],
    ],
    total,
  );
  row = writeSummarySection(
    sheet,
    row,
    "By Department",
    "Department",
    countBy(rows, (r) => r.department),
    total,
  );
  row = writeSummarySection(
    sheet,
    row,
    "Top 10 Actions",
    "Action",
    countBy(rows, (r) => r.action).slice(0, 10),
    total,
  );
  writeSummarySection(
    sheet,
    row,
    "Top 10 Actors",
    "Actor Email",
    countBy(rows, (r) => r.actorEmail).slice(0, 10),
    total,
  );
}

// HÀM XUẤT FILE

export async function exportAuditLogsToExcel(opts: AuditExcelOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "H&N Odyssey Portal";
  workbook.title = "System Audit Log Report";
  workbook.created = new Date();

  buildReportSheet(workbook, opts);
  buildSummarySheet(workbook, opts);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // VD: HN-Odyssey_AuditLog_view_audit_sales_20261022-1430.xlsx
  const stamp = new Date(Date.now() + VN_OFFSET_MS)
    .toISOString()
    .slice(0, 16)
    .replace(/[-:]/g, "")
    .replace("T", "-");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `HN-Odyssey_AuditLog_${opts.sourceName}_${stamp}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
