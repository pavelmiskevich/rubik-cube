#!/bin/bash
# Проверка deploy/rubik-cube-deploy на одноразовом стенде (#121).
#
# Нужно то же, что на сервере: Docker с compose, bash, curl, flock. Запуск —
# `bash deploy/test/deploy.test.sh`; в CI — job в workflow deploy-scripts.yml.
#
# Стенд — настоящий deploy/docker-compose.prod.yml под своим именем проекта и
# с образами из локального реестра: скрипт по-настоящему скачивает их, как с
# ghcr.io. Образы — заглушки на busybox: приложение отвечает «ok <версия>»,
# миграция печатает, отвечало ли в это время прежнее приложение, и может
# упасть.
set -euo pipefail

here=$(cd "$(dirname "$0")/.." && pwd)
script="$here/rubik-cube-deploy"
project="rubik-cube-deploy-test-$$"
registry_name="$project-registry"
work=$(mktemp -d)
app="$work/app"
port=$((20000 + $$ % 10000))

passed=0
ok() { passed=$((passed + 1)); echo "  ✓ $1"; }
fail() {
  echo "  ✗ $1" >&2
  if [[ -n "${out:-}" ]]; then printf '%s\n' "--- вывод выкладки ---" "$out" >&2; fi
  exit 1
}

compose() {
  docker compose --project-directory "$app" -f "$app/docker-compose.yml" \
    --env-file "$app/.env" --env-file "$app/image.env" "$@"
}

