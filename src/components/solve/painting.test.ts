import { CENTRE_FACELETS, FACELET_COUNT, checkFacelets, stateToFacelets } from "@/lib/cube/facelets";
import { SOLVED_CUBE } from "@/lib/cube/state";
import {
  countOf,
  emptyPainting,
  finishedPainting,
  isCentre,
  paintSticker,
  remaining,
  solvedPainting,
} from "./painting";

describe("emptyPainting", () => {
  it("состоит из 54 наклеек, из которых заполнены только центры", () => {
    const painting = emptyPainting();

    expect(painting).toHaveLength(FACELET_COUNT);
    expect(painting.filter((sticker) => sticker !== null)).toHaveLength(6);
  });

  it("ставит в центры цвета их граней", () => {
    const painting = emptyPainting();

    expect(painting[CENTRE_FACELETS.U]).toBe("U");
    expect(painting[CENTRE_FACELETS.F]).toBe("F");
    expect(painting[CENTRE_FACELETS.D]).toBe("D");
  });
});

describe("paintSticker", () => {
  it("красит наклейку, не трогая исходную раскраску", () => {
    const before = emptyPainting();
    const after = paintSticker(before, 0, "R");

    expect(after[0]).toBe("R");
    expect(before[0]).toBeNull();
  });

  it("стирает наклейку", () => {
    const painted = paintSticker(emptyPainting(), 0, "R");

    expect(paintSticker(painted, 0, null)[0]).toBeNull();
  });

  it("не даёт перекрасить центр: центры не двигаются и задают цвет грани", () => {
    const painting = emptyPainting();

    expect(paintSticker(painting, CENTRE_FACELETS.U, "R")).toBe(painting);
    expect(paintSticker(painting, CENTRE_FACELETS.U, null)).toBe(painting);
    expect(isCentre(CENTRE_FACELETS.U)).toBe(true);
    expect(isCentre(0)).toBe(false);
  });
});

describe("счёт наклеек", () => {
  it("считает цвет вместе с центром", () => {
    expect(countOf(emptyPainting(), "R")).toBe(1);
    expect(countOf(paintSticker(emptyPainting(), 0, "R"), "R")).toBe(2);
  });

  it("считает, сколько наклеек осталось назвать", () => {
    expect(remaining(emptyPainting())).toBe(48);
    expect(remaining(paintSticker(emptyPainting(), 0, "R"))).toBe(47);
    expect(remaining(solvedPainting())).toBe(0);
  });
});

describe("finishedPainting", () => {
  it("молчит, пока хоть одна наклейка не названа", () => {
    expect(finishedPainting(emptyPainting())).toBeNull();
    expect(finishedPainting(paintSticker(solvedPainting(), 0, null))).toBeNull();
  });

  it("отдаёт заполненную раскраску", () => {
    const facelets = finishedPainting(solvedPainting());

    expect(facelets).toEqual([...stateToFacelets(SOLVED_CUBE)]);
  });
});

describe("solvedPainting", () => {
  it("проходит проверку собираемости", () => {
    const facelets = finishedPainting(solvedPainting());

    expect(facelets).not.toBeNull();
    expect(checkFacelets(facelets ?? []).ok).toBe(true);
  });
});
