from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.v1 import api_router
from .core.database import Base, engine

# Crear tablas automáticamente en desarrollo
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Deporte FC - Plataforma de Gestión",
    description="Sistema integral de gestión de jugadores de fútbol con analytics predictivos",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Deporte FC API"}
