#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# cleanup_vps.sh  —  Libera espacio y recursos en el VPS de Hostinger
# Ejecutar desde el repo root:  bash deploy/cleanup_vps.sh
#
# Qué hace:
#   1. Elimina imágenes Docker huérfanas / capas sin usar
#   2. Elimina contenedores y redes detenidos
#   3. Purga los volúmenes de salida CV (output.mp4 anotados, frames)
#      — los JSONs de resultados y las subidas originales se conservan
#   4. Limpia logs de Docker (los contenedores acumulan logs sin fin)
#   5. Purga backups de PostgreSQL más viejos de N días (default 3)
#   6. Muestra un resumen de uso de disco antes/después
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)
BACKUP_KEEP_DAYS="${1:-3}"   # primer argumento: cuántos días de backup conservar

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; NC='\033[0m'

echo ""
echo -e "${YLW}══════════════════════════════════════════════════${NC}"
echo -e "${YLW}  🧹  Limpieza VPS Deporte FC${NC}"
echo -e "${YLW}══════════════════════════════════════════════════${NC}"
echo ""

# ── Disco antes ───────────────────────────────────────────────────────────────
echo -e "${GRN}📊 Uso de disco ANTES:${NC}"
df -h / | tail -1
echo ""

# ── 1. Docker: imágenes huérfanas + capas sin usar ────────────────────────────
echo -e "${GRN}🐋 Limpiando imágenes Docker sin usar…${NC}"
docker image prune -f
echo ""

# ── 2. Docker: contenedores parados + redes huérfanas ────────────────────────
echo -e "${GRN}🐋 Limpiando contenedores parados y redes…${NC}"
docker container prune -f
docker network prune -f
echo ""

# ── 3. Docker build cache (ocupa mucho tras rebuilds) ────────────────────────
echo -e "${GRN}🐋 Limpiando build cache de Docker…${NC}"
docker builder prune -f --filter type=exec.cachemount
echo ""

# ── 4. Purgar vídeos anotados del pipeline CV ─────────────────────────────────
# El worker genera output.mp4 + frames/*.jpg para cada análisis.
# Con DEPORTE_CV_VIDEO=0 ya no se generan, pero pueden quedar los viejos.
CV_OUTPUT_DIR="${DEPORTE_CV_ROOT:-/data/cv}/outputs"
if [ -d "$CV_OUTPUT_DIR" ]; then
  echo -e "${GRN}🎬 Borrando vídeos anotados en ${CV_OUTPUT_DIR}…${NC}"
  BEFORE=$(du -sh "$CV_OUTPUT_DIR" 2>/dev/null | cut -f1)
  # Elimina los output.mp4 y directorios de frames, conserva results.json y sample.jpg
  find "$CV_OUTPUT_DIR" -name "output.mp4" -delete 2>/dev/null || true
  find "$CV_OUTPUT_DIR" -type d -name "frames" -exec rm -rf {} + 2>/dev/null || true
  AFTER=$(du -sh "$CV_OUTPUT_DIR" 2>/dev/null | cut -f1)
  echo "   Antes: $BEFORE  →  Después: $AFTER"
else
  # Si el directorio está dentro del volumen Docker, acceder mediante contenedor
  echo -e "${YLW}  (accediendo al volumen Docker cv_data…)${NC}"
  "${COMPOSE[@]}" run --rm --no-deps \
    -v cv_data:/data/cv \
    api bash -c "
      find /data/cv/outputs -name 'output.mp4' -delete 2>/dev/null || true;
      find /data/cv/outputs -type d -name 'frames' -exec rm -rf {} + 2>/dev/null || true;
      echo 'Limpieza de outputs CV completada';
      du -sh /data/cv/outputs 2>/dev/null || true
    " || echo "  (sin acceso al volumen — omitido)"
fi
echo ""

# ── 5. Rotar logs de los contenedores Docker ──────────────────────────────────
echo -e "${GRN}📋 Truncando logs de contenedores Docker…${NC}"
for container in $("${COMPOSE[@]}" ps -q 2>/dev/null); do
  log_path=$(docker inspect --format='{{.LogPath}}' "$container" 2>/dev/null || true)
  if [ -n "$log_path" ] && [ -f "$log_path" ]; then
    size_before=$(du -sh "$log_path" 2>/dev/null | cut -f1)
    truncate -s 0 "$log_path" 2>/dev/null || true
    echo "   Truncado: $log_path  ($size_before → 0)"
  fi
done
echo ""

# ── 6. Purgar backups PG viejos ───────────────────────────────────────────────
echo -e "${GRN}🗄️  Eliminando backups PG de más de ${BACKUP_KEEP_DAYS} días…${NC}"
docker run --rm \
  -v pg_backups:/backups \
  alpine:3 \
  find /backups -name "*.sql.gz" -mtime "+${BACKUP_KEEP_DAYS}" -delete -print \
  2>/dev/null || echo "  (sin backups viejos)"
echo ""

# ── 7. Limpiar /tmp del host ──────────────────────────────────────────────────
echo -e "${GRN}🗑️  Limpiando /tmp del host…${NC}"
find /tmp -maxdepth 1 -mtime +1 -delete 2>/dev/null || true
echo ""

# ── Disco después ─────────────────────────────────────────────────────────────
echo -e "${GRN}📊 Uso de disco DESPUÉS:${NC}"
df -h / | tail -1
echo ""

# ── Resumen de contenedores activos ──────────────────────────────────────────
echo -e "${GRN}🟢 Servicios activos:${NC}"
"${COMPOSE[@]}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
echo ""

echo -e "${GRN}✅ Limpieza completada.${NC}"
echo ""
echo "TIPS adicionales para liberar más espacio:"
echo "  • Ver qué ocupa más:     du -sh /var/lib/docker/* | sort -rh | head -10"
echo "  • Ver tamaño volúmenes:  docker system df -v"
echo "  • Ver logs en tiempo real: ${COMPOSE[*]} logs -f --tail=50 worker"
