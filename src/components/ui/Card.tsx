export default function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card border bg-surface p-6 ${className}`}>
      {children}
    </div>
  );
}
