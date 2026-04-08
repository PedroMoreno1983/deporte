"""
Script de seeding: crea datos de ejemplo para validar toda la plataforma.
Ejecutar: python seed.py (desde el directorio backend)
"""
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date, timedelta
import random
from app.core.database import SessionLocal, engine
from app.core.database import Base
from app.core import security
from app.models import *
from app.models.injury import BodyZone
from app.models.training import SessionType

Base.metadata.create_all(bind=engine)

db = SessionLocal()

def run():
    print("🌱 Iniciando seeding...")

    # --- Usuarios ---
    users_data = [
        {"email": "admin@deportefc.cl", "full_name": "Admin Sistema", "password": "admin123", "role": UserRole.ADMIN},
        {"email": "entrenador@deportefc.cl", "full_name": "Carlos Rodríguez", "password": "coach123", "role": UserRole.COACH},
        {"email": "kinesiologo@deportefc.cl", "full_name": "María González", "password": "kinesi123", "role": UserRole.KINESIOLOGIST},
        {"email": "analista@deportefc.cl", "full_name": "Luis Fernández", "password": "analyst123", "role": UserRole.ANALYST},
    ]
    users = []
    for u in users_data:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            user = User(
                email=u["email"], full_name=u["full_name"],
                hashed_password=security.get_password_hash(u["password"]),
                role=u["role"]
            )
            db.add(user)
            users.append(user)
    db.commit()
    print(f"  ✅ {len(users_data)} usuarios creados")

    # --- Categorías ---
    cats_data = [
        {"name": "Cadetes", "code": "CAD", "min_age": 14, "max_age": 16, "sort_order": 1},
        {"name": "Sub-17", "code": "U17", "min_age": 15, "max_age": 17, "sort_order": 2},
        {"name": "Sub-20", "code": "U20", "min_age": 18, "max_age": 20, "sort_order": 3},
        {"name": "Reserva", "code": "RES", "min_age": 18, "max_age": 23, "sort_order": 4},
        {"name": "Primera División", "code": "PRD", "min_age": 18, "max_age": 40, "sort_order": 5},
    ]
    categories = []
    for c in cats_data:
        existing = db.query(Category).filter(Category.code == c["code"]).first()
        if not existing:
            cat = Category(**c)
            db.add(cat)
            db.flush()
            categories.append(cat)
        else:
            categories.append(existing)
    db.commit()
    print(f"  ✅ {len(cats_data)} categorías creadas")

    # --- Jugadores ---
    positions = list(PlayerPosition)
    first_names = ["Sebastián", "Ignacio", "Tomás", "Felipe", "Rodrigo", "Diego", "Andrés", "Matías",
                   "Francisco", "Pablo", "Nicolás", "Gabriel", "Cristóbal", "Vicente", "Benjamín",
                   "Alejandro", "Camilo", "Eduardo", "Fernando", "Jorge"]
    last_names = ["González", "Rodríguez", "Muñoz", "Pérez", "Álvarez", "Torres", "Flores", "Castro",
                  "Vargas", "Morales", "Reyes", "Herrera", "Jiménez", "Romero", "Soto"]

    players = []
    for cat in categories:
        count = 22 if cat.code == "PRD" else 16
        for i in range(count):
            player = Player(
                first_name=random.choice(first_names),
                last_name=random.choice(last_names),
                date_of_birth=date.today() - timedelta(days=random.randint(14 * 365, 32 * 365)),
                nationality="Chilena",
                jersey_number=i + 1,
                position=positions[i % len(positions)],
                dominant_foot=random.choice(list(DominantFoot)),
                category_id=cat.id,
                height_cm=random.uniform(165, 195),
                weight_kg=random.uniform(62, 88),
                status=random.choices(
                    list(PlayerStatus),
                    weights=[70, 10, 5, 10, 5]
                )[0],
            )
            db.add(player)
            players.append(player)
    db.commit()
    print(f"  ✅ {len(players)} jugadores creados")

    # --- Registros kinesiológicos ---
    first_category_players = players[:22]
    for player in first_category_players:
        for _ in range(random.randint(2, 4)):
            record = KinesiologyRecord(
                player_id=player.id,
                evaluation_date=date.today() - timedelta(days=random.randint(0, 180)),
                evaluated_by="María González",
                weight_kg=player.weight_kg + random.uniform(-3, 3),
                height_cm=player.height_cm,
                body_fat_percentage=random.uniform(8, 18),
                squat_1rm_kg=random.uniform(80, 160),
                cmj_height_cm=random.uniform(30, 60),
                sj_height_cm=random.uniform(28, 55),
                vo2_max=random.uniform(45, 70),
                sprint_30m_sec=random.uniform(3.8, 4.5),
                sit_and_reach_cm=random.uniform(-5, 25),
                yo_yo_test_level=f"{random.randint(14, 21)}.{random.randint(1, 5)}",
            )
            db.add(record)
    db.commit()
    print(f"  ✅ Registros kinesiológicos creados")

    # --- Lesiones ---
    injury_types = ["Rotura fibrilar", "Esguince de tobillo", "Contractura muscular",
                    "Tendinitis rotuliana", "Lesión menisco", "Pubalgia"]
    zones = list(BodyZone)
    for player in random.sample(players, min(25, len(players))):
        for _ in range(random.randint(0, 3)):
            days_out = random.randint(7, 60)
            inj_date = date.today() - timedelta(days=random.randint(30, 400))
            is_recovered = random.random() > 0.3
            injury = Injury(
                player_id=player.id,
                injury_date=inj_date,
                injury_type=random.choice(injury_types),
                body_zone=random.choice(zones),
                severity=random.choice(list(InjurySeverity)),
                mechanism=random.choice(list(InjuryMechanism)),
                during_match=random.random() > 0.6,
                estimated_days_out=days_out,
                return_date_estimated=inj_date + timedelta(days=days_out),
                actual_days_out=days_out + random.randint(-5, 10) if is_recovered else None,
                is_recovered=is_recovered,
                diagnosed_by="María González",
            )
            db.add(injury)
    db.commit()
    print(f"  ✅ Lesiones creadas")

    # --- Partidos y stats ---
    primera = next((p for p in players if True), None)
    primera_cat = categories[-1]  # Primera División
    primera_players = [p for p in players if p.category_id == primera_cat.id]

    for i in range(20):
        match = Match(
            date=date.today() - timedelta(days=i * 7),
            opponent=random.choice(["Club Deportivo", "Atlético FC", "Sporting CF", "Real SC", "City FC"]),
            is_home=random.random() > 0.5,
            competition=random.choice(["Liga Nacional", "Copa", "Amistoso"]),
            category_id=primera_cat.id,
            goals_for=random.randint(0, 4),
            goals_against=random.randint(0, 3),
        )
        db.add(match)
        db.flush()

        for player in random.sample(primera_players, min(14, len(primera_players))):
            minutes = random.randint(0, 90)
            stat = MatchStat(
                player_id=player.id,
                match_id=match.id,
                minutes_played=minutes,
                started=minutes >= 45,
                rating=random.uniform(5.0, 9.5),
                goals=random.choices([0, 1, 2], weights=[80, 15, 5])[0],
                assists=random.choices([0, 1], weights=[75, 25])[0],
                passes_total=random.randint(20, 80),
                passes_completed=random.randint(15, 75),
                total_distance_m=random.uniform(7000, 12000),
                high_intensity_distance_m=random.uniform(500, 2000),
                sprint_distance_m=random.uniform(200, 800),
                max_speed_kmh=random.uniform(25, 34),
                sprints_count=random.randint(10, 40),
                duels_total=random.randint(5, 20),
                duels_won=random.randint(2, 15),
            )
            db.add(stat)
    db.commit()
    print(f"  ✅ 20 partidos con estadísticas creados")

    # --- Sesiones de entrenamiento con ACWR calculado ---
    for player in primera_players:
        sessions_by_date: dict = {}
        for day in range(90, 0, -1):  # 90 días para poder calcular crónico (28d)
            session_date = date.today() - timedelta(days=day)
            if session_date.weekday() == 6:  # Descanso domingo
                continue
            duration = random.randint(60, 120)
            rpe = random.randint(4, 9)
            load = rpe * duration
            sessions_by_date[session_date] = load

        # Calcular ACWR para cada sesión y guardar
        sorted_dates = sorted(sessions_by_date.keys())
        for session_date in sorted_dates:
            load = sessions_by_date[session_date]
            # Acute (7d)
            acute_dates = [d for d in sorted_dates if timedelta(0) <= (session_date - d) < timedelta(days=7)]
            acute_load = sum(sessions_by_date[d] for d in acute_dates) / 7 if acute_dates else load / 7
            # Chronic (28d)
            chronic_dates = [d for d in sorted_dates if timedelta(0) <= (session_date - d) < timedelta(days=28)]
            chronic_load = sum(sessions_by_date[d] for d in chronic_dates) / 28 if chronic_dates else load / 28
            acwr = round(acute_load / chronic_load, 3) if chronic_load > 0 else 1.0

            session = TrainingSession(
                player_id=player.id,
                session_date=session_date,
                session_type=SessionType.TRAINING if session_date.weekday() < 5 else SessionType.MATCH,
                duration_minutes=duration,
                rpe=rpe,
                session_load=load,
                total_distance_m=random.uniform(5000, 10000),
                high_intensity_distance_m=random.uniform(300, 1500),
                sprint_distance_m=random.uniform(150, 600),
                max_speed_kmh=random.uniform(26, 33),
                sprints_count=random.randint(8, 35),
                acute_load=round(acute_load, 2),
                chronic_load=round(chronic_load, 2),
                acwr=acwr,
                participated=random.random() > 0.05,
            )
            db.add(session)
    db.commit()
    print(f"  ✅ Sesiones de entrenamiento (90 días) con ACWR calculado creadas")

    # --- Wellness ---
    from app.models.wellness import WellnessEntry
    for player in primera_players:
        for day in range(30, 0, -1):
            entry_date = date.today() - timedelta(days=day)
            sleep = random.randint(4, 10)
            fatigue = random.randint(4, 10)
            mood = random.randint(5, 10)
            soreness = random.randint(3, 10)
            stress = random.randint(4, 10)
            wellness_score = round(
                sleep * 0.25 + fatigue * 0.25 + mood * 0.20 + soreness * 0.15 + stress * 0.15, 2
            )
            entry = WellnessEntry(
                player_id=player.id,
                entry_date=entry_date,
                sleep_quality=sleep,
                fatigue=fatigue,
                mood=mood,
                muscle_soreness=soreness,
                stress=stress,
                rpe_post=random.randint(4, 9) if random.random() > 0.3 else None,
                wellness_score=wellness_score,
            )
            db.add(entry)
    db.commit()
    print(f"  ✅ Registros de wellness (30 días × {len(primera_players)} jugadores) creados")

    print("\n✅ Seeding completado exitosamente!")
    print("\nCredenciales de acceso:")
    print("  Admin:      admin@deportefc.cl / admin123")
    print("  Entrenador: entrenador@deportefc.cl / coach123")
    print("  Kinesiólogo: kinesiologo@deportefc.cl / kinesi123")
    print("  Analista:   analista@deportefc.cl / analyst123")

if __name__ == "__main__":
    try:
        run()
    finally:
        db.close()
