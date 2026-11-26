import { DEFAULT_MAX_SOLVES, maxSolvesPerUser, tooFrequent } from "./saveLimits";

describe("maxSolvesPerUser", () => {
  it("без настройки — значение по умолчанию", () => {
    expect(maxSolvesPerUser(undefined)).toBe(DEFAULT_MAX_SOLVES);
    expect(maxSolvesPerUser("")).toBe(DEFAULT_MAX_SOLVES);
    expect(DEFAULT_MAX_SOLVES).toBe(1000);
  });

  it("берёт положительное целое из настройки", () => {
    expect(maxSolvesPerUser("500")).toBe(500);
    expect(maxSolvesPerUser(" 20000 ")).toBe(20_000);
  });

  it("негодное значение не снимает потолок", () => {
    for (const bad of ["0", "-5", "1.5", "abc", "1e3", "Infinity", "99999999999999999999"]) {
      expect(maxSolvesPerUser(bad)).toBe(DEFAULT_MAX_SOLVES);
    }
  });
});

describe("tooFrequent", () => {
  it("округляет ожидание вверх до секунд, не меньше одной", () => {
    expect(tooFrequent(2_100)).toBe("Слишком часто — попробуйте через 3 с");
    expect(tooFrequent(0)).toBe("Слишком часто — попробуйте через 1 с");
  });
});
