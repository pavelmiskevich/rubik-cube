import type { Rgb } from "./recognition";
import { PixelImage, guideSquare, robustColour, sampleFace } from "./sampling";

/** Картинка RGBA, раскрашенная функцией от координат пикселя. */
function paint(size: number, colourAt: (x: number, y: number) => Rgb): PixelImage {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = colourAt(x, y);
      const offset = (y * size + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

const COLOURS: readonly Rgb[] = [
  [228, 230, 226],
  [238, 212, 38],
  [24, 158, 84],
  [22, 78, 180],
  [190, 28, 38],
  [245, 112, 28],
  [200, 30, 40],
  [30, 150, 90],
  [240, 220, 50],
];

/** Грань 3×3 с чёрными щелями между наклейками, как у настоящего кубика. */
function face(size: number, shift = 0): PixelImage {
  const cell = size / 3;
  const gap = cell * 0.08;
  return paint(size, (x, y) => {
    const sx = x - shift * cell;
    const sy = y - shift * cell;
    const column = Math.floor(sx / cell);
    const row = Math.floor(sy / cell);
    const inX = sx - column * cell;
    const inY = sy - row * cell;
    if (column < 0 || column > 2 || row < 0 || row > 2) return [12, 12, 14];
    if (inX < gap || inX > cell - gap || inY < gap || inY > cell - gap) return [12, 12, 14];
    return COLOURS[row * 3 + column];
  });
}

describe("guideSquare", () => {
  it("в широком кадре берёт середину: видео обрезано по бокам", () => {
    expect(guideSquare(1280, 720, 0.7)).toEqual({ x: 388, y: 108, size: 504 });
  });

  it("в высоком кадре — тоже середину: видео обрезано сверху и снизу", () => {
    expect(guideSquare(720, 1280, 0.7)).toEqual({ x: 108, y: 388, size: 504 });
  });

  it("в квадратном кадре сетка стоит по центру", () => {
    expect(guideSquare(600, 600, 0.5)).toEqual({ x: 150, y: 150, size: 300 });
  });
});

describe("sampleFace", () => {
  it("берёт девять цветов строками, сверху вниз и слева направо", () => {
    expect(sampleFace(face(150))).toEqual(COLOURS);
  });

  it("не цепляет чёрные щели, даже если сетка чуть сбита", () => {
    expect(sampleFace(face(150, 0.12))).toEqual(COLOURS);
  });

  it("не принимает блик за белую наклейку", () => {
    const glare = face(150);
    const data = glare.data as Uint8ClampedArray;
    // Блик в верхней левой части средней клетки — треть её середины.
    for (let y = 62; y < 75; y++) {
      for (let x = 62; x < 72; x++) {
        data.set([255, 255, 255], (y * 150 + x) * 4);
      }
    }

    expect(sampleFace(glare)[4]).toEqual(COLOURS[4]);
  });
});

describe("robustColour", () => {
  it("берёт медиану по каждому каналу", () => {
    expect(
      robustColour([
        [10, 200, 30],
        [12, 190, 35],
        [200, 10, 250],
        [11, 195, 32],
        [13, 205, 31],
      ])
    ).toEqual([12, 195, 32]);
  });

  it("выбрасывает пересвеченные пиксели, если их меньшинство", () => {
    expect(
      robustColour([
        [255, 255, 255],
        [255, 254, 252],
        [190, 28, 38],
        [192, 30, 36],
        [188, 26, 40],
      ])
    ).toEqual([190, 28, 38]);
  });

  it("а если пересвечено почти всё — это и есть белая наклейка", () => {
    expect(
      robustColour([
        [255, 255, 255],
        [253, 255, 254],
        [255, 252, 255],
        [230, 232, 229],
      ])
    ).toEqual([255, 255, 255]);
  });
});
