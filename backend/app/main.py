import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.v1 import api_router
from .core.database import Base, engine
from .core.audit import AuditMiddleware
from .websockets import ws_router

# Crear tablas automáticamente
Base.metadata.create_all(bind=engine)

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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router)  # exposes /ws (WebSocket)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Deporte FC API"}
