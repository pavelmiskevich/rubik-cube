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

Прод — https://rubik-cube.miskevich.ru/ на общем VPS, где живут и другие проекты. Отсюда главное правило выкладки: ничем не задеть соседей ([#87](https://github.com/pavelmiskevich/rubik-cube/issues/87)).

**Как идёт выкладка.** На каждый пуш в `main` workflow `Deploy`:

1. `verify` — линт, типы, юнит- и E2E-тесты, сборка.
2. `publish` — собирает два образа и публикует в реестр контейнеров GitHub: `ghcr.io/pavelmiskevich/rubik-cube:<SHA>` (приложение) и `:migrate-<SHA>` (стадия `builder` с CLI Prisma — для миграций). Собирается в CI, а не на сервере: `next build` берёт 1,5–2 ГБ памяти.
3. `deploy` — ждёт подтверждения владельца (обязательный ревьюер окружения `production`), затем заходит по SSH и отдаёт одну команду `deploy <SHA>`.

Выключатель — переменная репозитория `DEPLOY_ENABLED`: без неё идёт только `verify`. Повторить выкладку — `Run workflow` у workflow `Deploy` на ветке `main`.

**Что на сервере** (эталоны — в [`deploy/`](deploy/)):

| Где | Что | Владелец |
|---|---|---|
| `/opt/rubik-cube/docker-compose.yml` | копия `deploy/docker-compose.prod.yml` | root, 644 |
| `/opt/rubik-cube/.env` | секреты: `AUTH_SECRET`, `AUTH_URL`, `POSTGRES_*`, `DATABASE_URL` | root, 600 |
| `/opt/rubik-cube/image.env` | `IMAGE_TAG` — единственное, что меняет выкладка | root |
| `/usr/local/bin/rubik-cube-deploy` | скрипт выкладки | root, 755 |
| `/usr/local/bin/rubik-cube-deploy-ssh` | принудительная команда SSH-ключа | root, 755 |
| `/etc/sudoers.d/rubik-cube-deploy` | `sudo` только на скрипт выкладки | root, 440 |
| `/etc/caddy/Caddyfile` | блок сайта из `deploy/Caddyfile.site` | root |

- **Пользователь `rubik-deploy`** — без пароля, без `sudo` (кроме скрипта выкладки) и без группы `docker`: она равносильна root и открыла бы чужие контейнеры. Его ключ в `authorized_keys` записан с `command="/usr/local/bin/rubik-cube-deploy-ssh",restrict` — принимается только `deploy <SHA>`, ни шелла, ни пробросов.
- **Compose-файл и `.env` из репозитория не подтягиваются.** Выкладка меняет только тег образа, поэтому изменение в репозитории не может само примонтировать в контейнер файловую систему хоста или открыть порт. Правку `deploy/docker-compose.prod.yml` или скриптов на сервер переносит администратор: скопировать файл, проверить (`docker compose config`, `bash -n`, `visudo -c -f`), затем выложить текущий SHA.
- **Изоляция:** проект `rubik-cube` со своей сетью и томом `rubik-cube_pgdata`; приложение слушает только `127.0.0.1:3030`, база не публикуется; у контейнеров потолок памяти (512 МБ приложение и миграции, 384 МБ база) и ротация логов. Скрипт чистит только образы этого проекта.
- **Веб-сервер общий.** Правка `Caddyfile`: резервная копия `Caddyfile.bak-<дата>`, правка, `caddy validate --config /etc/caddy/Caddyfile`, затем `systemctl reload caddy`.

**Откат.** Скрипт хранит текущий и предыдущий образы. При сбое он печатает логи и предыдущий тег. Откатить — от администратора `sudo /usr/local/bin/rubik-cube-deploy <предыдущий SHA>` или `Run workflow` на нужном коммите. Миграции только вперёд: откат приложения не откатывает схему, поэтому миграции должны оставаться совместимыми с предыдущей версией.

**Секреты окружения `production`:** `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS` (строка `known_hosts` сервера — ключ хоста закреплён).

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
