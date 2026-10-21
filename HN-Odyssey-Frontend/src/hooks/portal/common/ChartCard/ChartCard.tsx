import { useRef, type ReactNode } from "react";
import "./ChartCard.css";
import { useExportChartPdf } from "../../../../hooks/portal/common/useExportChartPdf";

interface ChartCardProps {
  title: string; // Tiêu đề biểu đồ (nằm trong ảnh PDF)
  subtitle?: string; // Ghi chú công thức... (nằm trong ảnh PDF)
  period?: string; // Kỳ báo cáo (nằm trong ảnh PDF)
  legend?: ReactNode; // Chú giải tùy biến (nằm trong ảnh PDF)
  pdfTitle: string; // Tiêu đề in ở đầu file PDF
  fileNamePrefix: string; // Tiền tố tên file PDF
  canExport: boolean; // Quyền EXPORT của trang (US.95 AC6)
  isLoading?: boolean; // đang chờ API -> hiện skeleton, khóa Export
  children: ReactNode;
}

export default function ChartCard({
  title,
  subtitle,
  period,
  legend,
  pdfTitle,
  fileNamePrefix,
  canExport,
  isLoading = false,
  children,
}: ChartCardProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const { exportPdf, isExporting } = useExportChartPdf();
  const disabled = !canExport || isExporting || isLoading;

  return (
    <div className="cc-card">
      {/* US.95 AC2: nút Xuất PDF đặt TẠI biểu đồ, nằm ngoài vùng chụp */}
      <button
        type="button"
        className="cc-pdf-btn"
        disabled={disabled}
        title={
          canExport
            ? "Export this chart to PDF"
            : "Your account does not have Export permission"
        }
        onClick={() =>
          void exportPdf(captureRef.current, {
            title: pdfTitle,
            period,
            fileNamePrefix,
          })
        }
      >
        {isExporting ? "Exporting..." : "Export PDF"}
      </button>

      {/* Chỉ vùng này được chụp vào PDF */}
      <div ref={captureRef} className="cc-capture">
        <div className="cc-header">
          <div className="cc-title">{title}</div>
          {period && <div className="cc-period">{period}</div>}
        </div>
        {subtitle && <div className="cc-subtitle">{subtitle}</div>}
        {legend && <div className="cc-legend">{legend}</div>}
        {isLoading ? (
          <div className="portal-skel cc-skeleton" aria-busy="true" />
        ) : (
          <div className="cc-body cc-body-enter">{children}</div>
        )}
      </div>
    </div>
  );
}
