import { BRUSHES, BRUSH_KEYS, STICKER_FILL, STICKER_NAME, stickerCount } from "./palette";

describe("палитра", () => {
  it("знает все шесть цветов и зовёт их по-русски", () => {
    expect(BRUSHES).toHaveLength(6);
    expect(new Set(BRUSHES).size).toBe(6);
    expect(BRUSHES.every((sticker) => STICKER_NAME[sticker].length > 0)).toBe(true);
  });

  it("красит наклейки теми же цветами, что и 3D-куб", () => {
    // Значения сведены с cubeTheme: белый верх, жёлтый низ, зелёный фронт.
    expect(STICKER_FILL.U).toBe("#F2F3F5");
    expect(STICKER_FILL.D).toBe("#F5C518");
    expect(STICKER_FILL.F).toBe("#1FA85C");
    expect(STICKER_FILL.B).toBe("#1F5FD0");
    expect(STICKER_FILL.R).toBe("#C41E1E");
    expect(STICKER_FILL.L).toBe("#F26B1D");
  });

  it("ставит цвета на цифры 1–6 в порядке палитры", () => {
    expect(BRUSH_KEYS["1"]).toBe(BRUSHES[0]);
    expect(BRUSH_KEYS["6"]).toBe(BRUSHES[5]);
    expect(BRUSH_KEYS["7"]).toBeUndefined();
  });
});

describe("stickerCount", () => {
  it("склоняет наклейки по-русски", () => {
    expect(stickerCount(1)).toBe("1 наклейку");
    expect(stickerCount(2)).toBe("2 наклейки");
    expect(stickerCount(4)).toBe("4 наклейки");
    expect(stickerCount(5)).toBe("5 наклеек");
    expect(stickerCount(11)).toBe("11 наклеек");
    expect(stickerCount(14)).toBe("14 наклеек");
    expect(stickerCount(21)).toBe("21 наклейку");
    expect(stickerCount(22)).toBe("22 наклейки");
    expect(stickerCount(48)).toBe("48 наклеек");
  });
});
