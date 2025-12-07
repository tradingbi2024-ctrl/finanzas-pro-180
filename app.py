import os
from datetime import timedelta, datetime

from flask import Flask, redirect, url_for, session, g
from db import init_db, db
from models import User
from auth import auth_bp
from finance import finance_bp


def create_app():
    app = Flask(__name__)

    # Clave para sesiones (puedes cambiarla por otra larga)
    app.config["SECRET_KEY"] = os.getenv(
        "SECRET_KEY",
        "super-clave-segura-finanzas-180"
    )

    # Sesiones duran 7 días
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)

    # Configuración de la base de datos (Render)
    default_db_url = (
        "postgresql://postgresql15_mw9q_user:"
        "eRr1W7j2dV73PX5ouM9gp3SMwXDnxI5r"
        "@dpg-d4qb8cqli9vc739r29ig-a/postgresql15_mw9q"
    )
    db_url = os.getenv("DATABASE_URL", default_db_url)

    # Normalizar postgres:// a postgresql:// por compatibilidad
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Inicializar SQLAlchemy
    init_db(app)

    # Registrar blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(finance_bp)

    @app.before_request
    def load_current_user_and_cleanup():
        """Carga usuario en g.user y limpia cuentas inactivas."""
        user_id = session.get("user_id")
        g.user = None
        if user_id is not None:
            user = User.query.get(user_id)
            if user:
                g.user = user
                # Actualizar última actividad
                user.last_active_at = datetime.utcnow()
                db.session.commit()

        # Limpieza simple de usuarios inactivos (más de 30 días)
        cleanup_inactive_users()

    @app.route("/")
    def index():
        # Si está logueado → dashboard
        if g.user:
            return redirect(url_for("finance.dashboard"))

        # Si NO hay usuarios todavía, el primero que se registre será admin
        return redirect(url_for("auth.login"))

    return app


def cleanup_inactive_users():
    """Borra usuarios con más de 30 días sin actividad."""
    from datetime import timedelta

    límite = datetime.utcnow() - timedelta(days=30)
    usuarios_antiguos = User.query.filter(
        User.last_active_at < límite
    ).all()

    if usuarios_antiguos:
        for u in usuarios_antiguos:
            db.session.delete(u)
        db.session.commit()


app = create_app()

if __name__ == "__main__":
    # Para correr localmente si quieres probar:
    app.run(host="0.0.0.0", port=5000, debug=True)
