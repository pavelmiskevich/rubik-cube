import { readFileSync } from "node:fs";
import path from "node:path";
import { contrastRatio } from "./contrast";

const css = readFileSync(
  path.join(__dirname, "..", "app", "globals.css"),
  "utf8"
);

/** Токены одного блока globals.css, вида `--имя: значение;`. */
function tokensOf(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(escaped + "\\s*\\{([^}]*)\\}").exec(css);
  if (!block) {
    throw new Error("Блок " + selector + " не найден в globals.css");
  }
  const tokens: Record<string, string> = {};
  for (const match of block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const COLOR_TOKENS = [
  "bg",
  "surface",
  "surface-2",
  "border",
  "text",
  "muted",
  "accent",
  "accent-text",
  "success",
  "danger",
];

const dark = tokensOf(":root");
const light = tokensOf('[data-theme="light"]');

/** Порог WCAG AA для основного текста. */
const AA = 4.5;

describe("палитра оформления", () => {
  it.each([
    ["тёмная", dark],
    ["светлая", light],
  ])("%s тема объявляет полный набор токенов", (_name, tokens) => {
    const declared = COLOR_TOKENS.filter((token) => token in tokens);
    expect(declared).toEqual(COLOR_TOKENS);
  });

  it.each([
    ["тёмная", dark],
    ["светлая", light],
  ])("%s тема проходит WCAG AA", (_name, t) => {
    expect(contrastRatio(t.text, t.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.text, t.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.muted, t.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.muted, t.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t["accent-text"], t.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.success, t.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(t.danger, t.bg)).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ["тёмная", dark],
    ["светлая", light],
  ])("%s тема: белый текст читается на заливке акцента", (_name, t) => {
    expect(contrastRatio("#FFFFFF", t.accent)).toBeGreaterThanOrEqual(AA);
  });
});
