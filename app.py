import os
from datetime import timedelta, datetime

from flask import Flask, redirect, url_for, session, g
from db import init_db, db
from models import User
from auth import auth_bp
from finance import finance_bp


def create_app():
    app = Flask(__name__)

    # ===========================
    # CONFIGURACIÓN GENERAL
    # ===========================
    app.config["SECRET_KEY"] = os.getenv(
        "SECRET_KEY",
        "super-clave-segura-finanzas-180"
    )
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)

    # ===========================
    # CONFIGURACIÓN BASE DE DATOS
    # ===========================

    # URL de tu base en Render (valor por defecto)
    default_db_url = (
        "postgresql://postgresql15_mw9q_user:"
        "eRr1W7j2dV73PX5ouM9gp3SMwXDnxI5r"
        "@dpg-d4qb8cqli9vc739r29ig-a/postgresql15_mw9q"
    )

    # Toma la variable DATABASE_URL si Render la provee
    db_url = os.getenv("DATABASE_URL", default_db_url)

    # Render usa a veces postgres:// → convertirlo a postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    # 🔥 SOLUCIÓN DEFINITIVA:
    # Forzar SQLAlchemy a usar psycopg3 y NO psycopg2
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://")

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Inicializar la BD
    init_db(app)

    # ===========================
    # BLUEPRINTS
    # ===========================
    app.register_blueprint(auth_bp)
    app.register_blueprint(finance_bp)

    # ===========================
    # MIDDLEWARE
    # ===========================
    @app.before_request
    def load_current_user_and_cleanup():
        """
        - Carga el usuario activo en g.user
        - Actualiza última actividad
        - Ejecuta limpieza automática de inactivos
        """
        user_id = session.get("user_id")
        g.user = None

        if user_id is not None:
            user = User.query.get(user_id)
            if user:
                g.user = user
                user.last_active_at = datetime.utcnow()
                db.session.commit()

        cleanup_inactive_users()

    # ===========================
    # RUTAS PRINCIPALES
    # ===========================
    @app.route("/")
    def index():
        # Si está logueado → dashboard
        if g.user:
            return redirect(url_for("finance.dashboard"))

        # Si no hay usuarios en la BD → primer registro = admin
        return redirect(url_for("auth.login"))

    return app


# ===========================
# FUNCIÓN DE LIMPIEZA AUTOMÁTICA
# ===========================

def cleanup_inactive_users():
    """Elimina usuarios con más de 30 días sin actividad."""
    limite = datetime.utcnow() - timedelta(days=30)

    usuarios_antiguos = User.query.filter(
        User.last_active_at < limite
    ).all()

    if usuarios_antiguos:
        for u in usuarios_antiguos:
            db.session.delete(u)
        db.session.commit()


# ===========================
# CREAR INSTANCIA GLOBAL
# ===========================

app = create_app()


# ===========================
# MODO LOCAL
# ===========================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
