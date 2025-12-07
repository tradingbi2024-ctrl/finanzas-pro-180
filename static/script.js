// static/script.js

// ---------------------------------------------------------------------
//  HELPERS
// ---------------------------------------------------------------------
function $(id) {
  return document.getElementById(id);
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

let incomeChart = null;
let savingChart = null;

// ---------------------------------------------------------------------
//  INICIALIZACIÓN
// ---------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Fechas por defecto
  if ($("income-date")) $("income-date").value = todayISO();
  if ($("saving-deposit-date")) $("saving-deposit-date").value = todayISO();

  setupHandlers();
  refreshState();
});

// ---------------------------------------------------------------------
//  EVENTOS
// ---------------------------------------------------------------------
function setupHandlers() {
  const btnCat = $("btn-add-category");
  if (btnCat) {
    btnCat.addEventListener("click", async () => {
      const name = $("category-name").value.trim();
      const target = parseFloat($("category-target").value || "0");
      if (!name || target <= 0) {
        $("category-status").textContent =
          "Ingresa un nombre y un monto mensual válido.";
        return;
      }

      const res = await fetch("/api/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, monthly_target: target }),
      });
      const data = await res.json();
      if (data.ok) {
        $("category-status").textContent = "Categoría guardada.";
        $("category-name").value = "";
        $("category-target").value = "";
        refreshState();
      } else {
        $("category-status").textContent =
          data.error || "Error al guardar categoría.";
      }
    });
  }

  const btnIncome = $("btn-add-income");
  if (btnIncome) {
    btnIncome.addEventListener("click", async () => {
      const amount = parseFloat($("income-amount").value || "0");
      const date = $("income-date").value || todayISO();
      if (amount <= 0) {
        $("income-status").textContent =
          "Ingresa un monto de ingreso válido.";
        return;
      }

      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, date }),
      });
      const data = await res.json();
      if (data.ok) {
        $("income-status").textContent = "Ingreso registrado.";
        $("income-amount").value = "";
        refreshState();
      } else {
        $("income-status")..textContent =
          data.error || "Error al registrar ingreso.";
      }
    });
  }

  const btnSavingGoal = $("btn-add-saving-goal");
  if (btnSavingGoal) {
    btnSavingGoal.addEventListener("click", async () => {
      const name = $("saving-name").value.trim();
      const target = parseFloat($("saving-target").value || "0");
      const deadline = $("saving-deadline").value || null;

      if (!name || target <= 0) {
        $("saving-goal-status").textContent =
          "Ingresa un nombre y un monto objetivo válido.";
        return;
      }

      const res = await fetch("/api/saving_goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, target_amount: target, deadline }),
      });
      const data = await res.json();
      if (data.ok) {
        $("saving-goal-status").textContent = "Meta de ahorro creada.";
        $("saving-name").value = "";
        $("saving-target").value = "";
        $("saving-deadline").value = "";
        refreshState();
      } else {
        $("saving-goal-status").textContent =
          data.error || "Error al crear meta de ahorro.";
      }
    });
  }

  const btnSavingDeposit = $("btn-add-saving-deposit");
  if (btnSavingDeposit) {
    btnSavingDeposit.addEventListener("click", async () => {
      const goalId = parseInt($("saving-goal-select").value || "0", 10);
      const amount = parseFloat($("saving-deposit-amount").value || "0");
      const date = $("saving-deposit-date").value || todayISO();

      if (!goalId || amount <= 0) {
        $("saving-deposit-status").textContent =
          "Selecciona una meta y un monto válido.";
        return;
      }

      const res = await fetch("/api/saving_deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: goalId, amount, date }),
      });
      const data = await res.json();
      if (data.ok) {
        $("saving-deposit-status").textContent = "Aporte registrado.";
        $("saving-deposit-amount").value = "";
        refreshState();
      } else {
        $("saving-deposit-status").textContent =
          data.error || "Error al registrar aporte.";
      }
    });
  }
}

