import { CORNERS, CORNER_INDEX, Corner, CubeState, EDGES, EDGE_INDEX, Edge, SOLVED_CUBE } from "@/lib/cube/state";
import { Face, applyNotation, formatSequence, parseSequence } from "@/lib/cube/moves";
import {
  areLastLayerCornersPlaced,
  areTwoLayersSolved,
  cornerColour,
  edgeColour,
  isCrossSolved,
  isFirstLayerSolved,
  isLastLayerCrossFormed,
  isLastLayerOriented,
  isSolved,
} from "@/lib/cube/predicates";
import { ALGORITHMS } from "./algorithms";
import { LESSONS, getLesson } from "./index";
import type { LessonStep } from "./types";

/**
 * Проверка метода, а не примеров.
 *
 * `lessons.test.ts` утверждает, что алгоритм каждого шага срабатывает на
 * показанной позиции. Этого мало: новичок встретит на своём кубике не ту
 * позицию, что в уроке, а любую. Здесь каждое правило из объяснений записано
 * кодом — «найди, поверни так, сделай алгоритм, повтори» — и прогнано по всем
 * случаям шага. Правило, которое где-то не срабатывает, роняет тест.
 *
 * Правило пользуется только тем, чему учит урок: алгоритмами из
 * `algorithms.ts`, поворотами верхнего слоя и поворотом всего кубика в руках.
 * Последнего движок не умеет, поэтому здесь он записан как переименование
 * граней: алгоритм, сделанный «глядя на правую сторону», — это тот же
 * алгоритм, где F заменена на R, R на B и так далее.
 */

type Side = "F" | "R" | "B" | "L";
const SIDES: readonly Side[] = ["F", "R", "B", "L"];

/** Куб повёрнут в руках так, что спереди `front`: какая настоящая грань под каждым именем. */
const FRAMES: Readonly<Record<Side, Readonly<Record<Face, Face>>>> = {
  F: { U: "U", D: "D", F: "F", R: "R", B: "B", L: "L" },
  R: { U: "U", D: "D", F: "R", R: "B", B: "L", L: "F" },
  B: { U: "U", D: "D", F: "B", R: "L", B: "F", L: "R" },
  L: { U: "U", D: "D", F: "L", R: "F", B: "R", L: "B" },
};

const inFrame = (algorithm: string, front: Side): string =>
  formatSequence(
    parseSequence(algorithm).map((move) => ({ face: FRAMES[front][move.face], turn: move.turn }))
  );

const sameLetters = (a: string, b: string) => a.length === b.length && [...a].every((c) => b.includes(c));

const realEdge = (slot: Edge, front: Side): Edge => {
  const letters = [...slot].map((face) => FRAMES[front][face as Face]).join("");
  return EDGES.find((name) => sameLetters(name, letters))!;
};

const realCorner = (slot: Corner, front: Side): Corner => {
  const letters = [...slot].map((face) => FRAMES[front][face as Face]).join("");
  return CORNERS.find((name) => sameLetters(name, letters))!;
};

/** Цвет на грани `face` у ребра `slot`, всё — в именах повёрнутого в руках куба. */
const edgeSeen = (state: CubeState, front: Side, slot: Edge, face: Face): Face => {
  const real = edgeColour(state, realEdge(slot, front), FRAMES[front][face]);
  return (Object.keys(FRAMES[front]) as Face[]).find((name) => FRAMES[front][name] === real)!;
};

const cornerSeen = (state: CubeState, front: Side, slot: Corner, face: Face): Face => {
  const real = cornerColour(state, realCorner(slot, front), FRAMES[front][face]);
  return (Object.keys(FRAMES[front]) as Face[]).find((name) => FRAMES[front][name] === real)!;
};

const cornerHome = (state: CubeState, slot: Corner) =>
  state.cornerPermutation[CORNER_INDEX[slot]] === CORNER_INDEX[slot] &&
  state.cornerOrientation[CORNER_INDEX[slot]] === 0;

