import { LESSONS } from "@/content/lessons";
import {
  practisedLesson,
  selectedStatsLesson,
  solveLessonSlug,
  statsLessonOptions,
} from "./practiceLesson";

const practised = LESSONS.filter((lesson) => lesson.practice);
const plain = LESSONS.find((lesson) => !lesson.practice)!;
const [first, second] = practised;

describe("какой урок принимается у сборки", () => {
  it("в курсе есть и тренируемые уроки, и обычные — иначе тесты ниже ничего не проверяют", () => {
    expect(practised.length).toBeGreaterThanOrEqual(2);
    expect(plain).toBeDefined();
  });

  it("урок с полем practice принимается", () => {
    expect(practisedLesson(first.slug)).toBe(first);
    expect(solveLessonSlug(first.slug)).toBe(first.slug);
  });

  it("урок без practice — свободная сборка: на таймере его не тренируют", () => {
    expect(practisedLesson(plain.slug)).toBeUndefined();
    expect(solveLessonSlug(plain.slug)).toBeNull();
  });

  it("несуществующий урок — свободная сборка, а не ошибка", () => {
    expect(solveLessonSlug("no-such-lesson")).toBeNull();
    expect(solveLessonSlug("")).toBeNull();
  });

  it("без урока — свободная сборка", () => {
    expect(solveLessonSlug(undefined)).toBeNull();
    expect(solveLessonSlug(null)).toBeNull();
  });

  it("мусор вместо строки — свободная сборка", () => {
    // Серверное действие зовут с чем угодно; повторённый параметр адреса
    // приходит массивом.
    for (const bad of [[first.slug], { slug: first.slug }, 42, true]) {
      expect(solveLessonSlug(bad)).toBeNull();
    }
  });

  it("регистр и пробелы не подгоняются: slug либо точный, либо чужой", () => {
    expect(solveLessonSlug(` ${first.slug}`)).toBeNull();
    expect(solveLessonSlug(first.slug.toUpperCase())).toBeNull();
  });
});

describe("выбор урока на /stats", () => {
  it("предлагает только уроки, по которым есть сборки, в порядке курса", () => {
    const options = statsLessonOptions([second.slug, first.slug, second.slug]);
    expect(options).toEqual([first, second]);
  });

  it("свободные сборки и уроки, которых нет в курсе, в выбор не попадают", () => {
    expect(statsLessonOptions([null, "removed-lesson", plain.slug])).toEqual([]);
  });

  it("без сборок по урокам выбирать нечего", () => {
    expect(statsLessonOptions([])).toEqual([]);
  });

  it("выбранный урок берётся из предложенных", () => {
    const options = statsLessonOptions([first.slug, second.slug]);
    expect(selectedStatsLesson(second.slug, options)).toBe(second);
  });

  it("урок без сборок, чужой или мусор в адресе — «все сборки»", () => {
    const options = statsLessonOptions([first.slug]);
    expect(selectedStatsLesson(second.slug, options)).toBeUndefined();
    expect(selectedStatsLesson("no-such-lesson", options)).toBeUndefined();
    expect(selectedStatsLesson([first.slug], options)).toBeUndefined();
    expect(selectedStatsLesson(undefined, options)).toBeUndefined();
  });
});
