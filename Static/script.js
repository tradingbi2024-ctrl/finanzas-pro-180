function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function byId(id) {
  return document.getElementById(id);
}

let incomeChart = null;

async function refreshState() {
  const resp = await fetch("/api/state");
  const data = await resp.json();
  if (!data.ok) return;
  window.FINANZAS_STATE = data.state;
  renderFromState();
}

function renderFromState() {
  const state = window.FINANZAS_STATE;
  if (!state) return;

  // Resumen
  const s = state;
  const resumenEl = byId("summary-text");
  const diagEl = byId("summary-status");

  if (resumenEl) {
    resumenEl.textContent =
      `Mes: ${s.year}-${String(s.month).padStart(2, "0")}\n` +
      `Meta ingreso mensual: $${s.monthly_income_goal.toFixed(0)}\n` +
      `Meta ingreso diario (${s.working_days} días): $${s.daily_income_goal.toFixed(0)}\n` +
      `Ingresos reales del mes: $${s.total_income_month.toFixed(0)}\n` +
      `Ingreso diario promedio real: $${s.real_daily_avg.toFixed(0)}\n` +
      `Proyección anual: $${s.projected_annual_income.toFixed(0)}`;
  }
  if (diagEl) {
    diagEl.textContent = s.income_status;
  }

  // Tabla categorías
  const tbody = byId("categories-table-body");
  if (tbody) {
    tbody.innerHTML = "";
    s.categories.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.name}</td>
        <td>$${c.meta_mes.toFixed(0)}</td>
        <td>$${c.real_mes.toFixed(0)}</td>
        <td>${c.perc.toFixed(1)}%</td>
        <td>${c.estado}</td>
        <td>$${c.diario_sugerido.toFixed(0)}</td>
        <td>
          <button type="button" data-id="${c.id}" class="btn-edit-cat">Editar</button>
          <button type="button" data-id="${c.id}" class="btn-del-cat btn-danger">Borrar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Metas de ahorro
  const savingBody = byId("saving-table-body");
  const savingSelect = byId("saving-select");
  if (savingBody) {
    savingBody.innerHTML = "";
  }
  if (savingSelect) {
    savingSelect.innerHTML = "";
  }

  s.saving_goals.forEach(g => {
    if (savingBody) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${g.name}</td>
        <td>$${g.target.toFixed(0)}</td>
        <td>$${g.real.toFixed(0)}</td>
        <td>${g.perc.toFixed(1)}%</td>
        <td>${g.deadline || ""}</td>
      `;
      savingBody.appendChild(tr);
    }
    if (savingSelect) {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.name;
      savingSelect.appendChild(opt);
    }
  });

  // Gráfico simple: día vs meta diaria vs real promedio
  const ctx = byId("incomeChart");
  if (ctx) {
    const labels = Array.from({ length: s.day_of_month }, (_, i) => i + 1);
    const metaArr = labels.map(() => s.daily_income_goal);
    const realArr = labels.map(() => s.real_daily_avg);

    if (incomeChart) incomeChart.destroy();
    incomeChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Meta diaria", data: metaArr, borderWidth: 2, tension: 0.2 },
          { label: "Promedio real", data: realArr, borderWidth: 2, tension: 0.2 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: "#e5e7eb" } }
        },
        scales: {
          x: { ticks: { color: "#9ca3af" } },
          y: { ticks: { color: "#9ca3af" } }
        }
      }
    });
  }

  // Poner fechas por defecto
  const incomeDate = byId("income-date");
  const savingDate = byId("saving-contrib-date");
  if (incomeDate && !incomeDate.value) incomeDate.value = todayISO();
  if (savingDate && !savingDate.value) savingDate.value = todayISO();
}

function setupForms() {
  const catForm = byId("category-form");
  if (catForm) {
    catForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = byId("cat-id").value;
      const name = byId("cat-name").value;
      const monthly = byId("cat-monthly").value;
      const statusEl = byId("cat-status");

      const action = id ? "update" : "create";
      const resp = await fetch("/api/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id,
          name,
          monthly_goal: monthly
        })
      });
      const data = await resp.json();
      if (!data.ok) {
        statusEl.textContent = "❌ " + (data.error || "Error guardando categoría.");
      } else {
        statusEl.textContent = "✅ Categoría guardada.";
        byId("cat-id").value = "";
        byId("cat-name").value = "";
        byId("cat-monthly").value = "";
        window.FINANZAS_STATE = data.state;
        renderFromState();
      }
    });

    // Delegar clicks en editar / borrar
    document.addEventListener("click", async (e) => {
      if (e.target.classList.contains("btn-edit-cat")) {
        const id = e.target.getAttribute("data-id");
        const state = window.FINANZAS_STATE;
        const cat = state.categories.find(c => String(c.id) === String(id));
        if (!cat) return;
        byId("cat-id").value = cat.id;
        byId("cat-name").value = cat.name;
        byId("cat-monthly").value = cat.meta_mes;
      }
      if (e.target.classList.contains("btn-del-cat")) {
        const id = e.target.getAttribute("data-id");
        const statusEl = byId("cat-status");
        if (!confirm("¿Seguro de borrar esta categoría?")) return;
        const resp = await fetch("/api/category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id })
        });
        const data = await resp.json();
        if (!data.ok) {
          statusEl.textContent = "❌ " + (data.error || "Error eliminando categoría.");
        } else {
          statusEl.textContent = "✅ Categoría eliminada.";
          window.FINANZAS_STATE = data.state;
          renderFromState();
        }
      }
    });
  }

  const incomeForm = byId("income-form");
  if (incomeForm) {
    incomeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dateVal = byId("income-date").value || todayISO();
      const amount = byId("income-amount").value;
      const statusEl = byId("income-status");

      const resp = await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateVal, amount })
      });
      const data = await resp.json();
      if (!data.ok) {
        statusEl.textContent = "❌ " + (data.error || "Error guardando ingreso.");
      } else {
        statusEl.textContent = "✅ Ingreso registrado.";
        byId("income-amount").value = "";
        window.FINANZAS_STATE = data.state;
        renderFromState();
      }
    });
  }

  const savingGoalForm = byId("saving-goal-form");
  if (savingGoalForm) {
    savingGoalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = byId("saving-name").value;
      const target = byId("saving-target").value;
      const deadline = byId("saving-deadline").value;
      const statusEl = byId("saving-status");

      const resp = await fetch("/api/saving_goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, target, deadline })
      });
      const data = await resp.json();
      if (!data.ok) {
        statusEl.textContent = "❌ " + (data.error || "Error creando meta.");
      } else {
        statusEl.textContent = "✅ Meta creada.";
        byId("saving-name").value = "";
        byId("saving-target").value = "";
        byId("saving-deadline").value = "";
        window.FINANZAS_STATE = data.state;
        renderFromState();
      }
    });
  }

  const savingContribForm = byId("saving-contrib-form");
  if (savingContribForm) {
    savingContribForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const goalId = byId("saving-select").value;
      const dateVal = byId("saving-contrib-date").value || todayISO();
      const amount = byId("saving-contrib-amount").value;
      const statusEl = byId("saving-status");

      const resp = await fetch("/api/saving_contribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: goalId, date: dateVal, amount })
      });
      const data = await resp.json();
      if (!data.ok) {
        statusEl.textContent = "❌ " + (data.error || "Error registrando aporte.");
      } else {
        statusEl.textContent = "✅ Aporte registrado.";
        byId("saving-contrib-amount").value = "";
        window.FINANZAS_STATE = data.state;
        renderFromState();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.FINANZAS_STATE) {
    renderFromState();
  } else {
    refreshState();
  }
  setupForms();
});
