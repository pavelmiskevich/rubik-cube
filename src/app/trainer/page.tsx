import RubiksCube from "@/components/cube/RubiksCube";

export const metadata = {
  title: "3D Тренажер | RubikPlatform",
};

export default function TrainerPage() {
  return (
    <div className="mx-auto max-w-7xl p-4">
      <h1 className="text-3xl font-bold mb-4">3D Тренажер</h1>
      <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-gray-100">
        <RubiksCube />
      </div>
      <p className="mt-4 text-gray-600">
        Используйте мышь или свайпы по граням кубика, чтобы вращать слои.
        Драг вне кубика вращает камеру.
      </p>
    </div>
  );
}