const edgeHome = (state: CubeState, slot: Edge) =>
  state.edgePermutation[EDGE_INDEX[slot]] === EDGE_INDEX[slot] &&
  state.edgeOrientation[EDGE_INDEX[slot]] === 0;

const U_TURNS = ["", "U", "U2", "U'"] as const;

/** Исполнитель правила: копит сделанное и считает алгоритмы. */
class Hands {
  algorithms = 0;
  readonly moves: string[] = [];
  constructor(public state: CubeState) {}
  turn(notation: string) {
    if (!notation.trim()) return;
    this.state = applyNotation(notation, this.state);
    this.moves.push(notation);
  }
  algorithm(notation: string) {
    this.turn(notation);
    this.algorithms++;
  }
}

/* ---------------------------------------------------------------- правила */

/**
 * Поворот куба в руках и поворот верхнего слоя, после которых позиция
 * подходит под `fits`. Первый найденный — так же, как человек берёт первый
 * попавшийся подходящий случай.
 */
function findTarget(
  fits: (front: Side, after: CubeState) => boolean,
  state: CubeState
): { front: Side; u: string } | undefined {
  for (const front of SIDES) {
    for (const u of U_TURNS) {
      if (fits(front, applyNotation(u, state))) return { front, u };
    }
  }
  return undefined;
}

/**
 * Углы первого слоя. Найти наверху угол с жёлтым (цветом нижней грани),
 * повернуть куб в руках так, чтобы место угла было справа спереди, верхним
 * слоем поставить угол над ним и повторять R U R' U', пока угол не встанет.
 * Если наверху таких нет, а слой не собран — угол застрял внизу: встать к нему
 * тем же образом и один раз сделать R U R' U', он окажется наверху.
 */
function firstLayerCorners(hands: Hands) {
  for (let guard = 0; guard < 20 && !isFirstLayerSolved(hands.state, "D"); guard++) {
    const found = findTarget((front, after) => {
      const colours = (["U", "R", "F"] as const).map((face) => cornerSeen(after, front, "URF", face));
      return colours.includes("D") && colours.includes("F") && colours.includes("R");
    }, hands.state);
    if (found) {
      const { front, u } = found;
      hands.turn(u);
      let repeats = 0;
      while (!cornerHome(hands.state, realCorner("DFR", front))) {
        hands.algorithm(inFrame(ALGORITHMS.corner, front));
        repeats++;
        expect(repeats).toBeLessThanOrEqual(5);
      }
      continue;
    }
    const stuck = SIDES.find((front) => !cornerHome(hands.state, realCorner("DFR", front)))!;
    hands.algorithm(inFrame(ALGORITHMS.corner, stuck));
  }
  expect(isFirstLayerSolved(hands.state, "D")).toBe(true);
}

/**
 * Средний слой. Найти наверху ребро без белого (цвета верхней грани); повернуть
 * куб и верхний слой так, чтобы его боковой цвет совпал с центром спереди;
 * верхний цвет ребра совпадает с правым центром — алгоритм вправо, с левым —
 * влево. Если наверху таких нет, а слой не собран — ребро застряло в среднем
 * слое: встать так, чтобы оно было справа спереди, и выбить его алгоритмом
 * вправо.
 */
function middleLayer(hands: Hands) {
  for (let guard = 0; guard < 20 && !areTwoLayersSolved(hands.state, "D"); guard++) {
    const found = findTarget(
      (front, after) =>
        edgeSeen(after, front, "UF", "F") === "F" && ["R", "L"].includes(edgeSeen(after, front, "UF", "U")),
      hands.state
    );
    if (found) {
      const { front, u } = found;
      hands.turn(u);
      const top = edgeSeen(hands.state, front, "UF", "U");
      hands.algorithm(inFrame(top === "R" ? ALGORITHMS.edgeRight : ALGORITHMS.edgeLeft, front));
      continue;
    }
    const stuck = SIDES.find((front) => !edgeHome(hands.state, realEdge("FR", front)))!;
    hands.algorithm(inFrame(ALGORITHMS.edgeRight, stuck));
  }
  expect(areTwoLayersSolved(hands.state, "D")).toBe(true);
}

