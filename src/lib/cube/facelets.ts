/**
 * Facelets: the 54 stickers a person can see, and the bridge between what they
 * type in and the cubie-level state the engine works with.
 *
 * `state.ts` models a cube the way a solver reasons about it — pieces in slots,
 * turned this way or that. Someone holding a scrambled cube sees none of that:
 * they see coloured squares. This file is the translation, in both directions,
 * plus the far more important half — deciding whether the squares they typed
 * could ever belong to a real cube.
 *
 * ## Why a colour is called a face
 *
 * A sticker is named after the face it belongs to on the solved cube, so the
 * white stickers are `U` and the red ones `R`. That is not a shortcut: the
 * centres never move relative to one another, so "white" and "the colour of the
 * up face" are the same fact stated twice, and naming it once keeps the engine,
 * the screen and the course speaking about the same thing. Which physical
 * colour each face carries is the screen's business and lives in `cubeTheme.ts`.
 *
 * ## The order of the 54
 *
 * Faces run U, R, F, D, L, B; inside a face the squares run in rows, left to
 * right and top to bottom, as seen by someone looking straight at that face.
 * "Looking straight at it" is pinned down by the geometry tables below rather
 * than by a hand-written list of 54 numbers: every facelet is a point on the
 * cube, every piece is the set of points it covers, and the correspondence
 * between them is derived. A hand-written table would be eight lines shorter
 * and would hide a typo indefinitely.
 *
 * ## Why the check is this thorough
 *
 * Most colourings a person types in are not cubes at all. A solver fed one
 * would search forever or return nonsense, and the person would blame the
 * program rather than their typing. So everything a real cube guarantees is
 * checked here: nine stickers per colour, centres in place, every piece a piece
 * that exists and exists once, and the three things that no sequence of turns
 * can break — a lone twisted corner, a lone flipped edge, a lone pair of pieces
 * swapped. The first four say where the mistake is; the last three cannot, and
 * say so honestly instead of guessing.
 */

import {
  CORNERS,
  CORNER_COUNT,
  CORNER_INDEX,
  CORNER_ORIENTATIONS,
  CubeState,
  EDGES,
  EDGE_COUNT,
  EDGE_ORIENTATIONS,
} from "./state";
import { Face } from "./moves";

/** A sticker colour, named after the face that colour covers on a solved cube. */
export type Sticker = Face;

/**
 * 54 stickers in face order U, R, F, D, L, B; inside a face, rows left to right
 * and top to bottom as seen looking straight at it.
 */
export type Facelets = readonly Sticker[];

/** Face order of the facelet array — not the order `FACES` uses in `moves.ts`. */
export const FACELET_FACES = ["U", "R", "F", "D", "L", "B"] as const;

export const FACE_SIZE = 3;
export const FACELETS_PER_FACE = FACE_SIZE * FACE_SIZE;
export const FACELET_COUNT = FACELET_FACES.length * FACELETS_PER_FACE;

type Vector = readonly [number, number, number];

/**
 * Where each face is, and which way its rows and columns run.
 *
 * Axes are the ones the 3D scene uses and `bridge.ts` documents: x right, y up,
 * z towards the viewer. `row` points the way the row index grows (downwards on
 * the screen of someone looking at that face) and `column` the way the column
 * index grows (rightwards for them). Everything else in this file follows from
 * these six lines, so they are the only place the layout is stated.
 */
const FACE_GEOMETRY: Readonly<Record<Face, { normal: Vector; row: Vector; column: Vector }>> =
  Object.freeze({
    U: { normal: [0, 1, 0], row: [0, 0, 1], column: [1, 0, 0] },
    R: { normal: [1, 0, 0], row: [0, -1, 0], column: [0, 0, -1] },
    F: { normal: [0, 0, 1], row: [0, -1, 0], column: [1, 0, 0] },
    D: { normal: [0, -1, 0], row: [0, 0, -1], column: [1, 0, 0] },
    L: { normal: [-1, 0, 0], row: [0, -1, 0], column: [0, 0, 1] },
    B: { normal: [0, 0, -1], row: [0, -1, 0], column: [-1, 0, 0] },
  });

/** Opposite faces: two of these colours never share a piece. */
const OPPOSITE: Readonly<Record<Face, Face>> = Object.freeze({
  U: "D",
  D: "U",
  L: "R",
  R: "L",
  F: "B",
  B: "F",
});

