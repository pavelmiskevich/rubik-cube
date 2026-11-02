# Деплой

Прод — https://rubik-cube.miskevich.ru/ на общем VPS, где живут и другие проекты. Отсюда главное правило выкладки: ничем не задеть соседей ([#87](https://github.com/pavelmiskevich/rubik-cube/issues/87)).

**Как идёт выкладка.** Выкладывается опубликованный релиз GitHub ([#106](https://github.com/pavelmiskevich/rubik-cube/issues/106)); вливание в `main` само ничего не выкладывает — его проверяет `ci.yml`. Выпустить версию:

```bash
gh release create v1.2.0 --target main --generate-notes
```

Тег — строго `vX.Y.Z` и на коммите из первой линии истории `main` (merge-коммите или прямом коммите в `main`); заметки релиза собираются из влитых PR. Workflow `Deploy`:

1. `release` — проверяет тег и находит его коммит. Тег не того вида, коммит из ветки PR или с ветки не на первой линии `main` — отказ. Пре-релиз не выкладывается вовсе.
2. `verify` — линт, типы, юнит- и E2E-тесты, сборка — на коммите тега.
3. `publish` — собирает два образа и публикует в реестр контейнеров GitHub: `ghcr.io/pavelmiskevich/rubik-cube:<SHA>` и `:<тег>` (приложение) и `:migrate-<SHA>` (стадия `builder` с CLI Prisma — для миграций). Собирается в CI, а не на сервере: `next build` берёт 1,5–2 ГБ памяти.
4. `deploy` — ждёт подтверждения владельца (обязательный ревьюер окружения `production`), затем заходит по SSH и отдаёт одну команду `deploy <SHA>`. Окружение пускает только ветку `main` и теги `v*`.

**Повтор и откат** — `Run workflow` у workflow `Deploy` на ветке `main` с тегом нужной версии (`gh workflow run Deploy --ref main -f tag=v1.1.0`). Запуск с другой ветки отказывается. Проверки и сборка образов проходят заново — это минут десять до подтверждения; для срочного отката быстрее скрипт на сервере (ниже).

Выключатель — переменная репозитория `DEPLOY_ENABLED`: без неё идут только `release` и `verify`.

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
| `/usr/local/bin/rubik-cube-backup` | резервная копия базы — раздел ниже | root, 755 |
| `/usr/local/bin/rubik-cube-backup-ssh` | принудительная команда ключа забора копий | root, 755 |
| `/etc/systemd/system/rubik-cube-backup.{service,timer}` | копия каждую ночь в 02:30 UTC | root, 644 |
| `/opt/rubik-cube/backup-recipients.txt` | открытый ключ age владельца — чем шифровать копию | root, 644 |
| `/var/backups/rubik-cube/` | 14 последних дампов, не зашифрованы | root, 700 |
| `/var/lib/rubik-cube-backup/` | последняя копия, зашифрованная, на забор | root:rubik-backup, 750 |

- **Пользователь `rubik-deploy`** — без пароля, без `sudo` (кроме скрипта выкладки) и без группы `docker`: она равносильна root и открыла бы чужие контейнеры. Его ключ в `authorized_keys` записан с `command="/usr/local/bin/rubik-cube-deploy-ssh",restrict` — принимается только `deploy <SHA>`, ни шелла, ни пробросов.
- **Compose-файл и `.env` из репозитория не подтягиваются.** Выкладка меняет только тег образа, поэтому изменение в репозитории не может само примонтировать в контейнер файловую систему хоста или открыть порт. Правку `deploy/docker-compose.prod.yml` или скриптов на сервер переносит администратор: скопировать файл, проверить (`docker compose config`, `bash -n`, `visudo -c -f`), затем выложить текущий SHA.
- **Изоляция:** проект `rubik-cube` со своей сетью и томом `rubik-cube_pgdata`; приложение слушает только `127.0.0.1:3030`, база не публикуется; у контейнеров потолок памяти (512 МБ приложение и миграции, 384 МБ база) и ротация логов. Скрипт чистит только образы этого проекта.
- **Веб-сервер общий.** Правка `Caddyfile`: резервная копия `Caddyfile.bak-<дата>`, правка, `caddy validate --config /etc/caddy/Caddyfile`, затем `systemctl reload caddy`.

**Откат.** Скрипт хранит текущий и предыдущий образы. При сбое он печатает логи и предыдущий тег. Откатить — от администратора `sudo /usr/local/bin/rubik-cube-deploy <предыдущий SHA>` или `Run workflow` с тегом прежней версии. Миграции только вперёд: откат приложения не откатывает схему, поэтому миграции должны оставаться совместимыми с предыдущей версией.

**Секреты окружения `production`:** `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS` (строка `known_hosts` сервера — ключ хоста закреплён).

## Резервные копии базы

Каждую ночь ([#109](https://github.com/pavelmiskevich/rubik-cube/issues/109)):

1. **02:30 UTC, сервер** — таймер запускает `rubik-cube-backup`. Скрипт снимает `pg_dump` изнутри контейнера базы и восстанавливает его в одноразовый Postgres без сети, затем сверяет число строк каждой таблицы с живой базой. Дамп, который не восстановился или не сошёлся, не сохраняется, запуск падает, а прежние копии остаются как были. Хранятся 14 последних дампов. Последний шифруется открытым ключом age владельца и выкладывается на забор.
2. **04:10 UTC, GitHub** — workflow `Backup` забирает зашифрованную копию ключом, который умеет только это, и хранит её артефактом `db-backup-<метка>` 90 дней. Он проверяет, что копии не больше 26 часов и что это файл age. Упавший запуск приходит владельцу письмом: значит, копии перестали делаться.

Закрытого ключа age нет ни на сервере, ни в GitHub. Потерять его — потерять все копии вне сервера, поэтому храните его в двух местах. Артефакты публичного репозитория может скачать любой вошедший на GitHub, но без ключа это шифротекст. Видны только размер и время копии.

Выключатель — переменная репозитория `BACKUP_ENABLED`: без неё workflow не делает ничего. Проверки скриптов — workflow `Deploy scripts` (shellcheck и `deploy/test/backup.test.sh` на одноразовом стенде), он запускается при правке `deploy/`.

### Установка (один раз)

**У себя** — два ключа:

```bash
# Ключ шифрования копий. Файл — в менеджер паролей и ещё в одно место;
# строка «Public key: age1…» — открытый ключ, его можно показывать.
age-keygen -o rubik-cube-backup.key

# SSH-ключ забора копий, без пароля: им ходит workflow.
ssh-keygen -t ed25519 -N '' -C rubik-cube-backup -f rubik-cube-backup-ssh
```

**На сервере**, от root (файлы — из этого каталога):

```bash
apt-get install -y age

install -m 755 rubik-cube-backup rubik-cube-backup-ssh /usr/local/bin/
install -m 644 rubik-cube-backup.service rubik-cube-backup.timer /etc/systemd/system/
printf '%s\n' 'age1…открытый ключ…' > /opt/rubik-cube/backup-recipients.txt
chmod 644 /opt/rubik-cube/backup-recipients.txt

# Пользователь забора: без пароля, без sudo, без группы docker. Shell нужен —
# через него sshd запускает принудительную команду, а restrict не даёт pty.
useradd --create-home --shell /bin/bash rubik-backup
install -d -m 700 -o rubik-backup -g rubik-backup ~rubik-backup/.ssh
printf 'command="/usr/local/bin/rubik-cube-backup-ssh",restrict %s\n' \
  "$(cat rubik-cube-backup-ssh.pub)" > ~rubik-backup/.ssh/authorized_keys
chown rubik-backup:rubik-backup ~rubik-backup/.ssh/authorized_keys
chmod 600 ~rubik-backup/.ssh/authorized_keys

# Первая копия руками — в журнале должно быть «восстановление проверено».
systemctl daemon-reload
systemctl start rubik-cube-backup
journalctl -u rubik-cube-backup -n 20 --no-pager
systemctl enable --now rubik-cube-backup.timer
```

**В GitHub** — окружение `backup` (ветка `main`, без ревьюера: забор идёт по расписанию):

```bash
gh secret set SSH_PRIVATE_KEY --env backup < rubik-cube-backup-ssh
gh secret set SSH_USER --env backup --body rubik-backup
# SSH_HOST, SSH_PORT, SSH_KNOWN_HOSTS — те же значения, что в окружении production.
gh secret set SSH_HOST --env backup
gh secret set SSH_PORT --env backup
gh secret set SSH_KNOWN_HOSTS --env backup
gh variable set BACKUP_ENABLED --body true
gh workflow run Backup
```

Проверить, что копия читается: скачать артефакт последнего запуска `Backup` и расшифровать — `age -d -i rubik-cube-backup.key -o check.dump rubik-cube-<метка>.dump.age`; `pg_restore --list check.dump` покажет таблицы.

Workflow по расписанию GitHub отключает после 60 дней без активности в репозитории и предупреждает об этом письмом — тогда включить снова кнопкой в Actions.

### Восстановление

Копия на сервере — `/var/backups/rubik-cube/rubik-cube-<метка>.dump`. Копия из артефакта расшифровывается у себя (`age -d -i rubik-cube-backup.key …`) и кладётся на сервер через `scp`. Дальше от root:

```bash
cd /opt/rubik-cube
dc() { docker compose --project-directory /opt/rubik-cube --env-file .env --env-file image.env "$@"; }

dc stop app
dc exec -T db sh -c 'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --single-transaction' \
  < /var/backups/rubik-cube/rubik-cube-<метка>.dump
dc start app
```

`--single-transaction`: восстановление либо проходит целиком, либо база остаётся как была. Схема берётся из копии. Если после неё выходили релизы с миграциями, верните и приложение на релиз того времени (раздел «Откат» выше), иначе новое приложение встретит старую схему.
