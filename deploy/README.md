# Despliegue de Deporte FC en el VPS (Hostinger KVM 8, Debian)

Backend + worker de video + base de datos en tu VPS; frontend en Vercel.

- **VPS IP:** `72.62.12.242`
- **Subdominio backend:** `deporte-api.datawiseconsultoria.com`
- **Frontend (Vercel):** `https://frontend-ten-mu-8riqom2oeb.vercel.app`

---

## Paso 1 — DNS (en Hostinger → Domains → datawiseconsultoria.com → Manage DNS)

Crea un registro **A**:

| Tipo | Nombre        | Apunta a       | TTL  |
|------|---------------|----------------|------|
| A    | `deporte-api` | `72.62.12.242` | 3600 |

(Queda `deporte-api.datawiseconsultoria.com`.)

## Paso 2 — Conectarse al VPS y traer el código

```bash
ssh root@72.62.12.242
curl -fsSL https://get.docker.com | sh        # Docker + plugin compose
apt-get install -y git openssl
git clone https://github.com/PedroMoreno1983/deporte.git
cd deporte
```

## Paso 3 — Levantar todo el stack

```bash
bash deploy/deploy.sh
```

Esto genera `.env.prod` con secretos nuevos, construye las imágenes (la primera
vez baja torch/YOLO, tarda varios minutos) y arranca: postgres, redis, **api**,
**worker** (procesa los videos), beat y backups. Comprueba:

```bash
curl -fsS http://localhost:8000/health      # debe responeder OK
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

## Paso 4 — HTTPS con Caddy (en el host)

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy saca el certificado Let's Encrypt solo. Prueba en el navegador:
`https://deporte-api.datawiseconsultoria.com/health`

> El firewall del VPS debe permitir **80 y 443** (Caddy) y, mientras pruebas,
> opcionalmente 8000. Postgres/Redis quedan en la red interna de Docker (no se exponen).

## Paso 5 — Apuntar el frontend al backend

En **Vercel → Project → Settings → Environment Variables**:

```
NEXT_PUBLIC_API_URL = https://deporte-api.datawiseconsultoria.com/api/v1
NEXT_PUBLIC_WS_URL  = wss://deporte-api.datawiseconsultoria.com/ws
```

Redeploy del frontend. Listo: el login y la subida de clips usan tu VPS.

---

## Operación

```bash
# logs del procesamiento de video
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f worker

# actualizar a la última versión
git pull && bash deploy/deploy.sh

# subir la concurrencia del worker (tienes 8 vCPU / 32 GB):
#   edita docker-compose.prod.yml -> worker -> --concurrency 4
```

**Notas de capacidad (KVM 8 = 8 vCPU / 32 GB RAM):**
- RAM de sobra para el pipeline (torch + YOLO + OCR).
- Es **CPU, no GPU**: clips cortos van bien; un partido completo será lento.
- Los videos se guardan en el volumen `cv_data` (persistente entre reinicios).