const topEdgeUp = (state: CubeState, slot: Edge) => edgeColour(state, slot, "U") === "U";

/**
 * Крест на последнем слое. Точка — алгоритм как есть. Уголок — повернуть верх
 * так, чтобы он смотрел назад и влево (белое на ребре сзади и слева), и
 * алгоритм. Палочка — повернуть верх так, чтобы она лежала поперёк, слева
 * направо, и алгоритм. Повторять, пока не будет креста.
 */
function lastLayerCross(hands: Hands) {
  while (!isLastLayerCrossFormed(hands.state, "U")) {
    const u = U_TURNS.find((turn) => {
      const after = applyNotation(turn, hands.state);
      const [uf, ur, ub, ul] = (["UF", "UR", "UB", "UL"] as const).map((slot) => topEdgeUp(after, slot));
      const upCount = [uf, ur, ub, ul].filter(Boolean).length;
      if (upCount === 0) return true;
      return (ub && ul && !uf && !ur) || (ul && ur && !uf && !ub);
    });
    expect(u).toBeDefined();
    hands.turn(u!);
    hands.algorithm(ALGORITHMS.lastCross);
    expect(hands.algorithms).toBeLessThanOrEqual(3);
  }
}

const topCornerUp = (state: CubeState, slot: Corner) => cornerColour(state, slot, "U") === "U";

/**
 * Верхняя грань одного цвета. Сосчитать углы, у которых белое смотрит вверх.
 * Ни одного — повернуть верх так, чтобы у левого переднего угла белое смотрело
 * влево. Один — поставить его слева спереди. Два — повернуть верх так, чтобы у
 * левого переднего угла белое смотрело на вас. Алгоритм; повторять.
 */
function lastLayerFace(hands: Hands) {
  while (!isLastLayerOriented(hands.state, "U")) {
    const up = (["URF", "UFL", "ULB", "UBR"] as const).filter((slot) => topCornerUp(hands.state, slot)).length;
    const want: Face = up === 0 ? "L" : up === 1 ? "U" : "F";
    const u = U_TURNS.find((turn) => cornerColour(applyNotation(turn, hands.state), "UFL", want) === "U");
    expect(u).toBeDefined();
    hands.turn(u!);
    hands.algorithm(ALGORITHMS.lastFace);
    expect(hands.algorithms).toBeLessThanOrEqual(3);
  }
}

/** Поворот верха, после которого все углы на местах, если такой есть. */
const cornersAlignTurn = (state: CubeState) =>
  U_TURNS.find((turn) => areLastLayerCornersPlaced(applyNotation(turn, state), "U"));

/** Две верхние угловые наклейки стороны `side` одного цвета — «фары». */
const hasHeadlights = (state: CubeState, side: Side): boolean => {
  const corners = CORNERS.filter((name) => name.startsWith("U") && name.includes(side));
  const [a, b] = corners.map((slot) => cornerColour(state, slot, side));
  return a === b;
};

/**
 * Углы по местам. Найти сторону, где два верхних угла одного цвета («фары»),
 * и повернуть верх так, чтобы фары оказались сзади. Нет фар — с любой стороны.
 * Алгоритм; повторять, пока верхним слоем не получится поставить все углы
 * по центрам — тогда поставить.
 */
function lastLayerCorners(hands: Hands) {
  while (cornersAlignTurn(hands.state) === undefined) {
    const u = U_TURNS.find((turn) => hasHeadlights(applyNotation(turn, hands.state), "B")) ?? "";
    hands.turn(u);
    hands.algorithm(ALGORITHMS.lastCorners);
    expect(hands.algorithms).toBeLessThanOrEqual(2);
  }
  hands.turn(cornersAlignTurn(hands.state)!);
  expect(areLastLayerCornersPlaced(hands.state, "U")).toBe(true);
}

/** Сторона, где весь верхний ряд одного цвета — «полоска». */
const hasStripe = (state: CubeState, side: Side): boolean => {
  const corners = CORNERS.filter((name) => name.startsWith("U") && name.includes(side));
  const edge = EDGES.find((name) => name.startsWith("U") && name.includes(side))!;
  const colours = [...corners.map((slot) => cornerColour(state, slot, side)), edgeColour(state, edge, side)];
  return colours.every((colour) => colour === colours[0]);
};

