/**
 * @jest-environment jsdom
 */

/*
  Выбор «все сборки / урок» на /stats — обычные ссылки. Проверяется, куда они
  ведут и какая отмечена выбранной: вид кнопок — дело вёрстки.
*/

import { render, screen, within } from "@testing-library/react";
import LessonFilter from "./LessonFilter";
import { getLesson, type Lesson } from "@/content/lessons";

function lesson(slug: string): Lesson {
  const found = getLesson(slug);
  if (!found) throw new Error(`Нет урока ${slug}`);
  return found;
}

const PAIRS = lesson("paired-layers");
const NOTATION = lesson("notation");

const links = () => within(screen.getByTestId("lesson-filter")).getAllByRole("link");
const selected = () => links().filter((link) => link.getAttribute("aria-current") === "true");

describe("LessonFilter", () => {
  it("ведёт на все сборки и на каждый урок, в порядке курса", () => {
    render(<LessonFilter lessons={[NOTATION, PAIRS]} />);

    expect(links().map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Все сборки", "/stats"],
      [NOTATION.title, "/stats?lesson=notation"],
      [PAIRS.title, "/stats?lesson=paired-layers"],
    ]);
  });

  it("без выбранного урока отмечены все сборки", () => {
    render(<LessonFilter lessons={[NOTATION, PAIRS]} />);

    expect(selected().map((link) => link.textContent)).toEqual(["Все сборки"]);
  });

  it("выбранный урок отмечен, и отмечен он один", () => {
    render(<LessonFilter lessons={[NOTATION, PAIRS]} selected={PAIRS} />);

    expect(selected().map((link) => link.textContent)).toEqual([PAIRS.title]);
  });

  it("экранирует slug в адресе", () => {
    const odd: Lesson = { ...PAIRS, slug: "a b&c", title: "Странный" };
    render(<LessonFilter lessons={[odd]} />);

    expect(screen.getByRole("link", { name: "Странный" }).getAttribute("href")).toBe(
      "/stats?lesson=a%20b%26c"
    );
  });

  it("подписан для экранного диктора", () => {
    render(<LessonFilter lessons={[PAIRS]} />);

    expect(screen.getByRole("navigation", { name: "Какие сборки считать" })).toBeTruthy();
  });
});
