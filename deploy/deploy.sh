#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deporte FC — one-shot deploy on the Hostinger KVM VPS (Debian).
# Run from the repo root:   bash deploy/deploy.sh
#
# It will:
#   1. Generate .env.prod with fresh random secrets (only the first time).
#   2. Build + start the full stack (postgres, redis, api, worker, beat, backup).
#   3. Seed demo data once (idempotent).
# Re-running it later just rebuilds + restarts; it never overwrites .env.prod.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

ENV_FILE=".env.prod"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

# The deployed frontend origin (Vercel). The backend CORS also allows any
# *.vercel.app via regex, but we list it explicitly too.
FRONTEND_ORIGIN="https://frontend-ten-mu-8riqom2oeb.vercel.app"

# ── 1. secrets ───────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "🔐 Generando $ENV_FILE con secretos nuevos…"
  SECRET_KEY="$(openssl rand -hex 48)"
  DB_PASS="$(openssl rand -hex 24)"
  # A Fernet key is urlsafe-base64 of 32 random bytes.
  FERNET="$(openssl rand -base64 32 | tr '+/' '-_')"

  cp backend/.env.prod.example "$ENV_FILE"
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASS}|"        "$ENV_FILE"
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET_KEY}|"                  "$ENV_FILE"
  sed -i "s|^DATA_ENCRYPTION_KEY=.*|DATA_ENCRYPTION_KEY=${FERNET}|"    "$ENV_FILE"
  sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${FRONTEND_ORIGIN}|"   "$ENV_FILE"
  echo "✅ $ENV_FILE creado. (Guárdalo a salvo: contiene los secretos.)"
else
  echo "ℹ️  $ENV_FILE ya existe — lo respeto y no toco los secretos."
fi

# ── 2. build + up ────────────────────────────────────────────────────────────
echo "🏗️  Construyendo e iniciando el stack (la primera vez tarda: descarga torch/YOLO)…"
"${COMPOSE[@]}" up -d --build

# ── 3. seed once (idempotent) ────────────────────────────────────────────────
echo "🌱 Sembrando datos demo (usuarios + analítica)…"
"${COMPOSE[@]}" run --rm api python seed.py           || echo "⚠️  seed.py ya estaba aplicado"
"${COMPOSE[@]}" run --rm api python seed_analytics.py || echo "⚠️  seed_analytics.py falló o ya estaba"

echo ""
echo "✅ Listo."
echo "   Comprobar salud:   curl -fsS http://localhost:8000/health"
echo "   Ver servicios:     ${COMPOSE[*]} ps"
echo "   Logs del worker:   ${COMPOSE[*]} logs -f worker"
