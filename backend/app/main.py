import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models  # noqa: F401  — registra todas las tablas en Base.metadata
from .api.v1 import api_router
from .core.database import Base, engine, ensure_schema
from .core.audit import AuditMiddleware
from .websockets import ws_router

# Crear tablas automáticamente + reconciliar columnas aditivas en DBs ya existentes
Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(
    title="Deporte FC - Plataforma de Gestión",
    description="Sistema integral de gestión de jugadores de fútbol con analytics predictivos",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS: en producción se lee de variable de entorno, en desarrollo permite todo localhost
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:4000",
    "http://localhost:4001",
    "http://localhost:4002",
    "http://localhost:4003",
    "http://localhost:19006",
]
origins = [o.strip() for o in ALLOWED_ORIGINS if o.strip()] or DEFAULT_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Permite el frontend desplegado en Vercel (producción + previews) sin tener
    # que enumerar la URL exacta. Para restringir a un dominio propio, seteá
    # ALLOWED_ORIGINS en el entorno (la lista exacta tiene prioridad por igual).
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router)  # exposes /ws (WebSocket)


@app.on_event("startup")
def _optional_demo_seed() -> None:
    """One-shot demo seed for a fresh deployment, gated by ``SEED_ON_START=1``.

    A freshly-provisioned production DB has no users (login fails) and no events
    (analytics is empty). This runs the seed scripts *from inside the app* — so
    it works no matter how the container is started (``start.sh`` or a direct
    ``uvicorn`` command) — but only when the flag is set AND the DB has no users
    yet, so it's idempotent and safe across workers. Never raises: a seeding
    hiccup must not stop the API from booting.
    """
    if os.getenv("SEED_ON_START") != "1":
        return
    import logging
    log = logging.getLogger("startup.seed")
    try:
        from .core.database import SessionLocal
        from .models.user import User
        db = SessionLocal()
        try:
            if db.query(User).first() is not None:
                return  # already seeded — nothing to do
        finally:
            db.close()
        import subprocess
        import sys
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../backend
        for script in ("seed.py", "seed_analytics.py"):
            log.info("Running %s …", script)
            subprocess.run([sys.executable, script], cwd=backend_dir, check=False)
    except Exception as exc:  # noqa: BLE001 — never block startup on seeding
        log.warning("Demo seed skipped: %s", exc)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Deporte FC API"}