registry=""
cleanup() {
  if [[ -f "$app/image.env" ]]; then compose down -v --remove-orphans >/dev/null 2>&1 || true; fi
  docker rm -f "$registry_name" >/dev/null 2>&1 || true
  if [[ -n "$registry" ]]; then
    docker images "$registry/rubik-cube" --format '{{.Repository}}:{{.Tag}}' \
      | xargs -r docker image rm -f >/dev/null 2>&1 || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT

sha_of() { printf '%040d' 0 | tr 0 "$1"; }
A=$(sha_of a) B=$(sha_of b) C=$(sha_of c) D=$(sha_of d) L=$(sha_of e) MISSING=$(sha_of f)

# Код выхода — в $status, вывод (stdout и stderr) — в $out.
deploy() {
  status=0
  out=$(RUBIK_DIR="$app" RUBIK_IMAGE="$registry/rubik-cube" DEPLOY_HEALTH_TRIES=5 \
    "$script" "$@" 2>&1) || status=$?
}

served() { curl -s -m 5 "http://127.0.0.1:$port/" || true; }
tag_in_file() { sed -n 's/^IMAGE_TAG=//p' "$app/image.env"; }
app_id() { compose ps -q app; }

# Приложение: ok — отвечает и на /api/health; legacy — как релизы до #120,
# только /; hung — не отвечает вовсе. trap — чтобы PID 1 сразу выходил по
# SIGTERM, а не ждал десять секунд до SIGKILL.
build_app() {
  docker build -q -t "$registry/rubik-cube:$1" --build-arg VERSION="$2" --build-arg KIND="$3" - >/dev/null <<'EOF'
FROM busybox:1.36.1
ARG VERSION
ARG KIND
ENV KIND=$KIND
RUN mkdir -p /www/api && echo "ok $VERSION" > /www/index.html \
 && if [ "$KIND" = ok ]; then echo "ok $VERSION" > /www/api/health; fi
CMD ["sh", "-c", "trap 'exit 0' TERM; if [ \"$KIND\" = hung ]; then sleep 3600 & else httpd -f -p 3000 -h /www & fi; wait"]
EOF
  docker push -q "$registry/rubik-cube:$1" >/dev/null
}

# Миграция: вместо `npx prisma migrate deploy` — сценарий, который печатает,
# кто отвечает на app:3000, и выходит с заданным кодом.
build_migrate() {
  docker build -q -t "$registry/rubik-cube:migrate-$1" --build-arg VERSION="$2" --build-arg EXIT="$3" - >/dev/null <<'EOF'
FROM busybox:1.36.1
ARG VERSION
ARG EXIT
RUN mkdir -p /usr/local/bin && printf '%s\n' '#!/bin/sh' \
      "echo \"миграция $VERSION; приложение: \$(wget -qO- -T 2 http://app:3000/api/health 2>/dev/null || echo нет)\"" \
      "exit $EXIT" > /usr/local/bin/npx && chmod +x /usr/local/bin/npx
EOF
  docker push -q "$registry/rubik-cube:migrate-$1" >/dev/null
}

echo "Стенд"
docker run -d --name "$registry_name" -p 127.0.0.1::5000 registry:2 >/dev/null
registry=$(docker port "$registry_name" 5000/tcp | head -n 1)
for _ in $(seq 1 20); do
  curl -sf "http://$registry/v2/" >/dev/null && break
  sleep 1
done
build_app "$A" A ok;     build_migrate "$A" A 0
build_app "$B" B ok;     build_migrate "$B" B 0
build_app "$C" C ok;     build_migrate "$C" C 1
build_app "$D" D hung;   build_migrate "$D" D 0
build_app "$L" L legacy; build_migrate "$L" L 0
ok "реестр $registry, образы пяти версий"

mkdir -p "$app"
sed -e "s/^name: rubik-cube\$/name: $project/" \
    -e "s#ghcr.io/pavelmiskevich/rubik-cube:#$registry/rubik-cube:#" \
    "$here/docker-compose.prod.yml" > "$app/docker-compose.yml"
grep -q "^name: $project\$" "$app/docker-compose.yml" || fail "имя проекта не подменилось"
grep -q 'ghcr.io' "$app/docker-compose.yml" && fail "адрес образа не подменился"
# Комментарий в строке порта — то, на чём ломался прежний разбор через sed
# (#148).
cat > "$app/.env" <<EOF
POSTGRES_USER=rubik
POSTGRES_PASSWORD=test-only
POSTGRES_DB=rubik
DATABASE_URL=postgresql://rubik:test-only@db:5432/rubik
AUTH_URL=http://localhost
AUTH_SECRET=test-only
HOST_PORT=$port # порт стенда
EOF
ok "compose-файл и .env стенда, порт $port"

echo "Отказы до выкладки"
deploy not-a-sha
[[ $status -eq 2 ]] || fail "неполный SHA не отвергнут (код $status)"
ok "неполный SHA — отказ"

mv "$app/.env" "$work/env.bak"
deploy "$MISSING"
mv "$work/env.bak" "$app/.env"
[[ $status -ne 0 ]] || fail "без .env выкладка прошла"
grep -q "Нет $app/.env" <<< "$out" || fail "без .env нет понятного сообщения"
ok "без .env — отказ до скачивания образов"

echo "Первая выкладка"
deploy "$A"
[[ $status -eq 0 ]] || fail "выкладка A упала (код $status)"
[[ "$(tag_in_file)" == "$A" ]] || fail "в image.env не A"
[[ "$(served)" == "ok A" ]] || fail "отвечает не A: $(served)"
grep -q "миграция A; приложение: нет" <<< "$out" || fail "миграции A не было"
ok "A выложена, миграции прошли, порт взят у compose"

echo "Обновление"
deploy "$B"
[[ $status -eq 0 ]] || fail "выкладка B упала (код $status)"
grep -q "миграция B; приложение: ok A" <<< "$out" \
  || fail "миграции B шли не при работающей A"
[[ "$(served)" == "ok B" ]] || fail "отвечает не B: $(served)"
[[ "$(tag_in_file)" == "$B" ]] || fail "в image.env не B"
ok "миграции B — при работающей A, затем B"

before=$(app_id)
deploy "$B"
[[ $status -eq 0 ]] || fail "повтор B упал (код $status)"
[[ "$(app_id)" == "$before" ]] || fail "повтор пересоздал приложение"
docker image inspect "$registry/rubik-cube:$A" >/dev/null 2>&1 || fail "повтор удалил образ прежней версии A"
ok "повтор того же SHA: приложение не пересоздано, образ A на месте"

echo "Сбой миграции"
before=$(app_id)
deploy "$C"
[[ $status -ne 0 ]] || fail "выкладка с упавшей миграцией прошла"
[[ "$(tag_in_file)" == "$B" ]] || fail "после упавшей миграции в image.env $(tag_in_file)"
[[ "$(app_id)" == "$before" ]] || fail "упавшая миграция пересоздала приложение"
[[ "$(served)" == "ok B" ]] || fail "после упавшей миграции отвечает: $(served)"
grep -q "prisma migrate status" <<< "$out" || fail "нет подсказки, как смотреть состояние миграций"
ok "упавшая миграция: B работает, не пересоздана, image.env прежний"

echo "Приложение не отвечает"
deploy "$D"
[[ $status -ne 0 ]] || fail "выкладка неответившего приложения прошла"
grep -q "Откат прошёл, работает $B" <<< "$out" || fail "нет сообщения об откате"
[[ "$(tag_in_file)" == "$B" ]] || fail "после отката в image.env $(tag_in_file)"
[[ "$(served)" == "ok B" ]] || fail "после отката отвечает: $(served)"
ok "неответившая D откатилась на B сама"

echo "Откат на релиз без /api/health"
deploy "$L"
[[ $status -eq 0 ]] || fail "выкладка L упала (код $status)"
[[ "$(served)" == "ok L" ]] || fail "отвечает не L: $(served)"
ok "на 404 от /api/health проверяется /"

tags=$(docker images "$registry/rubik-cube" --format '{{.Tag}}' | sort | tr '\n' ' ')
expected=$(printf '%s\n' "$B" "migrate-$B" "$L" "migrate-$L" | sort | tr '\n' ' ')
[[ "$tags" == "$expected" ]] || fail "остались образы: $tags"
ok "остались только текущий L и предыдущий B"

echo "Нет образа"
deploy "$MISSING"
[[ $status -ne 0 ]] || fail "выкладка несуществующего образа прошла"
[[ "$(tag_in_file)" == "$L" ]] || fail "после отказа в image.env $(tag_in_file)"
[[ "$(served)" == "ok L" ]] || fail "после отказа отвечает: $(served)"
ok "образа нет — L работает, image.env прежний"

echo "Параллельный запуск"
flock -n "$app" sleep 30 &
holder=$!
sleep 1
deploy "$B"
kill "$holder"
wait "$holder" 2>/dev/null || true
[[ $status -ne 0 ]] || fail "вторая выкладка поверх идущей не отвергнута"
grep -q "Выкладка уже идёт" <<< "$out" || fail "нет сообщения о блокировке"
[[ "$(tag_in_file)" == "$L" ]] || fail "отвергнутая выкладка поменяла image.env"
ok "вторая выкладка поверх идущей отвергнута, блокировка — на каталоге проекта"

out=""
echo "Пройдено проверок: $passed"
