import { contrastRatio, relativeLuminance } from "./contrast";

describe("контраст по WCAG", () => {
  it("чёрный на белом даёт предельные 21:1", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
  });

  it("одинаковые цвета дают 1:1", () => {
    expect(contrastRatio("#6B4AF0", "#6B4AF0")).toBeCloseTo(1, 5);
  });

  it("порядок аргументов не влияет на результат", () => {
    expect(contrastRatio("#E8EAED", "#0B0D10")).toBeCloseTo(
      contrastRatio("#0B0D10", "#E8EAED"),
      10
    );
  });

  it("совпадает с числами, посчитанными для спеки", () => {
    // Значения из docs/superpowers/specs/2026-09-10-redesign-design.md
    expect(contrastRatio("#E8EAED", "#0B0D10")).toBeCloseTo(16.14, 1);
    expect(contrastRatio("#FFFFFF", "#6B4AF0")).toBeCloseTo(5.44, 1);
    expect(contrastRatio("#FFFFFF", "#5B34D9")).toBeCloseTo(7.15, 1);
  });

  it("яркость белого равна единице, чёрного — нулю", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10);
  });

  it("отвергает то, что не является цветом", () => {
    expect(() => contrastRatio("голубой", "#000000")).toThrow();
  });
});