/**
 * Рёбра по местам. Найти полоску, повернуть верх так, чтобы она оказалась
 * сзади. Нет полоски — с любой стороны. Алгоритм, затем верхним слоем вернуть
 * углы к своим центрам. Не собралось — ещё раз.
 */
function lastLayerEdges(hands: Hands) {
  while (!isSolved(hands.state)) {
    const u = U_TURNS.find((turn) => hasStripe(applyNotation(turn, hands.state), "B")) ?? "";
    hands.turn(u);
    hands.algorithm(ALGORITHMS.lastEdges);
    const align = cornersAlignTurn(hands.state);
    expect(align).toBeDefined();
    hands.turn(align!);
    expect(hands.algorithms).toBeLessThanOrEqual(3);
  }
}

/* ----------------------------------------------------- перебор случаев */

/** Все позиции верхнего слоя: перестановки четырёх деталей. */
function permutations(items: readonly number[]): number[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])
  );
}

/** Чётность перестановки: 0 — чётная. Сумма длин циклов минус их число. */
const parity = (perm: readonly number[]): number => {
  const seen = perm.map(() => false);
  let swaps = 0;
  perm.forEach((_, start) => {
    let length = 0;
    for (let at = start; !seen[at]; at = perm[at]) {
      seen[at] = true;
      length++;
    }
    if (length > 0) swaps += length - 1;
  });
  return swaps % 2;
};

/** Верхний слой с заданными перестановками и ориентациями, всё остальное собрано. */
function lastLayerState(
  corners: readonly number[],
  cornerTwists: readonly number[],
  edges: readonly number[],
  edgeFlips: readonly number[]
): CubeState {
  return {
    cornerPermutation: [...corners, ...SOLVED_CUBE.cornerPermutation.slice(4)],
    cornerOrientation: [...cornerTwists, ...SOLVED_CUBE.cornerOrientation.slice(4)],
    edgePermutation: [...edges, ...SOLVED_CUBE.edgePermutation.slice(4)],
    edgeOrientation: [...edgeFlips, ...SOLVED_CUBE.edgeOrientation.slice(4)],
  };
}

const HOME = [0, 1, 2, 3];
const NONE = [0, 0, 0, 0];

const allFlips = () =>
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    .map((bits) => [0, 1, 2, 3].map((bit) => (bits >> bit) & 1))
    .filter((flips) => flips.reduce((a, b) => a + b, 0) % 2 === 0);

const allTwists = () => {
  const result: number[][] = [];
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 3; b++)
      for (let c = 0; c < 3; c++) result.push([a, b, c, (6 - a - b - c) % 3]);
  return result;
};

describe("правило каждого шага срабатывает на любом его случае", () => {
  it("знает все случаи верхнего слоя и считает их верно", () => {
    expect(allFlips()).toHaveLength(8);
    expect(allTwists()).toHaveLength(27);
    expect(permutations(HOME)).toHaveLength(24);
    expect(parity([1, 0, 2, 3])).toBe(1);
    expect(parity([1, 2, 0, 3])).toBe(0);
  });

  it.each(allFlips())("крест на последнем слое: рёбра перевёрнуты как %j", (...flips) => {
    const hands = new Hands(lastLayerState(HOME, NONE, HOME, flips));
    lastLayerCross(hands);
    expect(isLastLayerCrossFormed(hands.state, "U")).toBe(true);
  });

  it.each(allTwists())("верхняя грань: углы повёрнуты как %j", (...twists) => {
    const hands = new Hands(lastLayerState(HOME, twists, HOME, NONE));
    lastLayerFace(hands);
    expect(isLastLayerOriented(hands.state, "U")).toBe(true);
  });

  it("углы по местам: любая перестановка углов", () => {
    permutations(HOME).forEach((corners) => {
      const edges = parity(corners) === 0 ? HOME : [1, 0, 2, 3];
      const hands = new Hands(lastLayerState(corners, NONE, edges, NONE));
      lastLayerCorners(hands);
    });
  });

  it("рёбра по местам: любая перестановка рёбер при углах на местах", () => {
    const even = permutations(HOME).filter((edges) => parity(edges) === 0);
    expect(even).toHaveLength(12);
    even.forEach((edges) => {
      const hands = new Hands(lastLayerState(HOME, NONE, edges, NONE));
      lastLayerEdges(hands);
      expect(isSolved(hands.state)).toBe(true);
    });
  });
});

