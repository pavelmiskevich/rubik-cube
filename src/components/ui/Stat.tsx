export default function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="rounded-card border bg-surface p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      {/* Табличные цифры: иначе среднее дёргается при каждой новой сборке. */}
      <p
        className="mt-1 font-mono text-3xl font-bold tabular-nums"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}
