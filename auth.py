from datetime import datetime

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    g,
)
from werkzeug.security import generate_password_hash, check_password_hash

from db import db
from models import User

auth_bp = Blueprint("auth", __name__)


def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


def login_required(view):
    def wrapper(*args, **kwargs):
        if not g.user:
            return redirect(url_for("auth.login"))
        return view(*args, **kwargs)

    wrapper.__name__ = view.__name__
    return wrapper


def admin_required(view):
    def wrapper(*args, **kwargs):
        if not g.user or not g.user.is_admin:
            flash("Solo el administrador puede acceder a esta sección.", "danger")
            return redirect(url_for("finance.dashboard"))
        return view(*args, **kwargs)

    wrapper.__name__ = view.__name__
    return wrapper


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "").strip()

        if not name or not email or not password:
            flash("Todos los campos son obligatorios.", "danger")
            return render_template("register.html")

        existing = User.query.filter_by(email=email).first()
        if existing:
            flash("Ya existe un usuario con ese correo.", "danger")
            return render_template("register.html")

        # El PRIMER usuario registrado será administrador
        is_admin = User.query.count() == 0

        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            is_admin=is_admin,
            working_days=26,
            last_login_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
        )
        db.session.add(user)
        db.session.commit()

        flash("Registro exitoso. Ahora puedes iniciar sesión.", "success")
        return redirect(url_for("auth.login"))

    return render_template("register.html")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "").strip()

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            flash("Correo o contraseña incorrectos.", "danger")
            return render_template("login.html")

        # Sesión permanente por 7 días
        session["user_id"] = user.id
        session.permanent = True

        user.last_login_at = datetime.utcnow()
        user.last_active_at = datetime.utcnow()
        db.session.commit()

        return redirect(url_for("finance.dashboard"))

    return render_template("login.html")


@auth_bp.route("/logout")
def logout():
    session.clear()
    flash("Sesión cerrada correctamente.", "info")
    return redirect(url_for("auth.login"))


@auth_bp.route("/account/delete", methods=["POST"])
@login_required
def delete_own_account():
    user = g.user
    db.session.delete(user)
    db.session.commit()
    session.clear()
    flash("Tu perfil y todos tus datos han sido eliminados.", "info")
    return redirect(url_for("auth.login"))


@auth_bp.route("/admin/users")
@admin_required
def admin_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return render_template("admin.html", users=users)


@auth_bp.route("/admin/delete_user/<int:user_id>", methods=["POST"])
@admin_required
def admin_delete_user(user_id):
    if g.user.id == user_id:
        flash("No puedes eliminar tu propio usuario como admin.", "danger")
        return redirect(url_for("auth.admin_users"))

    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    flash("Usuario eliminado correctamente.", "success")
    return redirect(url_for("auth.admin_users"))
