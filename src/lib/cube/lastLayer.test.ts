import { applyNotation } from "./moves";
import { SOLVED_CUBE } from "./state";
import {
  LAST_LAYER_SIDES,
  bars,
  cornersUp,
  edgesUp,
  headlights,
  lastLayerView,
} from "./lastLayer";

describe("lastLayerView", () => {
  it("на собранном кубе верх белый, а каждая сторона — своего цвета", () => {
    const view = lastLayerView(SOLVED_CUBE);

    expect(view.top.flat()).toEqual(new Array(9).fill("U"));
    LAST_LAYER_SIDES.forEach((side) => expect(view.sides[side]).toEqual([side, side, side]));
  });

  it("после U на передней стороне оказывается верхний ряд правой", () => {
    // U по часовой, если смотреть сверху: правая сторона уезжает вперёд.
    const view = lastLayerView(applyNotation("U"));

    expect(view.sides.F).toEqual(["R", "R", "R"]);
    expect(view.sides.R).toEqual(["B", "B", "B"]);
    expect(view.sides.B).toEqual(["L", "L", "L"]);
    expect(view.sides.L).toEqual(["F", "F", "F"]);
  });

  it("F поднимает на передний ряд верха цвет левой стороны, а передняя остаётся своей", () => {
    // F крутит саму переднюю грань: её наклейки не уходят с неё, меняется то,
    // что смотрит вверх над ней.
    const view = lastLayerView(applyNotation("F"));

    expect(view.sides.F).toEqual(["F", "F", "F"]);
    expect(view.top[2]).toEqual(["L", "L", "L"]);
  });

  it("читает ряд стороны слева направо, как его видит стоящий к ней лицом", () => {
    // R поднимает на правую сторону верхнего ряда низ: у передней стороны это
    // правая наклейка, у задней — левая.
    const view = lastLayerView(applyNotation("R"));

    expect(view.sides.F).toEqual(["F", "F", "D"]);
    expect(view.sides.B).toEqual(["U", "B", "B"]);
  });

  it("верх рисует сверху: первая строка — задняя, последняя — передняя", () => {
    // R поднимает переднюю грань на правый столбец верха.
    const view = lastLayerView(applyNotation("R"));

    expect(view.top.map((row) => row[2])).toEqual(["F", "F", "F"]);
    expect(view.top.map((row) => row[0])).toEqual(["U", "U", "U"]);
  });
});

describe("узор верха", () => {
  it("на собранном кубе вверх смотрят все четыре ребра и все четыре угла", () => {
    expect(edgesUp(SOLVED_CUBE)).toEqual(["F", "R", "B", "L"]);
    expect(cornersUp(SOLVED_CUBE)).toEqual(["URF", "UFL", "ULB", "UBR"]);
  });

  it("F R U R' U' F' из собранного оставляет вверху линию из двух рёбер", () => {
    const state = applyNotation("F R U R' U' F'");

    expect(edgesUp(state)).toHaveLength(2);
  });

  it("рыбка: после R U R' U R U2 R' вверх смотрит один угол", () => {
    expect(cornersUp(applyNotation("R U R' U R U2 R'"))).toHaveLength(1);
  });
});

describe("фары и полоски", () => {
  it("на собранном кубе фары и полоски на всех четырёх сторонах", () => {
    const view = lastLayerView(SOLVED_CUBE);

    expect(headlights(view)).toEqual(["F", "R", "B", "L"]);
    expect(bars(view)).toEqual(["F", "R", "B", "L"]);
  });

  it("три ребра по кругу: фары везде, полоска одна", () => {
    const view = lastLayerView(applyNotation("R U' R U R U R U' R' U' R2"));

    expect(headlights(view)).toHaveLength(4);
    expect(bars(view)).toHaveLength(1);
  });

  it("два угла по диагонали: фар нет ни на одной стороне", () => {
    const view = lastLayerView(applyNotation("F R U' R' U' R U R' F' R U R' U' R' F R F'"));

    expect(headlights(view)).toEqual([]);
  });
});