/* ------------------------------------------------ весь курс подряд */

/** Детерминированный генератор: тест не должен зависеть от удачи. */
function seeded(seed: number) {
  let value = seed;
  return (bound: number) => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value % bound;
  };
}

/**
 * Кубы с собранным крестом, но в остальном перемешанные. Строятся ходами,
 * которые крест не трогают, — значит, такие позиции у настоящего кубика
 * бывают.
 */
function crossSolvedScrambles(count: number): CubeState[] {
  const random = seeded(45);
  const words = SIDES.flatMap((front) => [
    inFrame(ALGORITHMS.corner, front),
    inFrame("U R U' R'", front),
    inFrame(ALGORITHMS.edgeRight, front),
    inFrame(ALGORITHMS.edgeLeft, front),
  ]).concat(["U", "U2", "U'", ALGORITHMS.lastCross, ALGORITHMS.lastFace, ALGORITHMS.lastEdges]);

  return Array.from({ length: count }, () => {
    let state = SOLVED_CUBE;
    for (let n = 0; n < 30; n++) state = applyNotation(words[random(words.length)], state);
    return state;
  });
}

describe("курс целиком: от собранного креста до собранного куба", () => {
  const scrambles = crossSolvedScrambles(150);

  it("строит действительно перемешанные позиции с целым крестом", () => {
    scrambles.forEach((state) => expect(isCrossSolved(state, "D")).toBe(true));
    expect(scrambles.filter((state) => !isFirstLayerSolved(state, "D")).length).toBeGreaterThan(140);
  });

  it("доводит каждую до собранного куба, шаг за шагом по урокам", () => {
    scrambles.forEach((state) => {
      const hands = new Hands(state);
      firstLayerCorners(hands);
      middleLayer(hands);
      hands.algorithms = 0;
      lastLayerCross(hands);
      hands.algorithms = 0;
      lastLayerFace(hands);
      hands.algorithms = 0;
      lastLayerCorners(hands);
      hands.algorithms = 0;
      lastLayerEdges(hands);
      expect(isSolved(hands.state)).toBe(true);
    });
  });
});

/* ------------------------------------- уроки показывают ровно то, что правило */

const rules: Readonly<Record<string, (hands: Hands) => void>> = {
  "first-layer": firstLayerCorners,
  "second-layer": middleLayer,
  "last-layer-cross": lastLayerCross,
  "last-layer-face": lastLayerFace,
  "last-layer-permutation-corners": lastLayerCorners,
  "last-layer-permutation-edges": lastLayerEdges,
};

const ruleFor = (lesson: string, step: LessonStep) =>
  rules[
    lesson === "last-layer-permutation"
      ? `${lesson}-${step.goal.kind === "solved" ? "edges" : "corners"}`
      : lesson
  ];

const demonstrated = LESSONS.flatMap((lesson) =>
  lesson.steps
    .filter((step) => ruleFor(lesson.slug, step) !== undefined)
    .map((step) => ({ lesson: lesson.slug, step }))
);

const tidy = (notation: string) => formatSequence(parseSequence(notation));
const startOf = (step: LessonStep) => applyNotation(step.setup);
const stepOf = (slug: string, id: string) => getLesson(slug)!.steps.find((step) => step.id === id)!;

