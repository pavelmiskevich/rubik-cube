import { buildSparklinePoints, toPolylinePoints } from "./sparkline";
import { DNF } from "./statistics";

describe("геометрия спарклайна", () => {
  it("на пустом списке не даёт точек", () => {
    expect(buildSparklinePoints([], 100, 20)).toEqual([]);
  });

  it("рисует лучшую сборку выше худшей", () => {
    const [slow, fast] = buildSparklinePoints([20000, 10000], 100, 20, 2);
    expect(fast.y).toBeLessThan(slow.y);
  });

  it("растягивает точки на всю ширину за вычетом полей", () => {
    const points = buildSparklinePoints([1, 2, 3], 102, 20, 2);
    expect(points[0].x).toBeCloseTo(2, 5);
    expect(points[2].x).toBeCloseTo(100, 5);
  });

  it("пропускает DNF, не разрывая линию", () => {
    const points = buildSparklinePoints([10000, DNF, 12000], 100, 20);
    expect(points).toHaveLength(2);
  });

  it("не делит на ноль, когда все сборки одинаковы", () => {
    const points = buildSparklinePoints([9000, 9000], 100, 20);
    expect(points.every((point) => Number.isFinite(point.y))).toBe(true);
  });

  it("на единственной сборке ставит одну точку", () => {
    expect(buildSparklinePoints([9000], 100, 20)).toHaveLength(1);
  });

  it("собирает строку для polyline", () => {
    expect(toPolylinePoints([{ x: 1, y: 2 }, { x: 3.456, y: 4 }])).toBe(
      "1.00,2.00 3.46,4.00"
    );
  });
});
