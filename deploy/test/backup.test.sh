#!/bin/bash
# Проверка deploy/rubik-cube-backup и rubik-cube-backup-ssh на одноразовом
# стенде (#109).
#
# Нужно то же, что на сервере: Docker с compose, bash, age, GNU coreutils и
# findutils, flock. Запуск — `bash deploy/test/backup.test.sh`; в CI — job
# в workflow deploy-scripts.yml.
#
# Стенд — настоящий deploy/docker-compose.prod.yml, но под своим именем
# проекта: у прод-файла `name: rubik-cube`, и без подмены тест сел бы на
# локальный том rubik-cube_pgdata, а уборка его удалила бы.
set -euo pipefail

here=$(cd "$(dirname "$0")/.." && pwd)
script="$here/rubik-cube-backup"
ssh_script="$here/rubik-cube-backup-ssh"
project="rubik-cube-backup-test-$$"
work=$(mktemp -d)
app="$work/app"
backups="$work/backups"
outgoing="$work/outgoing"

compose() {
  docker compose -p "$project" --project-directory "$app" -f "$app/docker-compose.yml" \
    --env-file "$app/.env" --env-file "$app/image.env" "$@"
}

cleanup() {
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

passed=0
ok() { passed=$((passed + 1)); echo "  ✓ $1"; }
fail() { echo "  ✗ $1" >&2; exit 1; }

run_backup() {
  RUBIK_DIR="$app" BACKUP_ROOT="$backups" BACKUP_OUTGOING="$outgoing" \
    BACKUP_GROUP="$(id -gn)" BACKUP_KEEP=3 "$@" "$script"
}

dumps() { find "$backups" -maxdepth 1 -name 'rubik-cube-*.dump' -printf '%f\n' | sort; }

leftovers() {
  find "$backups" "$outgoing" -mindepth 1 -name '.*' 2>/dev/null | grep . && return 0
  docker ps -a --format '{{.Names}}' | grep '^rubik-cube-backup-check-' && return 0
  return 1
}

echo "Стенд"
mkdir -p "$app"
sed "s/^name: rubik-cube\$/name: $project/" "$here/docker-compose.prod.yml" > "$app/docker-compose.yml"
grep -q "^name: $project\$" "$app/docker-compose.yml" || fail "имя проекта не подменилось"
cat > "$app/.env" <<'EOF'
POSTGRES_USER=rubik
POSTGRES_PASSWORD=test-only
POSTGRES_DB=rubik
DATABASE_URL=postgresql://rubik:test-only@db:5432/rubik
AUTH_URL=http://localhost
AUTH_SECRET=test-only
EOF
echo "IMAGE_TAG=test" > "$app/image.env"
age-keygen -o "$work/key.txt" 2>/dev/null
age-keygen -y "$work/key.txt" > "$app/backup-recipients.txt"

compose up -d --wait db >/dev/null 2>&1
compose exec -T db psql -q -U rubik -d rubik -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE "User" (id text PRIMARY KEY, email text NOT NULL);
CREATE TABLE "Solve" (id serial PRIMARY KEY, "userId" text REFERENCES "User"(id), "timeMs" integer);
INSERT INTO "User" SELECT 'u' || g, 'u' || g || '@test' FROM generate_series(1, 25) g;
INSERT INTO "Solve" ("userId", "timeMs") SELECT 'u' || (g % 25 + 1), g * 10 FROM generate_series(1, 500) g;
SQL
ok "база поднята, 25 + 500 строк"

echo "Копия"
run_backup
[[ $(dumps | wc -l) -eq 1 ]] || fail "ожидался один дамп, есть: $(dumps)"
dump="$backups/$(dumps)"
stamp=$(cat "$outgoing/latest.stamp")
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || fail "метка не того вида: $stamp"
[[ "$(basename "$dump")" == "rubik-cube-$stamp.dump" ]] || fail "метка $stamp не совпала с дампом $dump"
ok "дамп и метка $stamp"

[[ $(stat -c %a "$dump") == 600 ]] || fail "дамп доступен не только владельцу: $(stat -c %a "$dump")"
[[ $(stat -c %a "$outgoing/latest.dump.age") == 640 ]] || fail "права на забор: $(stat -c %a "$outgoing/latest.dump.age")"
ok "права: дамп 600, на забор 640"

[[ "$(head -c 21 "$outgoing/latest.dump.age")" == "age-encryption.org/v1" ]] || fail "на забор ушёл не файл age"
age -d -i "$work/key.txt" -o "$work/decrypted" "$outgoing/latest.dump.age"
cmp -s "$work/decrypted" "$dump" || fail "расшифрованная копия не совпала с дампом"
ok "копия на забор зашифрована и расшифровывается ключом владельца"

contents=$(compose exec -T db pg_restore --list < "$work/decrypted")
grep -q 'TABLE DATA public Solve' <<< "$contents" || fail "в копии нет данных Solve"
ok "в копии данные таблиц"

leftovers && fail "остались временные файлы или проверочный контейнер"
ok "временное убрано"

echo "Ротация"
for day in 01 02 03 04 05; do : > "$backups/rubik-cube-202001${day}T000000Z.dump"; done
sleep 1
run_backup >/dev/null
kept=$(dumps)
[[ $(wc -l <<< "$kept") -eq 3 ]] || fail "должно остаться три дампа, есть: $kept"
grep -q "rubik-cube-$stamp.dump" <<< "$kept" || fail "удалён свежий дамп"
grep -q 'rubik-cube-20200105T000000Z.dump' <<< "$kept" || fail "оставлен не самый новый из старых"
grep -q 'rubik-cube-20200101T000000Z.dump' <<< "$kept" && fail "старый дамп не удалён"
ok "остались три новейших: $(tr '\n' ' ' <<< "$kept")"

echo "Восстановление по README"
compose exec -T db psql -q -U rubik -d rubik -v ON_ERROR_STOP=1 \
  -c 'DELETE FROM "Solve" WHERE id > 100' -c 'CREATE TABLE "Later" (id int)'
# Команда — та же, что в deploy/README.md, раздел «Восстановление».
# shellcheck disable=SC2016
compose exec -T db sh -c 'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --single-transaction' \
  < "$dump"
solves=$(compose exec -T db psql -U rubik -d rubik -At -c 'SELECT count(*) FROM "Solve"')
[[ "$solves" == 500 ]] || fail "после восстановления сборок $solves, а не 500"
ok "удалённые строки вернулись из копии"

# Отказы: копия не опубликована, прежняя на заборе не тронута, мусора нет.
published=$(sha256sum "$outgoing/latest.dump.age" "$outgoing/latest.stamp")
before=$(dumps)
untouched() {
  [[ "$(sha256sum "$outgoing/latest.dump.age" "$outgoing/latest.stamp")" == "$published" ]] \
    || fail "$1: копия на заборе подменена"
  [[ "$(dumps)" == "$before" ]] || fail "$1: набор дампов изменился"
  leftovers && fail "$1: остались временные файлы или проверочный контейнер"
  return 0
}

echo "Отказы"
sleep 1
if run_backup env BACKUP_CHECK_IMAGE=rubik-cube-backup-test/no-such-image:0 >/dev/null 2>&1; then
  fail "дамп без проверки восстановлением принят"
fi
untouched "без проверки"
ok "дамп, который не удалось проверить восстановлением, не сохранён"

mv "$app/backup-recipients.txt" "$work/recipients.bak"
if run_backup >/dev/null 2>&1; then fail "без открытого ключа копия сделана"; fi
mv "$work/recipients.bak" "$app/backup-recipients.txt"
untouched "без ключа"
ok "без открытого ключа — отказ"

compose stop db >/dev/null 2>&1
if run_backup >/dev/null 2>&1; then fail "при остановленной базе копия сделана"; fi
untouched "база остановлена"
ok "база остановлена — отказ, прежняя копия на месте"

echo "Ключ забора"
for command in "" "bash" "latest now" "cat /etc/passwd" "stamp; id"; do
  code=0
  SSH_ORIGINAL_COMMAND="$command" "$ssh_script" >/dev/null 2>&1 || code=$?
  [[ $code -eq 2 ]] || fail "команда «$command» не отвергнута (код $code)"
done
ok "чужие команды отвергаются"

echo "Пройдено проверок: $passed"