describe("показанный алгоритм — это то, что делает правило", () => {
  it("охватывает каждый шаг уроков, у которых есть правило", () => {
    // Нотация и крест собираются пониманием, а не правилом; у остальных пяти
    // уроков каждый шаг обязан быть здесь.
    const covered = LESSONS.filter(
      (lesson) => !["notation", "cross"].includes(lesson.slug)
    ).reduce((count, lesson) => count + lesson.steps.length, 0);

    expect(demonstrated).toHaveLength(covered);
    expect(covered).toBeGreaterThan(0);
  });

  it.each(demonstrated)("$lesson / $step.id", ({ lesson, step }) => {
    const hands = new Hands(startOf(step));
    ruleFor(lesson, step)!(hands);

    expect(tidy(hands.moves.join(" "))).toBe(tidy(step.algorithm));
  });
});

/* ------------------------------------------ объяснения не врут про позицию */

const topEdgesUp = (state: CubeState) =>
  (["UB", "UF", "UL", "UR"] as const).filter((slot) => topEdgeUp(state, slot));

const topCornersUp = (state: CubeState) =>
  (["URF", "UFL", "ULB", "UBR"] as const).filter((slot) => topCornerUp(state, slot));

describe("объяснение шага описывает ту позицию, которую шаг показывает", () => {
  it("крест: ребро стоит над своим местом жёлтым вверх", () => {
    const start = startOf(stepOf("cross", "edge-up"));

    expect(edgeColour(start, "UF", "U")).toBe("D");
    expect(start.edgePermutation[EDGE_INDEX.UF]).toBe(EDGE_INDEX.DF);
  });

  it.each([
    ["corner-yellow-right", "R"],
    ["corner-yellow-up", "U"],
    ["corner-yellow-front", "F"],
  ] as const)("углы: в шаге %s жёлтое смотрит на грань %s", (id, face) => {
    expect(cornerColour(startOf(stepOf("first-layer", id)), "URF", face)).toBe("D");
  });

  it("углы: в шаге про чужое место угол встаёт над своим одним поворотом U'", () => {
    const start = startOf(stepOf("first-layer", "corner-aside"));

    expect(start.cornerPermutation[CORNER_INDEX.URF]).not.toBe(CORNER_INDEX.DFR);
    expect(applyNotation("U'", start).cornerPermutation[CORNER_INDEX.URF]).toBe(CORNER_INDEX.DFR);
  });

  it("углы: в шаге про застрявший угол он внизу на своём месте, но повёрнут", () => {
    const start = startOf(stepOf("first-layer", "corner-stuck"));

    expect(start.cornerPermutation[CORNER_INDEX.DFR]).toBe(CORNER_INDEX.DFR);
    expect(start.cornerOrientation[CORNER_INDEX.DFR]).not.toBe(0);
  });

  it.each([
    ["edge-right", "R"],
    ["edge-left", "L"],
  ] as const)("средний слой: в шаге %s боковой цвет совпал, сверху цвет грани %s", (id, face) => {
    const start = startOf(stepOf("second-layer", id));

    expect(edgeColour(start, "UF", "F")).toBe("F");
    expect(edgeColour(start, "UF", "U")).toBe(face);
  });

  it("средний слой: в шаге про подгонку боковой цвет совпадает только после U", () => {
    const start = startOf(stepOf("second-layer", "edge-adjust"));

    expect(edgeColour(start, "UF", "F")).not.toBe("F");
    expect(edgeColour(applyNotation("U", start), "UF", "F")).toBe("F");
  });

  it("средний слой: в шаге про застрявшее ребро оно перевёрнуто в своём месте, а наверху подходящих нет", () => {
    const start = startOf(stepOf("second-layer", "edge-stuck"));

    expect(start.edgePermutation[EDGE_INDEX.FR]).toBe(EDGE_INDEX.FR);
    expect(start.edgeOrientation[EDGE_INDEX.FR]).toBe(1);
    // Каждое ребро наверху — с белым, то есть из последнего слоя.
    const topSlots = ["UF", "UR", "UB", "UL"] as const;
    const withoutWhite = topSlots.filter(
      (slot) => edgeColour(start, slot, "U") !== "U" && edgeColour(start, slot, slot[1] as Face) !== "U"
    );
    expect(withoutWhite).toHaveLength(0);
  });

  it("крест последнего слоя: палочка лежит поперёк", () => {
    expect(topEdgesUp(startOf(stepOf("last-layer-cross", "line")))).toEqual(["UL", "UR"]);
  });

  it("крест последнего слоя: уголок смотрит назад и влево, а после алгоритма выходит палочка поперёк", () => {
    const start = startOf(stepOf("last-layer-cross", "corner"));

    expect(topEdgesUp(start)).toEqual(["UB", "UL"]);
    expect(topEdgesUp(applyNotation(ALGORITHMS.lastCross, start))).toEqual(["UL", "UR"]);
  });

  it("крест последнего слоя: у точки белого наверху нет вовсе, а после алгоритма появляется уголок", () => {
    const start = startOf(stepOf("last-layer-cross", "dot"));

    expect(topEdgesUp(start)).toHaveLength(0);
    expect(topEdgesUp(applyNotation(ALGORITHMS.lastCross, start))).toHaveLength(2);
  });

  it("белая грань: у рыбки один угол белым вверх, и он слева спереди", () => {
    expect(topCornersUp(startOf(stepOf("last-layer-face", "fish")))).toEqual(["UFL"]);
  });

  it("белая грань: во втором шаге рыбка стоит иначе, а после U и алгоритма снова рыбка", () => {
    const start = startOf(stepOf("last-layer-face", "fish-again"));

    expect(topCornersUp(start)).toHaveLength(1);
    expect(topCornersUp(start)).not.toEqual(["UFL"]);
    expect(topCornersUp(applyNotation(`U ${ALGORITHMS.lastFace}`, start))).toHaveLength(1);
  });

  it("белая грань: когда белым вверх не смотрит никто, у левого переднего угла белое смотрит влево", () => {
    const start = startOf(stepOf("last-layer-face", "none-up"));

    expect(topCornersUp(start)).toHaveLength(0);
    expect(cornerColour(start, "UFL", "L")).toBe("U");
    expect(topCornersUp(applyNotation(ALGORITHMS.lastFace, start))).toHaveLength(1);
  });

  it("белая грань: в шаге про два угла их ровно два, и после U белое левого переднего смотрит вперёд", () => {
    const start = startOf(stepOf("last-layer-face", "two-up"));

    expect(topCornersUp(start)).toHaveLength(2);
    expect(cornerColour(applyNotation("U", start), "UFL", "F")).toBe("U");
  });

  it("расстановка: в шаге про фары они сзади, а углы ещё не на местах", () => {
    const start = startOf(stepOf("last-layer-permutation", "corners-headlights"));

    expect(hasHeadlights(start, "B")).toBe(true);
    expect(areLastLayerCornersPlaced(start, "U")).toBe(false);
  });

  it("расстановка: в шаге без фар их нет ни на одной стороне, а после алгоритма есть", () => {
    const start = startOf(stepOf("last-layer-permutation", "corners-no-headlights"));
    const after = applyNotation(ALGORITHMS.lastCorners, start);

    expect(SIDES.filter((side) => hasHeadlights(start, side))).toHaveLength(0);
    expect(SIDES.filter((side) => hasHeadlights(after, side)).length).toBeGreaterThan(0);
  });

  it.each([
    ["edges-stripe", "B"],
    ["edges-twice", "B"],
    ["edges-stripe-aside", "F"],
  ] as const)("расстановка: в шаге %s полоска на стороне %s", (id, side) => {
    const start = startOf(stepOf("last-layer-permutation", id));

    expect(hasStripe(start, side)).toBe(true);
    expect(isSolved(start)).toBe(false);
  });

  it("расстановка: в шаге без полоски её нет ни на одной стороне, а после алгоритма появляется", () => {
    const start = startOf(stepOf("last-layer-permutation", "edges-no-stripe"));
    const after = applyNotation(ALGORITHMS.lastEdges, start);

    expect(SIDES.filter((side) => hasStripe(start, side))).toHaveLength(0);
    expect(SIDES.filter((side) => hasStripe(after, side)).length).toBeGreaterThan(0);
  });
});