// ---------------------------------------------------------------------
//  REFRESCAR ESTADO COMPLETO
// ---------------------------------------------------------------------
async function refreshState() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();
    if (!data.ok) return;

    // --- Verso ---
    if (data.verse) {
      $("bible-verse-text").textContent = `"${data.verse.text}"`;
      $("bible-verse-ref").textContent = data.verse.ref;
    }

    const s = data.summary;

    // --- Resumen del mes ---
    $("summary-month-target").textContent =
      "$ " + Math.round(s.month_target).toLocaleString();
    $("summary-month-income").textContent =
      "$ " + Math.round(s.month_income_real).toLocaleString();
    $("summary-daily-target").textContent =
      "$ " + Math.round(s.daily_target).toLocaleString();
    $("summary-avg-daily").textContent =
      "$ " + Math.round(s.avg_daily_real).toLocaleString();
    $("summary-projected-year").textContent =
      "$ " + Math.round(s.projected_year_income).toLocaleString();

    $("coach-month-message").textContent = s.month_message;
    $("coach-day-message").textContent = s.day_message;

    // --- Categorías ---
    renderCategoriesTable(data.categories);

    // --- Ahorro ---
    renderSavingState(data.saving);
    fillSavingOptions(data.saving);

    // --- Gráficas ---
    renderIncomeChart(s);
    renderSavingChart(data.saving);
  } catch (err) {
    console.error("Error al refrescar estado:", err);
  }
}

// ---------------------------------------------------------------------
//  TABLA DE CATEGORÍAS
// ---------------------------------------------------------------------
function renderCategoriesTable(categories) {
  const tbody = $("categories-table").querySelector("tbody");
  tbody.innerHTML = "";

  if (!categories || categories.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = "Aún no has configurado categorías.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  categories.forEach((c) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = c.name;
    tr.appendChild(tdName);

    const tdMeta = document.createElement("td");
    tdMeta.textContent = "$ " + Math.round(c.meta_mes).toLocaleString();
    tr.appendChild(tdMeta);

    const tdReal = document.createElement("td");
    tdReal.textContent =
      "$ " + Math.round(c.real_mes_estimado).toLocaleString();
    tr.appendChild(tdReal);

    const tdPct = document.createElement("td");
    tdPct.textContent = c.porcentaje.toFixed(1) + " %";
    tr.appendChild(tdPct);

    const tdEstado = document.createElement("td");
    tdEstado.textContent = c.estado;
    tdEstado.classList.add("estado-" + estadoClass(c.estado));
    tr.appendChild(tdEstado);

    const tdDiario = document.createElement("td");
    tdDiario.textContent =
      "$ " + Math.round(c.diario_sugerido).toLocaleString();
    tr.appendChild(tdDiario);

    const tdAcc = document.createElement("td");
    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Editar";
    btnEdit.classList.add("btn-table", "btn-edit");
    btnEdit.addEventListener("click", () => editCategory(c));

    const btnDel = document.createElement("button");
    btnDel.textContent = "Borrar";
    btnDel.classList.add("btn-table", "btn-delete");
    btnDel.addEventListener("click", () => deleteCategory(c.id));

    tdAcc.appendChild(btnEdit);
    tdAcc.appendChild(btnDel);
    tr.appendChild(tdAcc);

    tbody.appendChild(tr);
  });
}

function estadoClass(text) {
  const t = text.toLowerCase();
  if (t.includes("muy por debajo")) return "riesgo-alto";
  if (t.includes("por debajo")) return "riesgo-medio";
  if (t.includes("en línea")) return "ok";
  if (t.includes("por encima")) return "excelente";
  return "neutral";
}

