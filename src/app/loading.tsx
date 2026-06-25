export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-28 animate-pulse rounded-[var(--radius-card)] border bg-card" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-[var(--radius-card)] border bg-card" />
      ))}
    </div>
  );
}
