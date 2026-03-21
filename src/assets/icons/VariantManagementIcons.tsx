export function BackArrowIcon({
  stroke = "#111827",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="19" y1="12" x2="5" y2="12"></line>
      {/* new: Polyline đã được sửa lại tọa độ chuẩn để tạo thành mũi tên hoàn hảo */}
      <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
  );
}
