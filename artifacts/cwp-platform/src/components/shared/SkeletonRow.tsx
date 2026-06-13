interface SkeletonRowProps {
  cols?: number;
  rows?: number;
}

export function SkeletonRow({ cols = 5, rows = 6 }: SkeletonRowProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-border">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-3 bg-muted rounded animate-pulse" style={{ width: `${50 + ((r + c) * 13) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default SkeletonRow;
