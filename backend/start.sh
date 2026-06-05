#!/bin/bash
set -e

echo "🚀 Iniciando Deporte FC API..."

# Correr migraciones de base de datos si hay alembic configurado
if [ -f "alembic.ini" ]; then
  echo "📦 Aplicando migraciones..."
  alembic upgrade head || echo "⚠️  Migraciones omitidas (puede que la DB ya esté al día)"
fi

# Seed opcional de datos demo. Una DB de producción recién creada no tiene
# usuarios (no se puede iniciar sesión) ni eventos (la analítica sale vacía).
# Poné SEED_ON_START=1 en el entorno, deployá UNA vez, y luego sacá la variable.
# seed.py es idempotente para usuarios; seed_analytics.py reemplaza su propio
# partido de muestra, así que volver a correrlo es seguro.
if [ "${SEED_ON_START}" = "1" ]; then
  echo "🌱 Sembrando datos demo (SEED_ON_START=1)..."
  python seed.py           || echo "⚠️  seed.py falló o ya estaba sembrado"
  python seed_analytics.py || echo "⚠️  seed_analytics.py falló"
fi

# Arrancar servidor
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 2