const dot = (a: Vector, b: Vector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The index of the square at `row`, `column` of `face`. */
export function faceletIndex(face: Face, row: number, column: number): number {
  return FACELET_FACES.indexOf(face) * FACELETS_PER_FACE + row * FACE_SIZE + column;
}

/** A piece name spelled out as the faces it touches: `URF` is U, R, F. */
const stickersOf = (name: string): readonly Face[] => [...name] as Face[];

/** Where a piece sits: the sum of the normals of the faces it touches. */
const piecePosition = (name: string): Vector => {
  const position: [number, number, number] = [0, 0, 0];
  for (const face of stickersOf(name)) {
    const { normal } = FACE_GEOMETRY[face];
    position[0] += normal[0];
    position[1] += normal[1];
    position[2] += normal[2];
  }
  return position;
};

/** The square of `face` covering the piece at `position`. */
const faceletAt = (face: Face, position: Vector): number => {
  const { normal, row, column } = FACE_GEOMETRY[face];
  const offset: Vector = [
    position[0] - normal[0],
    position[1] - normal[1],
    position[2] - normal[2],
  ];
  return faceletIndex(face, dot(offset, row) + 1, dot(offset, column) + 1);
};

/**
 * The squares of a piece, in the order its name spells them.
 *
 * For a corner that order is the U-or-D sticker first and then clockwise seen
 * from outside the corner, which is exactly the order the twist count in
 * `state.ts` is measured in.
 */
const faceletsOfPiece = (name: string): readonly number[] => {
  const position = piecePosition(name);
  return Object.freeze(stickersOf(name).map((face) => faceletAt(face, position)));
};

const CORNER_FACELETS: readonly (readonly number[])[] = Object.freeze(CORNERS.map(faceletsOfPiece));
const EDGE_FACELETS: readonly (readonly number[])[] = Object.freeze(EDGES.map(faceletsOfPiece));

const CORNER_COLOURS: readonly (readonly Face[])[] = Object.freeze(CORNERS.map(stickersOf));
const EDGE_COLOURS: readonly (readonly Face[])[] = Object.freeze(EDGES.map(stickersOf));

/** The centre square of each face; the screen fills these in and locks them. */
export const CENTRE_FACELETS: Readonly<Record<Face, number>> = Object.freeze(
  Object.fromEntries(
    FACELET_FACES.map((face) => [face, faceletAt(face, FACE_GEOMETRY[face].normal)])
  ) as Record<Face, number>
);

/** Edges are looked up by their pair of colours, in either order. */
const EDGE_BY_COLOURS: ReadonlyMap<string, number> = new Map(
  EDGE_COLOURS.map((colours, edge) => [[...colours].sort().join(""), edge])
);

/** Corners are looked up by their three colours, in the one order a cube uses. */
const CORNER_BY_COLOURS = CORNER_INDEX as Readonly<Record<string, number | undefined>>;

const isSticker = (value: unknown): value is Sticker =>
  typeof value === "string" && value in FACE_GEOMETRY;

/** The colouring a state shows: what a person would see holding that cube. */
export function stateToFacelets(state: CubeState): Facelets {
  const facelets = new Array<Sticker>(FACELET_COUNT);

  for (const face of FACELET_FACES) {
    facelets[CENTRE_FACELETS[face]] = face;
  }

  for (let slot = 0; slot < CORNER_COUNT; slot++) {
    const colours = CORNER_COLOURS[state.cornerPermutation[slot]];
    const twist = state.cornerOrientation[slot];
    CORNER_FACELETS[slot].forEach((facelet, position) => {
      // The U-or-D sticker sits `twist` steps clockwise from the U or D face.
      facelets[facelet] =
        colours[(position + CORNER_ORIENTATIONS - twist) % CORNER_ORIENTATIONS];
    });
  }

  for (let slot = 0; slot < EDGE_COUNT; slot++) {
    const colours = EDGE_COLOURS[state.edgePermutation[slot]];
    const flip = state.edgeOrientation[slot];
    EDGE_FACELETS[slot].forEach((facelet, position) => {
      facelets[facelet] = colours[(position + flip) % EDGE_ORIENTATIONS];
    });
  }

  return facelets;
}

/* ------------------------------------------------------------------ */
/* Wording                                                            */
/* ------------------------------------------------------------------ */

/*
  Проблемы читает человек с кубиком в руках, поэтому здесь нет ни слотов, ни
  перестановок: только цвета и «сверху справа спереди». Формы слов разложены по
  падежам руками — склонять в коде было бы дороже и хуже.
*/
const WORDS: Readonly<
  Record<Face, { many: string; feminine: string; masculine: string; face: string; where: string }>
> = Object.freeze({
  U: { many: "Белых", feminine: "белая", masculine: "белый", face: "верхней", where: "сверху" },
  D: { many: "Жёлтых", feminine: "жёлтая", masculine: "жёлтый", face: "нижней", where: "снизу" },
  R: { many: "Красных", feminine: "красная", masculine: "красный", face: "правой", where: "справа" },
  L: {
    many: "Оранжевых",
    feminine: "оранжевая",
    masculine: "оранжевый",
    face: "левой",
    where: "слева",
  },
  F: {
    many: "Зелёных",
    feminine: "зелёная",
    masculine: "зелёный",
    face: "передней",
    where: "спереди",
  },
  B: { many: "Синих", feminine: "синяя", masculine: "синий", face: "задней", where: "сзади" },
});

type PieceKind = "corner" | "edge";

const PIECE_WORDS: Readonly<
  Record<PieceKind, { on: string; nominative: string; appeared: string }>
> = Object.freeze({
  corner: { on: "уголке", nominative: "Уголок", appeared: "оказался" },
  edge: { on: "ребре", nominative: "Ребро", appeared: "оказалось" },
});

/** `URF` becomes «сверху справа спереди». */
const placeOf = (name: string): string =>
  stickersOf(name)
    .map((face) => WORDS[face].where)
    .join(" ");

/** «белый, красный и зелёный» */
const listColours = (colours: readonly Face[]): string => {
  const words = colours.map((face) => WORDS[face].masculine);
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} и ${words[words.length - 1]}`;
};

/* ------------------------------------------------------------------ */
/* Checking                                                           */
/* ------------------------------------------------------------------ */

export type FaceletProblemKind =
  /** Not 54 squares, or a colour that is not a colour. The screen prevents this. */
  | "wrongInput"
  /** Some colour appears more or fewer than nine times. */
  | "colourCount"
  /** A centre carries the wrong colour. */
  | "centre"
  /** Three or two colours that no piece of a cube carries. */
  | "impossiblePiece"
  /** The same piece entered twice. */
  | "duplicatePiece"
  /** A corner turned in place; no sequence of turns does that alone. */
  | "cornerTwist"
  /** An edge flipped in place; likewise. */
  | "edgeFlip"
  /** Two pieces exchanged; likewise. */
  | "swap";

export interface FaceletProblem {
  readonly kind: FaceletProblemKind;
  /** Plain Russian, for the person: what is wrong and what to look at. */
  readonly message: string;
  /** Squares worth checking, so the screen can point at them. May be empty. */
  readonly facelets: readonly number[];
}

export type FaceletCheck =
  | { ok: true; state: CubeState }
  | { ok: false; problems: readonly FaceletProblem[] };

interface Piece {
  readonly piece: number;
  readonly orientation: number;
}

/** Two colours of one piece that no piece can carry at once. */
const clashingColours = (
  colours: readonly Face[]
): { kind: "duplicate" | "opposite"; a: Face; b: Face } | null => {
  for (let i = 0; i < colours.length; i++) {
    for (let j = i + 1; j < colours.length; j++) {
      if (colours[i] === colours[j]) return { kind: "duplicate", a: colours[i], b: colours[j] };
      if (OPPOSITE[colours[i]] === colours[j]) {
        return { kind: "opposite", a: colours[i], b: colours[j] };
      }
    }
  }
  return null;
};

const clashProblem = (
  kind: PieceKind,
  slotName: string,
  facelets: readonly number[],
  clash: { kind: "duplicate" | "opposite"; a: Face; b: Face }
): FaceletProblem => ({
  kind: "impossiblePiece",
  facelets,
  message:
    clash.kind === "duplicate"
      ? `На ${PIECE_WORDS[kind].on} ${placeOf(slotName)} две наклейки одного цвета, а на одной детали кубика все цвета разные.`
      : `На ${PIECE_WORDS[kind].on} ${placeOf(slotName)} встретились ${WORDS[clash.a].masculine} и ${WORDS[clash.b].masculine}, а эти цвета стоят напротив друг друга и на одной детали быть не могут.`,
});

/** Which corner this is, and how far it is turned, or what is wrong with it. */
function readCorner(slot: number, colours: readonly Face[]): Piece | FaceletProblem {
  const facelets = CORNER_FACELETS[slot];
  const slotName = CORNERS[slot];

  const clash = clashingColours(colours);
  if (clash) return clashProblem("corner", slotName, facelets, clash);

  // Exactly one sticker is white or yellow now that the three axes are distinct.
  const twist = colours.findIndex((colour) => colour === "U" || colour === "D");
  const name = [0, 1, 2].map((step) => colours[(twist + step) % CORNER_ORIENTATIONS]).join("");
  const piece = CORNER_BY_COLOURS[name];

  if (piece === undefined) {
    // The colours exist together on a corner, but wound the other way round.
    const real = CORNERS.find(
      (candidate) => [...candidate].sort().join("") === [...name].sort().join("")
    ) as string;
    return {
      kind: "impossiblePiece",
      facelets,
      message: `На уголке ${placeOf(slotName)} цвета идут не в том порядке: у настоящего уголка по часовой стрелке они идут ${listColours(stickersOf(real))}. Похоже, две наклейки перепутаны местами.`,
    };
  }

  return { piece, orientation: twist };
}

/** Which edge this is, and whether it is the right way up. */
function readEdge(slot: number, colours: readonly Face[]): Piece | FaceletProblem {
  const facelets = EDGE_FACELETS[slot];
  const slotName = EDGES[slot];

  const clash = clashingColours(colours);
  if (clash) return clashProblem("edge", slotName, facelets, clash);

  // Every pair of non-opposite colours is an edge of the cube, so this is found.
  const piece = EDGE_BY_COLOURS.get([...colours].sort().join("")) as number;
  return { piece, orientation: colours[0] === EDGE_COLOURS[piece][0] ? 0 : 1 };
}

const isProblem = (value: Piece | FaceletProblem): value is FaceletProblem => "kind" in value;

/** Slots holding the same piece, as problems: a cube carries one of each. */
function duplicateProblems(
  kind: PieceKind,
  pieces: readonly Piece[],
  names: readonly string[],
  facelets: readonly (readonly number[])[],
  colours: readonly (readonly Face[])[]
): FaceletProblem[] {
  const slotsByPiece = new Map<number, number[]>();
  pieces.forEach(({ piece }, slot) => {
    slotsByPiece.set(piece, [...(slotsByPiece.get(piece) ?? []), slot]);
  });

  return [...slotsByPiece.entries()]
    .filter(([, slots]) => slots.length > 1)
    .map(([piece, slots]) => {
      const places = slots.map((slot) => placeOf(names[slot]));
      const howMany = slots.length === 2 ? "в двух местах" : "в нескольких местах";
      const listed =
        slots.length === 2 ? places.join(" и ") : `${places.slice(0, -1).join(", ")} и ${places[places.length - 1]}`;

      return {
        kind: "duplicatePiece" as const,
        facelets: slots.flatMap((slot) => [...facelets[slot]]),
        message: `${PIECE_WORDS[kind].nominative} с цветами ${listColours(colours[piece])} ${PIECE_WORDS[kind].appeared} сразу ${howMany}: ${listed}. В кубике такая деталь одна.`,
      };
    });
}

/** Odd or even: how many swaps of two pieces this arrangement is away from home. */
function permutationParity(permutation: readonly number[]): number {
  const visited = new Array<boolean>(permutation.length).fill(false);
  let parity = 0;

  for (let start = 0; start < permutation.length; start++) {
    if (visited[start]) continue;
    let length = 0;
    for (let slot = start; !visited[slot]; slot = permutation[slot]) {
      visited[slot] = true;
      length++;
    }
    parity ^= (length - 1) & 1;
  }

  return parity;
}

/**
 * The one slot whose piece is turned, when exactly one is; otherwise null.
 *
 * With a single culprit the message can point at it, which is most of the value
 * of the message. With several, the maths says the total is wrong and nothing
 * more — guessing which of them the person mistyped would be worse than silence.
 */
const lonePiece = (pieces: readonly Piece[]): number | null => {
  const turned = pieces.flatMap(({ orientation }, slot) => (orientation === 0 ? [] : [slot]));
  return turned.length === 1 ? turned[0] : null;
};

/**
 * Decides whether a colouring is a cube, and if it is, which one.
 *
 * Problems come in layers and the first layer that finds anything stops the
 * rest: a colouring with ten white stickers has pieces that mean nothing, and
 * reporting them alongside would bury the one mistake the person made under
 * consequences of it.
 */
export function checkFacelets(facelets: Facelets): FaceletCheck {
  if (facelets.length !== FACELET_COUNT) {
    return {
      ok: false,
      problems: [
        {
          kind: "wrongInput",
          facelets: [],
          message: "Раскраска заполнена не до конца: нужны все 54 наклейки.",
        },
      ],
    };
  }

  // The type says these are colours; a value off the wire may disagree.
  const strange = facelets.flatMap((sticker, index) => (isSticker(sticker) ? [] : [index]));
  if (strange.length > 0) {
    return {
      ok: false,
      problems: [
        {
          kind: "wrongInput",
          facelets: strange,
          message: "Среди наклеек есть цвет, которого на кубике нет.",
        },
      ],
    };
  }

  const counted: FaceletProblem[] = [];

  for (const face of FACELET_FACES) {
    const found = facelets.flatMap((sticker, index) => (sticker === face ? [index] : []));
    if (found.length !== FACELETS_PER_FACE) {
      counted.push({
        kind: "colourCount",
        facelets: found,
        message: `${WORDS[face].many} наклеек ${found.length}, а на кубике их девять — где-то цвет введён неверно.`,
      });
    }

    const centre = CENTRE_FACELETS[face];
    if (facelets[centre] !== face) {
      counted.push({
        kind: "centre",
        facelets: [centre],
        message: `В середине ${WORDS[face].face} грани стоит ${WORDS[facelets[centre]].feminine} наклейка, а должна быть ${WORDS[face].feminine}: центры не двигаются и задают цвет грани.`,
      });
    }
  }

  if (counted.length > 0) return { ok: false, problems: counted };

  const broken: FaceletProblem[] = [];
  const corners: Piece[] = [];
  const edges: Piece[] = [];

  for (let slot = 0; slot < CORNER_COUNT; slot++) {
    const read = readCorner(
      slot,
      CORNER_FACELETS[slot].map((facelet) => facelets[facelet])
    );
    if (isProblem(read)) broken.push(read);
    else corners.push(read);
  }

  for (let slot = 0; slot < EDGE_COUNT; slot++) {
    const read = readEdge(
      slot,
      EDGE_FACELETS[slot].map((facelet) => facelets[facelet])
    );
    if (isProblem(read)) broken.push(read);
    else edges.push(read);
  }

  if (broken.length > 0) return { ok: false, problems: broken };

  const duplicates = [
    ...duplicateProblems("corner", corners, CORNERS, CORNER_FACELETS, CORNER_COLOURS),
    ...duplicateProblems("edge", edges, EDGES, EDGE_FACELETS, EDGE_COLOURS),
  ];
  if (duplicates.length > 0) return { ok: false, problems: duplicates };

  const state: CubeState = {
    cornerPermutation: corners.map(({ piece }) => piece),
    cornerOrientation: corners.map(({ orientation }) => orientation),
    edgePermutation: edges.map(({ piece }) => piece),
    edgeOrientation: edges.map(({ orientation }) => orientation),
  };

  const impossible: FaceletProblem[] = [];

  const twists = state.cornerOrientation.reduce((sum, twist) => sum + twist, 0);
  if (twists % CORNER_ORIENTATIONS !== 0) {
    const lone = lonePiece(corners);
    impossible.push({
      kind: "cornerTwist",
      facelets: lone === null ? [] : CORNER_FACELETS[lone],
      message:
        "Один из уголков повёрнут вокруг себя: собрать такой кубик, не разбирая его, нельзя." +
        (lone === null
          ? " Проверьте уголки: где-то три наклейки на одной детали сдвинуты по кругу."
          : ` Проверьте уголок ${placeOf(CORNERS[lone])} — похоже, три его наклейки сдвинуты по кругу.`),
    });
  }

  const flips = state.edgeOrientation.reduce((sum, flip) => sum + flip, 0);
  if (flips % EDGE_ORIENTATIONS !== 0) {
    const lone = lonePiece(edges);
    impossible.push({
      kind: "edgeFlip",
      facelets: lone === null ? [] : EDGE_FACELETS[lone],
      message:
        "Одно из рёбер перевёрнуто: собрать такой кубик, не разбирая его, нельзя." +
        (lone === null
          ? " Проверьте рёбра: где-то две наклейки на одной детали поменяны местами."
          : ` Проверьте ребро ${placeOf(EDGES[lone])} — похоже, две его наклейки поменяны местами.`),
    });
  }

  if (
    permutationParity(state.cornerPermutation) !== permutationParity(state.edgePermutation)
  ) {
    impossible.push({
      kind: "swap",
      facelets: [],
      message:
        "Похоже, две детали поменялись местами. Поворотами граней такого не получается: если кубик не разбирали, значит где-то в раскраске ошибка — проверьте, не перепутаны ли местами два уголка или два ребра.",
    });
  }

  if (impossible.length > 0) return { ok: false, problems: impossible };

  return { ok: true, state };
}
