# models.py
from datetime import datetime, date
from db import db


# -----------------------------------------------------------
#  MODELO DE USUARIO
# -----------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    # Para borrar usuarios inactivos
    last_active_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Días laborales del mes
    working_days = db.Column(db.Integer, default=26)

    # Relaciones
    categories = db.relationship("Category", backref="user", cascade="all, delete-orphan")
    incomes = db.relationship("Income", backref="user", cascade="all, delete-orphan")
    saving_goals = db.relationship("SavingGoal", backref="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"


# -----------------------------------------------------------
#  MODELO DE CATEGORÍAS
# -----------------------------------------------------------
class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    monthly_target = db.Column(db.Float, nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))

    def __repr__(self):
        return f"<Category {self.name}>"


# -----------------------------------------------------------
#  MODELO DE INGRESOS DIARIOS
# -----------------------------------------------------------
class Income(db.Model):
    __tablename__ = "incomes"

    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))

    def __repr__(self):
        return f"<Income {self.amount} on {self.date}>"


# -----------------------------------------------------------
#  META DE AHORRO
# -----------------------------------------------------------
class SavingGoal(db.Model):
    __tablename__ = "saving_goals"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    deadline = db.Column(db.Date, nullable=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))

    deposits = db.relationship("SavingDeposit", backref="goal", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SavingGoal {self.name}>"


# -----------------------------------------------------------
#  DEPÓSITOS / APORTES A AHORRO
# -----------------------------------------------------------
class SavingDeposit(db.Model):
    __tablename__ = "saving_deposits"

    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)

    goal_id = db.Column(db.Integer, db.ForeignKey("saving_goals.id"))

    def __repr__(self):
        return f"<SavingDeposit {self.amount}>"
