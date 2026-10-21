interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

// render các <tr> giả đặt thẳng vào <tbody> -> giữ nguyên header và độ rộng cột
export default function TableSkeleton({
  columns,
  rows = 8,
}: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={`skel-${r}`} className="portal-skel-row" aria-hidden="true">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c}>
              <div
                className="portal-skel portal-skel-bar"
                style={{ width: `${55 + ((r + c) % 3) * 15}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
