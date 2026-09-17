export default function Stat({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  /**
   * Показывается вместо крупного числа, когда его ещё нет: «ещё 2 до Ao5».
   * Отдельным пропом, а не строкой в value, потому что в моноширинном кегле
   * 3xl такая подсказка вылезает за плитку на узком экране.
   */
  hint?: string | null;
  testId?: string;
}) {
  return (
    <div className="rounded-card border bg-surface p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      {hint ? (
        <p className="mt-2 text-sm text-muted" data-testid={testId}>
          {hint}
        </p>
      ) : (
        /* Табличные цифры: иначе среднее дёргается при каждой новой сборке. */
        <p
          className="mt-1 font-mono text-3xl font-bold tabular-nums"
          data-testid={testId}
        >
          {value}
        </p>
      )}
    </div>
  );
}
