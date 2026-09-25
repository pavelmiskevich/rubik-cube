# Деплой

Прод — https://rubik-cube.miskevich.ru/ на общем VPS, где живут и другие проекты. Отсюда главное правило выкладки: ничем не задеть соседей ([#87](https://github.com/pavelmiskevich/rubik-cube/issues/87)).

**Как идёт выкладка.** На каждый пуш в `main` workflow `Deploy`:

1. `verify` — линт, типы, юнит- и E2E-тесты, сборка.
2. `publish` — собирает два образа и публикует в реестр контейнеров GitHub: `ghcr.io/pavelmiskevich/rubik-cube:<SHA>` (приложение) и `:migrate-<SHA>` (стадия `builder` с CLI Prisma — для миграций). Собирается в CI, а не на сервере: `next build` берёт 1,5–2 ГБ памяти.
3. `deploy` — ждёт подтверждения владельца (обязательный ревьюер окружения `production`), затем заходит по SSH и отдаёт одну команду `deploy <SHA>`.

Пуш только из документации — `*.md`, `docs/`, `LICENSE` — workflow не запускает (`paths-ignore`): приложение этих файлов не читает, а выкладка всё равно ждала бы подтверждения. Если рядом есть хоть один файл кода, выкладка идёт как обычно.

Выключатель — переменная репозитория `DEPLOY_ENABLED`: без неё идёт только `verify`. Повторить выкладку — `Run workflow` у workflow `Deploy` на ветке `main`.

**Что на сервере** (эталоны — в этом каталоге):

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
