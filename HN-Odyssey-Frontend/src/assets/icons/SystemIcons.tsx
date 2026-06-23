export const CheckCircleIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const WarningAlertIcon = ({
  className = "",
}: {
  className?: string;
}) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const ClockIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const ChevronDownIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const RefreshIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const MiniApiChartIcon = ({
  className = "",
}: {
  className?: string;
}) => (
  <svg
    className={className}
    viewBox="0 0 200 50"
    width="100%"
    height="100%"
    preserveAspectRatio="none"
  >
    <polygon
      points="0,50 0,35 30,38 60,20 90,5 120,30 150,35 180,25 200,40 200,50"
      fill="rgba(59, 130, 246, 0.1)"
    />
    <line
      x1="0"
      y1="25"
      x2="200"
      y2="25"
      stroke="#cbd5e1"
      strokeWidth="1"
      strokeDasharray="4 4"
    />
    <polyline
      points="0,35 30,38 60,20 90,5 120,30 150,35 180,25 200,40"
      fill="none"
      stroke="#3b82f6"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <text x="0" y="10" fontSize="10" fill="#9ca3af">
      160ms
    </text>
    <text x="0" y="48" fontSize="10" fill="#9ca3af">
      0
    </text>
  </svg>
);

export const GaugeChartIcon = ({
  value,
  color,
  className = "",
}: {
  value: number;
  color: string;
  className?: string;
}) => {
  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  // Tính toán góc quay của kim (0% -> -180 độ, 100% -> 0 độ)
  const angle = (value / 100) * 180;

  return (
    <svg viewBox="0 0 140 80" className={className} width="100%" height="100%">
      {/* Vòng nền xám */}
      <path
        d="M 10 70 A 60 60 0 0 1 130 70"
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* Vòng màu hiển thị giá trị */}
      <path
        d="M 10 70 A 60 60 0 0 1 130 70"
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
      />
      {/* Kim chỉ nam (Needle) */}
      <g transform={`translate(70, 70) rotate(${angle - 180})`}>
        <line
          x1="0"
          y1="0"
          x2="45"
          y2="0"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="0" cy="0" r="5" fill={color} />
      </g>
      {/* Các nhãn */}
      <text x="15" y="80" fontSize="11" fontWeight="600" fill="#9ca3af">
        0
      </text>
      <text x="125" y="80" fontSize="11" fontWeight="600" fill="#9ca3af">
        90%
      </text>
    </svg>
  );
};
