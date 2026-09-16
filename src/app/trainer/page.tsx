import RubiksCube from "@/components/cube/RubiksCube";

export const metadata = {
  title: "3D-тренажёр | RubikPlatform",
};

export default function TrainerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">3D-тренажёр</h1>
      <div className="h-[600px] w-full overflow-hidden rounded-card border bg-surface">
        <RubiksCube />
      </div>
      <p className="text-muted">
        Вращайте слои мышью или свайпом по граням куба. Драг вне куба вращает
        камеру.
      </p>
    </div>
  );
}
