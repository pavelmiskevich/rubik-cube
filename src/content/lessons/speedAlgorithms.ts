import { ALGORITHMS } from "./algorithms";

/**
 * Наборы алгоритмов скоростного метода.
 *
 * Уроки второго блока берут алгоритмы отсюда, и отсюда же их берёт
 * `speed.test.ts`. Он проверяет не отдельные примеры, а набор целиком:
 * перебирает все расклады, которые бывают на последнем слое, и утверждает, что
 * каждый из них решается ровно одним алгоритмом набора — с точностью до
 * поворота верхнего слоя. «Ровно одним» — это и полнота, и отсутствие дублей.
 *
 * Как и в первом блоке, всё записано только поворотами граней. Широкие
 * повороты, срезы и повороты кубика в руках движок не понимает, и режим
 * «Попробовать» не смог бы проверить такой алгоритм. Поэтому часть
 * алгоритмов выглядит непривычно для того, кто видел их в другой записи, —
 * это те же движения, записанные для кубика, который не перехватывают.
 * Каждая строка проверена движком: она делает ровно то, что обещает урок.
 */

export interface CaseAlgorithm {
  /** Устойчивый идентификатор случая внутри набора. */
  id: string;
  /** Имя случая, если оно у него есть. Без имени урок называет случай по узору. */
  name?: string;
  algorithm: string;
}

/* ---------------------------------------------- последний слой в два захода */

/** Первый заход ориентации: белый крест сверху, какими бы ни были углы. */
export const EDGE_ORIENTATION: readonly CaseAlgorithm[] = [
  { id: "line", name: "Линия", algorithm: "F R U R' U' F'" },
  { id: "angle", name: "Уголок", algorithm: "F U R U' R' F'" },
  { id: "dot", name: "Точка", algorithm: "F R U R' U' F' U2 F U R U' R' F'" },
];

/** Второй заход ориентации: крест уже есть, углы — белым вверх. */
export const CORNER_ORIENTATION: readonly CaseAlgorithm[] = [
  { id: "fish", name: "Рыбка", algorithm: ALGORITHMS.lastFace },
  { id: "fish-back", name: "Рыбка наоборот", algorithm: "R U2 R' U' R U' R'" },
  { id: "two-pairs", name: "Две пары фар", algorithm: "R U2 R' U' R U R' U' R U' R'" },
  { id: "pair-and-two", name: "Фары сбоку", algorithm: "R U2 R2 U' R2 U' R2 U2 R" },
  { id: "headlights", name: "Фары", algorithm: "R2 D' R U2 R' D R U2 R" },
  { id: "letter-t", name: "Буква Т", algorithm: "L F R' F' L' F R F'" },
  { id: "bowtie", name: "Бабочка", algorithm: "F' L F R' F' L' F R" },
];

/** Первый заход расстановки: углы по местам. */
export const CORNER_PERMUTATION: readonly CaseAlgorithm[] = [
  { id: "headlights", name: "Фары на одной стороне", algorithm: ALGORITHMS.lastCorners },
  {
    id: "diagonal",
    name: "Фар нет: углы меняются по диагонали",
    algorithm: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  },
];

/** Второй заход расстановки: углы стоят, рёбра — по местам. */
export const EDGE_PERMUTATION: readonly CaseAlgorithm[] = [
  { id: "ua", name: "Три ребра против часовой", algorithm: ALGORITHMS.lastEdges },
  { id: "ub", name: "Три ребра по часовой", algorithm: "R2 U R U R' U' R' U' R' U R'" },
  { id: "h", name: "Две пары напротив", algorithm: "R2 U2 R U2 R2 U2 R2 U2 R U2 R2" },
  { id: "z", name: "Две пары рядом", algorithm: "R' U' R U' R U R U' R' U R U R2 U' R' U2" },
];

/* ------------------------------------------------------- полные наборы */

/**
 * Ориентация последнего слоя за один алгоритм: все 57 случаев.
 *
 * Имён здесь нет намеренно: у случаев есть привычные номера и прозвища, но
 * урок называет каждый по тому, что видно на кубе, — это имя проверяется
 * позицией, а прозвище нет.
 */
