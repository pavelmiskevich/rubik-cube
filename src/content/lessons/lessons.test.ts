import { SOLVED_CUBE } from "@/lib/cube/state";
import { applyNotation, applySequence, parseSequence } from "@/lib/cube/moves";
import { LESSONS, getLesson } from "./index";
import { isGoalReached } from "./types";

/**
 * Проверка курса, а не одного урока: перебор идёт по LESSONS, поэтому каждый
 * новый урок попадает под неё сам, без правки теста.
 *
 * Главное здесь — предпоследний тест. Он утверждает, что урок не врёт: его
 * алгоритм действительно приводит к обещанной цели, и это говорит движок, а не
 * автор урока.
 */
const allSteps = LESSONS.flatMap((lesson) =>
  lesson.steps.map((step) => ({ lesson: lesson.slug, step }))
);

describe("курс", () => {
  it("состоит из уроков с уникальными адресами", () => {
    const slugs = LESSONS.map((lesson) => lesson.slug);
    expect(slugs.length).toBeGreaterThan(0);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("находит урок по адресу и молчит про несуществующий", () => {
    LESSONS.forEach((lesson) => expect(getLesson(lesson.slug)).toBe(lesson));
    expect(getLesson("нет-такого")).toBeUndefined();
  });

  it("даёт каждому уроку название, описание и хотя бы один шаг", () => {
    LESSONS.forEach((lesson) => {
      expect(lesson.title.length).toBeGreaterThan(0);
      expect(lesson.summary.length).toBeGreaterThan(0);
      expect(lesson.steps.length).toBeGreaterThan(0);
    });
  });

  it("держит идентификаторы шагов уникальными внутри урока", () => {
    LESSONS.forEach((lesson) => {
      const ids = lesson.steps.map((step) => step.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});

describe("шаги уроков", () => {
  it.each(allSteps)("$lesson / $step.id: последовательности разбираются", ({ step }) => {
    expect(() => parseSequence(step.setup)).not.toThrow();
    expect(() => parseSequence(step.algorithm)).not.toThrow();
    expect(parseSequence(step.algorithm).length).toBeGreaterThan(0);
  });

  it.each(allSteps)("$lesson / $step.id: объяснение написано словами", ({ step }) => {
    expect(step.title.length).toBeGreaterThan(0);
    // Объяснение — единственное, что читает человек; пустая строка здесь
    // означала бы урок, который ничего не объясняет.
    expect(step.explanation.length).toBeGreaterThan(40);
  });

  it.each(allSteps)("$lesson / $step.id: алгоритм приводит к цели шага", ({ step }) => {
    const start = applyNotation(step.setup);
    const finish = applySequence(start, parseSequence(step.algorithm));

    expect(isGoalReached(finish, step.goal)).toBe(true);
  });

  it.each(allSteps)("$lesson / $step.id: до алгоритма цель ещё не достигнута", ({ step }) => {
    // Иначе шагу нечему учить: позиция уже удовлетворяет цели, и человек не
    // увидит, что именно сделал алгоритм.
    const start = applyNotation(step.setup);

    expect(isGoalReached(start, step.goal)).toBe(false);
  });

  it.each(allSteps)("$lesson / $step.id: стартовая позиция не равна собранной", ({ step }) => {
    expect(applyNotation(step.setup)).not.toEqual(SOLVED_CUBE);
  });
});
