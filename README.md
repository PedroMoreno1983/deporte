# Deporte FC

Plataforma de gestión deportiva para clubes de fútbol. Sistema integral para monitoreo de jugadores, lesiones, entrenamiento, wellness, analytics táctico y predicciones de riesgo de lesión.

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, TanStack Query, Recharts
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic, scikit-learn
- **Mobile**: Expo / React Native (comparte API con el frontend web)
- **Base de datos**: PostgreSQL (producción) / SQLite (desarrollo)

## Requisitos

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose (opcional, recomendado)

## Inicio rápido con Docker

```bash
docker-compose up
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Desarrollo local

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Editar .env y definir SECRET_KEY

uvicorn app.main:app --reload
```

Seed de datos de ejemplo:

```bash
python seed.py
```

### Frontend

```bash
cd frontend
npm install

# Crear .env.local con:
# NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

npm run dev
```

## Variables de entorno principales

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de la base de datos | `sqlite:///./deporte.db` |
| `SECRET_KEY` | Clave secreta para JWT | `tu-secreto-seguro` |
| `GROQ_API_KEY` | API key para asistente táctico IA | `gsk_...` |
| `NEXT_PUBLIC_API_URL` | URL del backend (frontend) | `http://localhost:8000/api/v1` |

## Estructura del proyecto

```
Deporte/
├── backend/          # API FastAPI
├── frontend/         # Aplicación web Next.js
├── mobile/           # App móvil Expo
├── docker-compose.yml
└── README.md
```

## Roles de usuario

- **Administrador**: Acceso total
- **Entrenador**: Jugadores, partidos, entrenamiento, táctica
- **Kinesiólogo**: Lesiones, kinesiología, wellness
- **Analista**: Analytics, predicciones, partidos

## Licencia

Proyecto privado — Deporte FC.