async function editCategory(c) {
  const nuevoNombre = prompt("Nuevo nombre de la categoría:", c.name);
  if (nuevoNombre === null) return;

  const nuevaMetaStr = prompt(
    "Nueva meta mensual:",
    String(Math.round(c.meta_mes))
  );
  if (nuevaMetaStr === null) return;
  const nuevaMeta = parseFloat(nuevaMetaStr || "0");
  if (!nuevoNombre.trim() || nuevaMeta <= 0) return;

  const res = await fetch(`/api/category/${c.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nuevoNombre.trim(),
      monthly_target: nuevaMeta,
    }),
  });
  const data = await res.json();
  if (data.ok) {
    refreshState();
  }
}

async function deleteCategory(id) {
  const ok = confirm(
    "¿Seguro que deseas borrar esta categoría? Se perderá su configuración."
  );
  if (!ok) return;

  const res = await fetch(`/api/category/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (data.ok) {
    refreshState();
  }
}

// ---------------------------------------------------------------------
//  ESTADO DE AHORRO
// ---------------------------------------------------------------------
function renderSavingState(saving) {
  const list = $("saving-state-list");
  list.innerHTML = "";

  if (!saving || saving.length === 0) {
    list.textContent = "Aún no has creado metas de ahorro.";
    return;
  }

  saving.forEach((g) => {
    const div = document.createElement("div");
    div.classList.add("saving-item");

    const title = document.createElement("div");
    title.classList.add("saving-item-title");
    title.textContent = g.name;
    div.appendChild(title);

    const info = document.createElement("div");
    info.classList.add("saving-item-info");
    info.innerHTML = `
      Meta: <strong>$ ${Math.round(g.meta).toLocaleString()}</strong><br>
      Acumulado: <strong>$ ${Math.round(g.acumulado).toLocaleString()}</strong>
      (${g.porcentaje.toFixed(1)}%)<br>
      ${
        g.dias_restantes != null
          ? "Días restantes: <strong>" + g.dias_restantes + "</strong><br>"
          : ""
      }
      Diario sugerido: <strong>$ ${Math.round(
        g.diario_sugerido
      ).toLocaleString()}</strong>
    `;
    div.appendChild(info);

    const msg = document.createElement("div");
    msg.classList.add("saving-item-msg");
    msg.textContent = g.mensaje;
    div.appendChild(msg);

    list.appendChild(div);
  });
}

function fillSavingOptions(saving) {
  const sel = $("saving-goal-select");
  if (!sel) return;
  sel.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Selecciona una meta";
  sel.appendChild(opt0);

  if (!saving) return;

  saving.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    sel.appendChild(opt);
  });
}

// ---------------------------------------------------------------------
//  GRÁFICAS
// ---------------------------------------------------------------------
function renderIncomeChart(summary) {
  const ctx = $("incomeChart");
  if (!ctx) return;

  const monthTarget = summary.month_target;
  const projectedMonth = summary.projected_month_income;
  const real = summary.month_income_real;

  const labels = ["Meta mes", "Proyección mes", "Real acumulado"];

  const data = {
    labels,
    datasets: [
      {
        label: "Montos",
        data: [monthTarget, projectedMonth, real],
      },
    ],
  };

  if (incomeChart) {
    incomeChart.data = data;
    incomeChart.update();
  } else {
    incomeChart = new Chart(ctx, {
      type: "bar",
      data,
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            ticks: {
              callback: (value) =>
                "$ " + Number(value).toLocaleString("es-CO"),
            },
          },
        },
      },
    });
  }
}

function renderSavingChart(saving) {
  const ctx = $("savingChart");
  if (!ctx) return;

  if (!saving || saving.length === 0) {
    if (savingChart) {
      savingChart.destroy();
      savingChart = null;
    }
    return;
  }

  const labels = saving.map((g) => g.name);
  const dataPct = saving.map((g) => g.porcentaje);

  const data = {
    labels,
    datasets: [
      {
        label: "% avance",
        data: dataPct,
      },
    ],
  };

  if (savingChart) {
    savingChart.data = data;
    savingChart.update();
  } else {
    savingChart = new Chart(ctx, {
      type: "bar",
      data,
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            min: 0,
            max: 120,
            ticks: { callback: (v) => v + "%" },
          },
        },
      },
    });
  }
}