export const ORIENTATION_CASES: readonly CaseAlgorithm[] = [
  { id: "o1", algorithm: "R U2 R2 F R F' U2 R' F R F'" },
  { id: "o2", algorithm: "F R U R' U' F' B U L U' L' B'" },
  { id: "o3", algorithm: "B U L U' L' B' U' F R U R' U' F'" },
  { id: "o4", algorithm: "B U L U' L' B' U F R U R' U' F'" },
  { id: "o5", algorithm: "R' F2 L F L' F R" },
  { id: "o6", algorithm: "L F2 R' F' R F' L'" },
  { id: "o7", algorithm: "L F R' F R F2 L'" },
  { id: "o8", algorithm: "R' F' L F' L' F2 R" },
  { id: "o9", algorithm: "R U R' U' R' F R2 U R' U' F'" },
  { id: "o10", algorithm: "R U R' U R' F R F' R U2 R'" },
  { id: "o11", algorithm: "L F R' F R' D R D' R F2 L'" },
  { id: "o12", algorithm: "R2 L F' R F' R' F2 R F' R L'" },
  { id: "o13", algorithm: "F U R U' R2 F' R U R U' R'" },
  { id: "o14", algorithm: "R' F R U R' F' R F U' F'" },
  { id: "o15", algorithm: "R' F' R L' U' L U R' F R" },
  { id: "o16", algorithm: "L F L' R U R' U' L F' L'" },
  { id: "o17", algorithm: "R U R' U R' F R F' U2 R' F R F'" },
  { id: "o18", algorithm: "L F R' F R F2 L2 B' R B' R' B2 L" },
  { id: "o19", algorithm: "R L' B R B R' B' R2 L F R F'" },
  { id: "o20", algorithm: "L F R' F' R2 L2 B R B' R' B' R' L" },
  { id: "o21", algorithm: "R U2 R' U' R U R' U' R U' R'" },
  { id: "o22", algorithm: "R U2 R2 U' R2 U' R2 U2 R" },
  { id: "o23", algorithm: "R2 D' R U2 R' D R U2 R" },
  { id: "o24", algorithm: "L F R' F' L' F R F'" },
  { id: "o25", algorithm: "F' L F R' F' L' F R" },
  { id: "o26", algorithm: "R U2 R' U' R U' R'" },
  { id: "o27", algorithm: "R U R' U R U2 R'" },
  { id: "o28", algorithm: "L F R' F' R L' U R U' R'" },
  { id: "o29", algorithm: "R U R' U' R U' R' F' U' F R U R'" },
  { id: "o30", algorithm: "F R' F R2 U' R' U' R U R' F2" },
  { id: "o31", algorithm: "R' U' F U R U' R' F' R" },
  { id: "o32", algorithm: "L U F' U' L' U L F L'" },
  { id: "o33", algorithm: "R U R' U' R' F R F'" },
  { id: "o34", algorithm: "R U R2 U' R' F R U R U' F'" },
  { id: "o35", algorithm: "R U2 R2 F R F' R U2 R'" },
  { id: "o36", algorithm: "L' U' L U' L' U L U L F' L' F" },
  { id: "o37", algorithm: "F R' F' R U R U' R'" },
  { id: "o38", algorithm: "R U R' U R U' R' U' R' F R F'" },
  { id: "o39", algorithm: "L F' L' U' L U F U' L'" },
  { id: "o40", algorithm: "R' F R U R' U' F' U R" },
  { id: "o41", algorithm: "R U R' U R U2 R' F R U R' U' F'" },
  { id: "o42", algorithm: "R' U' R U' R' U2 R F R U R' U' F'" },
  { id: "o43", algorithm: "F' U' L' U L F" },
  { id: "o44", algorithm: "F U R U' R' F'" },
  { id: "o45", algorithm: "F R U R' U' F'" },
  { id: "o46", algorithm: "R' U' R' F R F' U R" },
  { id: "o47", algorithm: "F' L' U' L U L' U' L U F" },
  { id: "o48", algorithm: "F R U R' U' R U R' U' F'" },
  { id: "o49", algorithm: "L F' L2 B L2 F L2 B' L" },
  { id: "o50", algorithm: "L' B L2 F' L2 B' L2 F L'" },
  { id: "o51", algorithm: "F U R U' R' U R U' R' F'" },
  { id: "o52", algorithm: "R U R' U R U' B U' B' R'" },
  { id: "o53", algorithm: "R' F2 L F L' F' L F L' F R" },
  { id: "o54", algorithm: "L F2 R' F' R F R' F' R F' L'" },
  { id: "o55", algorithm: "R' F R U R U' R2 F' R2 U' R' U R U R'" },
  { id: "o56", algorithm: "L' B' L U' R' U R U' R' U R L' B L" },
  { id: "o57", algorithm: "R U R' U' R' L F R F' L'" },
];

/**
 * Расстановка последнего слоя за один алгоритм: все 21 случай.
 *
 * Имена-буквы описывают форму стрелок перестановки на схеме и общеприняты;
 * пишутся латиницей — так их и ищут.
 */
export const PERMUTATION_CASES: readonly CaseAlgorithm[] = [
  { id: "ua", name: "Ua", algorithm: ALGORITHMS.lastEdges },
  { id: "ub", name: "Ub", algorithm: "R2 U R U R' U' R' U' R' U R'" },
  { id: "h", name: "H", algorithm: "R2 U2 R U2 R2 U2 R2 U2 R U2 R2" },
  { id: "z", name: "Z", algorithm: "R' U' R U' R U R U' R' U R U R2 U' R' U2" },
  { id: "aa", name: "Aa", algorithm: ALGORITHMS.lastCorners },
  { id: "ab", name: "Ab", algorithm: "R2 B2 R F R' B2 R F' R" },
  { id: "e", name: "E", algorithm: "R B' R' F R B R' F' R B R' F R B' R' F'" },
  { id: "t", name: "T", algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { id: "f", name: "F", algorithm: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R" },
  { id: "ja", name: "Ja", algorithm: "R' U L' U2 R U' R' U2 R L" },
  { id: "jb", name: "Jb", algorithm: "R U R' F' R U R' U' R' F R2 U' R'" },
  { id: "ra", name: "Ra", algorithm: "R U' R' U' R U R D R' U' R D' R' U2 R'" },
  { id: "rb", name: "Rb", algorithm: "R2 F R U R U' R' F' R U2 R' U2 R" },
  { id: "v", name: "V", algorithm: "R' U R' U' B' R' B2 U' B' U B' R B R" },
  { id: "y", name: "Y", algorithm: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { id: "na", name: "Na", algorithm: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'" },
  { id: "nb", name: "Nb", algorithm: "R' U R U' R' F' U' F R U R' F R' F' R U' R" },
  { id: "ga", name: "Ga", algorithm: "R2 U R' U R' U' R U' R2 U' D R' U R D'" },
  { id: "gb", name: "Gb", algorithm: "R' U' R U D' R2 U R' U R U' R U' R2 D" },
  { id: "gc", name: "Gc", algorithm: "R2 U' R U' R U R' U R2 U D' R U' R' D" },
  { id: "gd", name: "Gd", algorithm: "R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];
