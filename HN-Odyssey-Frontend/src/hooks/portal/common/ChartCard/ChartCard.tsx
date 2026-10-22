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
    <div className="chc-card">
      {/* US.95 AC2: nút Xuất PDF đặt TẠI biểu đồ, nằm ngoài vùng chụp */}
      <button
        type="button"
        className="chc-pdf-btn"
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
      <div ref={captureRef} className="chc-capture">
        <div className="chc-header">
          <div className="chc-title">{title}</div>
          {period && <div className="chc-period">{period}</div>}
        </div>
        {subtitle && <div className="chc-subtitle">{subtitle}</div>}
        {legend && <div className="chc-legend">{legend}</div>}
        {isLoading ? (
          <div className="portal-skel chc-skeleton" aria-busy="true" />
        ) : (
          <div className="chc-body chc-body-enter">{children}</div>
        )}
      </div>
    </div>
  );
}
