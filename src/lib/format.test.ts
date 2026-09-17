import { averageHint } from "./format";

describe("подсказка о нехватке сборок", () => {
  it("молчит, когда сборок хватает", () => {
    expect(averageHint(5, 5)).toBeNull();
    expect(averageHint(12, 5)).toBeNull();
  });

  it("считает, сколько осталось до Ao5", () => {
    expect(averageHint(0, 5)).toBe("ещё 5 до Ao5");
    expect(averageHint(4, 5)).toBe("ещё 1 до Ao5");
  });

  it("работает и для Ao12", () => {
    expect(averageHint(7, 12)).toBe("ещё 5 до Ao12");
  });
});
