type Tone = "neutral" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "border text-muted",
  warning: "border text-accent-text",
  danger: "border text-danger",
};

export default function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-control px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
