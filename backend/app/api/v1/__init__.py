from fastapi import APIRouter
from .endpoints import auth, users, players, categories, kinesiology, injuries, matches, training, predictions, analytics, wellness, tactical, ai_tactical, notifications, email_alerts

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(users.router, prefix="/users", tags=["Usuarios"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categorías"])
api_router.include_router(players.router, prefix="/players", tags=["Jugadores"])
api_router.include_router(kinesiology.router, prefix="/kinesiology", tags=["Kinesiología"])
api_router.include_router(injuries.router, prefix="/injuries", tags=["Lesiones"])
api_router.include_router(matches.router, prefix="/matches", tags=["Partidos"])
api_router.include_router(training.router, prefix="/training", tags=["Entrenamiento"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["Predicciones ML"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(wellness.router, prefix="/wellness", tags=["Wellness"])
api_router.include_router(tactical.router, prefix="/tactical", tags=["Pizarra Táctica"])
api_router.include_router(ai_tactical.router, prefix="/tactical", tags=["Asistente IA"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notificaciones"])
api_router.include_router(email_alerts.router, prefix="/alerts", tags=["Alertas Email"])
