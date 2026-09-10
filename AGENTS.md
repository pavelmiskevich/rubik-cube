<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Rubik's Cube Learning Platform — правила для агентов

Блок выше перезаписывает `next dev`, но только между маркерами — всё, что ниже, сохраняется.

## Начни с этого

1. [`STATE.md`](STATE.md) — что сделано, что открыто, грабли окружения.
2. [`docs/superpowers/specs/`](docs/superpowers/specs/) — согласованные проектные решения.
3. [`TECHDEBT.md`](TECHDEBT.md) — принятые решения и отложенный долг.

## Процесс

- Вся работа — через GitHub-ишью. Метки: раздел (`фронтенд`, `бэкенд`, `дизайн`, `3d`, `логика`, `аналитика`, `auth`, `qa`, `devops`), `размер: S-M | M | L`, `приоритет: высокий | средний | низкий`. Крупное — эпиком с меткой `эпик`.
- Ветка `feature/issue-N-кратко`, PR в `main`. Обязательные проверки: `audit`, `build`.
- Вливать merge-коммитом (`gh pr merge N --merge`), не squash.
- Ишью, PR и документация — на русском.
- В публичных артефактах — ишью, PR, спеках, коммитах — не называть сторонние продукты по имени.
- Не начинать следующую задачу без явного подтверждения владельца репозитория.

## Не переписывать без причины

Закреплено тестами и разобрано по дефектам, подробности в `STATE.md`:

- `src/components/cube/dragRotation.ts` и обработчики указателя в `RubiksCube.tsx`
- `src/lib/statistics.ts` — правила WCA
- машина состояний `src/components/timer/SmartTimer.tsx`

Не возвращать `--if-present` в пайплайны: из-за него юнит-тесты долго не запускались вовсе.
