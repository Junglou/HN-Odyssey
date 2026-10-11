import { useCallback, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "react-toastify";
import axiosClient from "../../../api/axiosClient";
import {
  getExportErrorMessage,
  saveBlobResponse,
} from "../../../utils/exportFile";

export interface ExportChartOptions {
  title: string; // Tiêu đề in trên PDF
  period?: string; // Kỳ báo cáo (US.95 AC3)
  fileNamePrefix: string; // Ví dụ "RevenueTrend" → RevenueTrend_20261009.pdf
}

const todayStamp = (): string => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

/** US.95 AC2: chụp giao diện biểu đồ → Backend đóng gói thành PDF kèm metadata (AC7) */
export function useExportChartPdf() {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(
    async (node: HTMLElement | null, options: ExportChartOptions) => {
      if (!node) {
        toast.error("Không tìm thấy biểu đồ để xuất PDF.");
        return;
      }
      try {
        setIsExporting(true);

        // pdfkit chỉ nhận PNG/JPEG → chụp biểu đồ thành PNG
        const chartImageBase64 = await toPng(node, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
          cacheBust: true,
          filter: (el) =>
            !(el instanceof HTMLElement && el.dataset.exportIgnore === "true"),
        });

        // Biểu đồ dạng ngang → in khổ ngang để không bị thu nhỏ
        const orientation =
          node.offsetWidth / Math.max(node.offsetHeight, 1) > 1.2
            ? "landscape"
            : "portrait";

        const response = await axiosClient.post<Blob>(
          "/admin/reports/export/chart/pdf",
          {
            chartImageBase64,
            title: options.title,
            period: options.period,
            orientation,
          },
          { responseType: "blob" },
        );

        await saveBlobResponse(
          response,
          `${options.fileNamePrefix}_${todayStamp()}.pdf`,
        );
        toast.success("Đã tải biểu đồ PDF.");
      } catch (err) {
        console.error(err);
        toast.error(
          await getExportErrorMessage(err, "Lỗi khi xuất biểu đồ PDF."),
        );
      } finally {
        setIsExporting(false);
      }
    },
    [],
  );

  return { exportPdf, isExporting };
}
