import { applyNotation, type Face } from "@/lib/cube/moves";
import type { Corner, CubeState } from "@/lib/cube/state";
import type { Side } from "@/lib/cube/frames";
import {
  LAST_LAYER_SIDES,
  bars,
  cornersUp,
  edgesUp,
  headlights,
  lastLayerView,
  topColourFacing,
} from "@/lib/cube/lastLayer";

/**
 * Слова, которыми урок описывает случай последнего слоя.
 *
 * В полных наборах случаев десятки, и описывать каждый руками значило бы
 * десятки мест, где слова могут разойтись с позицией на кубе. Поэтому
 * описание выводится из самой позиции шага: что белым вверх, куда смотрит
 * белое у остальных углов, где фары и полоски. Соврать оно не может — оно
 * прочитано с того же состояния, которое показывает куб.
 */

const SIDE_WHERE: Readonly<Record<Side, string>> = {
  F: "спереди",
  R: "справа",
  B: "сзади",
  L: "слева",
};

const CORNER_WHERE: Readonly<Record<string, string>> = {
  UFL: "спереди слева",
  URF: "спереди справа",
  UBR: "сзади справа",
  ULB: "сзади слева",
};

const FACING: Readonly<Record<Face, string>> = {
  U: "вверх",
  D: "вниз",
  F: "на вас",
  B: "от вас",
  R: "вправо",
  L: "влево",
};

/** Углы в том порядке, в каком их удобно читать: спереди слева и по кругу. */
const CORNER_ORDER: readonly Corner[] = ["UFL", "URF", "UBR", "ULB"];

const listWords = (words: readonly string[]): string => {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} и ${words[words.length - 1]}`;
};

export type EdgeShape = "cross" | "line" | "angle" | "dot";

/** Форма, которую складывают рёбра белым вверх вместе с центром. */
export function edgeShape(state: CubeState): EdgeShape {
  const up = edgesUp(state);
  if (up.length === 4) return "cross";
  if (up.length === 0) return "dot";
  const [first, second] = up;
  const opposite = LAST_LAYER_SIDES.indexOf(second) - LAST_LAYER_SIDES.indexOf(first) === 2;
  return opposite ? "line" : "angle";
}

export const EDGE_SHAPE_NAME: Readonly<Record<EdgeShape, string>> = {
  cross: "Крест",
  line: "Линия",
  angle: "Уголок",
  dot: "Точка",
};

function edgesSentence(state: CubeState): string {
  const up = edgesUp(state);
  switch (edgeShape(state)) {
    case "cross":
      return "все четыре ребра — крест";
    case "dot":
      return "ни одного ребра, только центр — точка";
    case "line":
      return up.includes("F")
        ? "рёбра спереди и сзади — линия от вас"
        : "рёбра слева и справа — линия поперёк";
    case "angle":
      return `рёбра ${listWords(up.map((side) => SIDE_WHERE[side]))} — уголок`;
  }
}

const CORNERS_UP_TITLE = [
  "ни одного угла вверх",
  "один угол вверх",
  "два угла вверх",
  "три угла вверх",
  "все углы вверх",
];

function cornersSentence(state: CubeState): string {
  const up = CORNER_ORDER.filter((slot) => cornersUp(state).includes(slot));
  if (up.length === 0) return "углов белым вверх нет";
  if (up.length === 4) return "все четыре угла тоже белым вверх";
  const where = listWords(up.map((slot) => CORNER_WHERE[slot]));
  return up.length === 1 ? `белым вверх один угол, ${where}` : `белым вверх два угла: ${where}`;
}

/** Куда смотрит белое у углов, которые смотрят им не вверх. */
function cornerDirections(state: CubeState): string[] {
  return CORNER_ORDER.flatMap((slot) => {
    const facing = topColourFacing(state, slot);
    return facing === "U" ? [] : [`${CORNER_WHERE[slot]} — ${FACING[facing]}`];
  });
}

/** Сколько белых наклеек видно на верхнем ряду каждой стороны. */
function whiteOnSides(state: CubeState): string {
  const view = lastLayerView(state);
  return LAST_LAYER_SIDES.map((side) => ({
    side,
    count: view.sides[side].filter((colour) => colour === "U").length,
  }))
    .filter(({ count }) => count > 0)
    .map(({ side, count }) => `${SIDE_WHERE[side]} ${count}`)
    .join(", ");
}

/**
 * Название случая ориентации — форма рёбер и число углов белым вверх. Внутри
 * одной формы названия могут совпадать: их различает описание и схема.
 */
export function orientationTitle(state: CubeState): string {
  return `${EDGE_SHAPE_NAME[edgeShape(state)]}, ${CORNERS_UP_TITLE[cornersUp(state).length]}`;
}

/** Как узнать случай ориентации: что белым вверх и куда смотрит остальное белое. */
export function describeOrientation(state: CubeState): string {
  const directions = cornerDirections(state);
  const sides = whiteOnSides(state);
  return [
    `Белым вверх: ${edgesSentence(state)}; ${cornersSentence(state)}.`,
    directions.length > 0 ? `У остальных углов белое смотрит так: ${directions.join(", ")}.` : "",
    sides ? `Белых наклеек на верхнем ряду боков: ${sides}.` : "",
    "Поверните верхний слой, чтобы узор лёг так же, как на кубе и на схеме, и сделайте алгоритм: верх станет белым целиком, а два нижних слоя останутся на месте.",
  ]
    .filter(Boolean)
    .join(" ");
}

const AUF = ["", "U", "U2", "U'"] as const;

const inOrder = (values: readonly number[]): boolean =>
  values.slice(0, 4).every((value, index) => value === index);

/**
 * Что перепутано на верхнем слое с точностью до его поворота: одни рёбра,
 * одни углы или и то и другое.
 */
export function movedPieces(state: CubeState): "edges" | "corners" | "both" {
  const turned = AUF.map((turn) => applyNotation(turn, state));
  if (turned.some((candidate) => inOrder(candidate.cornerPermutation))) return "edges";
  if (turned.some((candidate) => inOrder(candidate.edgePermutation))) return "corners";
  return "both";
}

const MOVED_SENTENCE: Readonly<Record<ReturnType<typeof movedPieces>, string>> = {
  edges: "Углы стоят верно друг относительно друга — перепутаны только рёбра.",
  corners: "Рёбра стоят верно друг относительно друга — перепутаны только углы.",
  both: "Перепутаны и углы, и рёбра.",
};

const sidesPhrase = (sides: readonly Side[]): string =>
  sides.length === 4 ? "на всех четырёх сторонах" : listWords(sides.map((side) => SIDE_WHERE[side]));

/**
 * Как узнать случай расстановки: где фары, где полоски. Верх уже белый, и
 * случаи различает только верхний ряд боков.
 */
export function describePermutation(state: CubeState): string {
  const view = lastLayerView(state);
  const lights = headlights(view);
  const whole = bars(view);
  return [
    `Верх белый, перепутан только верхний ряд боков. ${MOVED_SENTENCE[movedPieces(state)]}`,
    lights.length > 0
      ? `Фары — два угла одного цвета на одной стороне — ${sidesPhrase(lights)}.`
      : "Фар — двух углов одного цвета на одной стороне — нет нигде.",
    whole.length > 0
      ? `Полоска — весь ряд одного цвета — ${sidesPhrase(whole)}.`
      : "Полосок — целого ряда одного цвета — нет.",
    "Поставьте кубик так же, как на схеме, и сделайте алгоритм.",
  ].join(" ");
}
