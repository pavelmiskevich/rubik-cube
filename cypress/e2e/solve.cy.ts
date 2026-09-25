/**
 * Экран «Решить мой кубик» целиком в браузере: базы ему не нужно.
 *
 * Раскраску перемешанного кубика даёт движок курса, а не список из 54 букв,
 * переписанный руками: так в сценарии видно, какой скрамбл заполнен. Ответ
 * экрана тоже проверяется движком — ходы решения, применённые к тому же
 * скрамблу, должны собрать кубик. Движок закрыт юнит-тестами; здесь
 * проверяется, что экран показывает ровно то, что решатель нашёл.
 */
import { stateToFacelets, type Sticker } from "../../src/lib/cube/facelets";
import { applyNotation } from "../../src/lib/cube/moves";
import { isSolved } from "../../src/lib/cube/predicates";
import { SOLVED_CUBE } from "../../src/lib/cube/state";

/** Порядок граней в раскраске движка — `FACELET_FACES` в facelets.ts. */
const FACES: readonly Sticker[] = ["U", "R", "F", "D", "L", "B"];

/** Подписи экрана — `FACE_NAME` и `STICKER_NAME` в src/components/solve/palette.ts. */
const FACE_NAME: Record<Sticker, string> = {
  U: "Верх",
  D: "Низ",
  F: "Фронт",
  B: "Тыл",
  R: "Право",
  L: "Лево",
};
const COLOUR_NAME: Record<Sticker, string> = {
  U: "белый",
  D: "жёлтый",
  F: "зелёный",
  B: "синий",
  R: "красный",
  L: "оранжевый",
};

/** Двадцать ходов по правилам WCA: ни одна грань не повторяется подряд. */
const SCRAMBLE = "D2 F' U2 B2 R2 D' L2 U' F2 R' B D' F' L2 U B' L D2 R2 F";

/** Наклейка на развёртке по номеру в раскраске движка. */
function sticker(index: number) {
  const face = FACES[Math.floor(index / 9)];
  const row = Math.floor((index % 9) / 3) + 1;
  const column = (index % 3) + 1;
  return cy.get(`button[aria-label^="${FACE_NAME[face]}, ряд ${row}, столбец ${column}:"]`);
}

/** Выбрать цвет в палитре. */
function brush(colour: Sticker) {
  cy.contains("button[aria-pressed]", COLOUR_NAME[colour]).click();
  cy.contains("button[aria-pressed]", COLOUR_NAME[colour]).should(
    "have.attr",
    "aria-pressed",
    "true"
  );
}

/**
 * Заполнить развёртку раскраской: сначала как собранный, затем перекрасить
 * только отличающиеся наклейки — по цвету за раз, как это делает человек.
 */
function paint(target: readonly Sticker[]) {
  cy.contains("button", "Заполнить как собранный").click();
  const solved = stateToFacelets(SOLVED_CUBE);
  for (const colour of FACES) {
    const indices = target
      .map((value, index) => ({ value, index }))
      .filter(({ value, index }) => value === colour && solved[index] !== colour)
      .map(({ index }) => index);
    if (indices.length === 0) continue;
    brush(colour);
    for (const index of indices) sticker(index).click();
  }
}

/** Ходы из текста решения — по одному на слово. */
const movesOf = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

describe("Решить мой кубик", () => {
  beforeEach(() => {
    cy.visit("/solve");
    cy.contains("h2", "Осталось назвать").should("be.visible");
  });

  it("узнаёт собранный кубик", () => {
    cy.contains("button", "Заполнить как собранный").click();
    cy.contains("h2", "Этот кубик уже собран").should("be.visible");
    cy.contains("a", "К урокам").should("have.attr", "href", "/learn");
  });

  it("объясняет, почему кубика с такой раскраской не бывает", () => {
    // Две наклейки одного угла меняются цветами: счёт цветов сходится, а
    // угол становится зеркальным — такого на настоящем кубике нет.
    const facelets = [...stateToFacelets(SOLVED_CUBE)];
    const up = 8; // Верх, ряд 3, столбец 3 — угол верх-фронт-право.
    const right = 9; // Право, ряд 1, столбец 1 — тот же угол.
    [facelets[up], facelets[right]] = [facelets[right], facelets[up]];
    paint(facelets);

    cy.contains("h2", "Такого кубика быть не может").should("be.visible");
    cy.contains("h2", "Такого кубика быть не может")
      .parent()
      .find("li")
      .should("have.length.at.least", 1);
    cy.contains("Наклейки, которые стоит проверить, обведены").should("be.visible");
  });

  it("решает перемешанный кубик по шагам и коротко", () => {
    const scrambled = applyNotation(SCRAMBLE);
    paint(stateToFacelets(scrambled));

    // «Понятно» — по умолчанию: шаги курса, и вместе они собирают кубик.
    cy.contains("button", "Понятно").should("have.attr", "aria-pressed", "true");
    cy.contains("h2", "Как собрать этот кубик").should("be.visible");
    cy.contains("h2", "Как собрать этот кубик")
      .parent()
      .find("ol > li p.font-mono")
      .should("have.length.at.least", 1)
      .then(($steps) => {
        const moves = [...$steps].flatMap((step) => movesOf(step.textContent ?? ""));
        expect(isSolved(applyNotation(moves.join(" "), scrambled)), "шаги собирают кубик").to.eq(
          true
        );
      });

    // «Коротко» — около двадцати ходов. Таблицы поиска строятся в фоновом
    // потоке при первом выборе режима, отсюда запас по времени.
    cy.contains("button", "Коротко").click();
    cy.contains("h2", "Короткое решение", { timeout: 30000 }).should("be.visible");
    cy.contains("h2", "Короткое решение")
      .parent()
      .find("p.font-mono")
      .invoke("text")
      .then((text) => {
        const moves = movesOf(text);
        expect(moves.length, "ходов в коротком решении").to.be.within(15, 22);
        expect(isSolved(applyNotation(moves.join(" "), scrambled)), "короткое решение собирает кубик").to.eq(
          true
        );
        cy.contains("h2", "Короткое решение")
          .parent()
          .should("contain.text", `${moves.length} ход`);
      });
  });
});
