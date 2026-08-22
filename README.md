# Rubik's Cube Learning Platform

Платформа для обучения сборке кубика Рубика. Включает WCA-скрамблер, таймер со статистикой (Ao5, Ao12) и 3D-тренажер.

## Технологии
- **Next.js 14** (App Router, TypeScript, Tailwind CSS)
- **Prisma 7** + PostgreSQL (включая UUIDv7)
- **Docker Compose** + Caddy (локальный прокси)

## Запуск (Docker)

1. Скопируйте `.env.example` в `.env` и укажите секреты (генерируйте `NEXTAUTH_SECRET` через `openssl rand -base64 32`).
2. Выполните:
   ```bash
   docker compose up -d --build
   ```
3. Приложение будет доступно по адресу `http://localhost:3030` (порт можно изменить через `HOST_PORT` в `.env`).
4. База данных поднимется автоматически, при старте выполнится сервис `migrate` (применит миграции Prisma).

## Запуск (Локально)

1. Поднимите только БД (с предварительным пробросом порта, если нужно): `docker compose up -d db`.
2. Установите зависимости: `npm install`.
3. Примените миграции: `npx prisma migrate dev`.
4. Запустите Next.js: `npm run dev`.

## Переменные окружения (.env)
- `DATABASE_URL` — строка подключения к PostgreSQL.
- `NEXTAUTH_URL` — базовый URL приложения (например, `http://localhost:3030`).
- `NEXTAUTH_SECRET` — ключ шифрования сессий.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — ключи для авторизации.
- `HOST_PORT` — внешний порт Caddy.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — данные для инициализации БД.
