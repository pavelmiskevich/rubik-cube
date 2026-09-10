# Rubik's Cube Learning Platform

Интерактивная платформа для обучения скоростной сборке кубика Рубика: 3D-тренажёр, скрамблы по правилам WCA, таймер и статистика прогресса Ao5 / Ao12.

> **Статус.** Функциональный MVP готов и влит в `main`. Идёт редизайн оформления — эпик [#17](https://github.com/pavelmiskevich/rubik-cube/issues/17), проектное решение: [`docs/superpowers/specs/2026-09-10-redesign-design.md`](docs/superpowers/specs/2026-09-10-redesign-design.md).

## Возможности

| Страница | Что умеет |
|---|---|
| `/` | Генератор скрамблов по правилам WCA |
| `/timer` | Таймер: удержание пробела или экрана, старт по отпусканию, остановка любой клавишей. Показывает скрамбл и сохраняет сборку вместе с ним — для вошедших пользователей |
| `/trainer` | 3D-куб: поворот слоёв свайпом по грани, вращение камеры драгом мимо куба |
| `/stats` | Ao5 / Ao12 по регламенту WCA: отбрасывание лучшего и худшего, штраф +2, DNF, округление до 0.01 с. Пока на демо-данных — [#21](https://github.com/pavelmiskevich/rubik-cube/issues/21) |
| `/register`, `/login`, `/profile` | Регистрация по email и паролю, вход через Google |

## Стек

- **Next.js 16** (App Router), React 19, TypeScript, Tailwind CSS
- **three.js** через `@react-three/fiber` и `@react-three/drei`
- **Prisma 7** + PostgreSQL, первичные ключи UUIDv7, драйвер `@prisma/adapter-pg`
- **Auth.js v5** (`next-auth`): email/пароль (bcrypt с cost 12, ограничение частоты попыток) и Google OAuth
- **Jest** — юнит-тесты, **Cypress** — E2E
- **Docker Compose** + Caddy, **GitHub Actions**

## Быстрый старт в Docker

1. Скопируйте `.env.example` в `.env` и заполните:
   - `AUTH_SECRET` — сгенерируйте: `openssl rand -base64 32`
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — обязательны, по ним инициализируется база
   - `DATABASE_URL` — **с хостом `db`**, а не `localhost`: внутри compose-сети база доступна по имени сервиса
2. Поднимите стек:
   ```bash
   docker compose up -d --build
   ```
3. Откройте http://localhost:3030 (порт меняется через `HOST_PORT`).

Миграции Prisma при каждом старте применяет отдельный сервис `migrate`.

## Локальная разработка

1. Поднимите только базу — с пробросом порта на `127.0.0.1:5432`:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
   ```
2. В `.env` укажите `DATABASE_URL` с хостом `127.0.0.1`.
3. Установите зависимости и примените миграции:
   ```bash
   npm install
   npx prisma migrate dev
   ```
4. Запустите `npm run dev` → http://localhost:3000

Скрамблер, таймер, 3D-тренажёр и статистика работают и без базы. Без неё не работают только вход и сохранение сборок.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `AUTH_SECRET` | Ключ подписи сессий |
| `AUTH_URL` | Базовый URL приложения. **Обязательна за прокси:** без неё Auth.js не доверяет заголовку `Host`, и все маршруты `/api/auth/*` отвечают ошибкой |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth |
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Инициализация базы в Docker |
| `HOST_PORT` | Внешний порт Caddy, по умолчанию `3030` |

Имена — из Auth.js v5. Старые `NEXTAUTH_*` и `GOOGLE_CLIENT_*` больше не читаются.

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер |
| `npm run build`, `npm start` | Production-сборка и запуск |
| `npm run lint` | ESLint |
| `npm test` | Юнит-тесты Jest: 47 тестов — скрамблер, статистика, жесты 3D-куба |
| `npm run test:e2e` | Cypress поверх dev-сервера, база не нужна |

## Проверки качества

**Локально**, в git-хуках:

- `pre-commit` — gitleaks по staged-изменениям, ESLint и проверка типов
- `pre-push` — gitleaks по всей истории репозитория

Gitleaks запускается в Docker: без запущенного Docker не пройдут ни коммит, ни пуш.

**В CI**, на каждом PR в `main` — две обязательные проверки, без них мерж заблокирован:

- `audit` — `audit-ci --high`; исключения перечислены и обоснованы в [TECHDEBT.md](TECHDEBT.md)
- `build` — линт, типы, юнит-тесты, сборка и smoke-тест всего Docker-стека

## Деплой

На каждый пуш в `main` workflow `Deploy` проверяет проект — линт, типы, юнит- и E2E-тесты, сборку — и выкладывает его на сервер по SSH.

**Выкладка сейчас выключена**, потому что сервера ещё нет ([#26](https://github.com/pavelmiskevich/rubik-cube/issues/26)). Проверка при этом гоняется на каждом пуше. Чтобы включить:

1. На сервере: клон репозитория в `/opt/rubik-cube` с заполненным `.env`.
2. В окружении `production` завести секреты `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`.
3. **Добавить обязательного ревьюера на окружение `production`.** Без этого любой пуш в `main` уйдёт на сервер без подтверждения.
4. Завести **переменную репозитория** `DEPLOY_ENABLED=true`. Именно репозитория, а не окружения: условие запуска job'а вычисляется раньше, чем применяется окружение.

## Как ведётся разработка

Открыто, через [GitHub Issues](https://github.com/pavelmiskevich/rubik-cube/issues): у каждой задачи метки раздела, размера и приоритета, крупные разбиты на эпики. Ветка `feature/issue-N-кратко` → PR в `main` → merge-коммит.

## Структура

```
src/
  app/          маршруты App Router
  actions/      server actions: авторизация, сохранение сборок
  components/
    cube/       3D-куб и чистая логика жестов
    timer/      таймер, скрамблер, рабочая область
    dashboard/  статистика
  lib/          скрамблер, расчёт средних, форматирование, Prisma, rate limit
prisma/         схема и миграции
cypress/        E2E-сценарии
docs/           проектные решения
```

## Документация

- [STATE.md](STATE.md) — текущее состояние проекта и открытые задачи
- [TECHDEBT.md](TECHDEBT.md) — принятые решения и отложенный долг
- [docs/superpowers/specs/](docs/superpowers/specs/) — согласованные проектные решения
- [ideas/20260821_TZ.md](ideas/20260821_TZ.md) — исходное техническое задание

## Лицензия

См. [LICENSE](LICENSE).
