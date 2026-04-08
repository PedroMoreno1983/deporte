#!/bin/bash
set -e

echo "🚀 Iniciando Deporte FC API..."

# Correr migraciones de base de datos si hay alembic configurado
if [ -f "alembic.ini" ]; then
  echo "📦 Aplicando migraciones..."
  alembic upgrade head || echo "⚠️  Migraciones omitidas (puede que la DB ya esté al día)"
fi

# Arrancar servidor
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 2
