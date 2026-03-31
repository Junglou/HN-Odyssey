// icon mũi tên quay lại dùng trong phần header của drawer hoặc các form
export const ArrowLeftIcon = ({
  stroke = "#111827",
  className = "",
}: {
  stroke?: string;
  className?: string;
}) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);
