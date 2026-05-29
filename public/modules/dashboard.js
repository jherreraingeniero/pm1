async function renderDashboard() {
  const c = document.getElementById('content');
  c.innerHTML = '<p class="text-muted" style="padding:20px">Cargando...</p>';
  const d = await api('GET', '/api/dashboard');

  // Alertas de pagos con más de 7 días sin pagar
  const alertasHTML = d.alertas && d.alertas.length
    ? `<div class="alerts-container">
        ${d.alertas.map(a => {
          const dias = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000);
          const cls = a.estado === 'vencido' ? 'danger' : '';
          return `<div class="alert-item ${cls}">
            <span class="alert-icon">⚠️</span>
            <div class="alert-text">
              <strong>${a.concepto} — ${a.proyecto_nombre}</strong>
              <span>${fmt(a.monto)} · ${a.estado === 'vencido' ? 'Vencido' : 'Pendiente'} hace ${dias} días · Benef: ${a.beneficiario || '-'}</span>
            </div>
            <button class="btn btn-sm" style="background:#dcfce7;color:#15803d;border:1px solid #16a34a;white-space:nowrap"
              onclick="marcarPagoAlert(${a.id})">✅ Pagar</button>
          </div>`;
        }).join('')}
      </div>` : '';

  c.innerHTML = `
    ${alertasHTML}
    <div class="stats-row">
      <div class="card metric-card info">
        <div class="card-title">Proyectos activos</div>
        <div class="card-value">${d.activos}<span style="font-size:1rem;color:var(--text-muted)">/${d.totalProyectos}</span></div>
        <div class="card-sub">Total proyectos</div>
      </div>
      <div class="card metric-card success">
        <div class="card-title">Avance global</div>
        <div class="card-value">${d.avanceTotal}%</div>
        <div class="card-sub">Promedio actividades</div>
      </div>
      <div class="card metric-card">
        <div class="card-title">Personal hoy</div>
        <div class="card-value">${d.personalHoy}</div>
        <div class="card-sub">Presentes</div>
      </div>
      <div class="card metric-card warning">
        <div class="card-title">Por pagar</div>
        <div class="card-value" style="font-size:1.2rem">${fmt(d.pagosPendientes)}</div>
        <div class="card-sub text-danger">${fmt(d.pagosVencidos)} vencidos</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">Avance por proyecto (%)</div>
        <div class="chart-wrap mt-16"><canvas id="chartAvance"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Presupuesto vs Ejecutado</div>
        <div class="chart-wrap mt-16"><canvas id="chartPresupuesto"></canvas></div>
      </div>
    </div>

    <div class="grid-2 mt-16">
      <div class="card">
        <div class="card-title">Estado de actividades</div>
        <div style="display:flex;align-items:center;gap:20px">
          <div style="flex:0 0 140px;height:140px"><canvas id="chartActividades"></canvas></div>
          <div style="display:flex;flex-direction:column;gap:10px;flex:1">
            ${estadoItem('✅ Completadas', d.actividadesPorEstado.completado, 'badge-success')}
            ${estadoItem('🔄 En Progreso', d.actividadesPorEstado.en_progreso, 'badge-info')}
            ${estadoItem('⏳ Pendientes',  d.actividadesPorEstado.pendiente,   'badge-gray')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Avance detallado por proyecto</div>
        <div class="avance-list mt-16">
          ${d.avancePorProyecto.map(p => {
            const cls = p.avance >= 70 ? 'high' : p.avance >= 40 ? 'mid' : 'low';
            const badge = p.estado === 'activo' ? 'badge-success' : p.estado === 'finalizado' ? 'badge-gray' : 'badge-warning';
            const lbl   = p.estado === 'activo' ? 'Activo' : p.estado === 'finalizado' ? 'Finalizado' : 'Pausado';
            return `<div class="avance-item">
              <div class="avance-label">
                <span class="avance-nombre">${p.nombre}</span>
                <span>${p.avance}% <span class="badge ${badge}">${lbl}</span></span>
              </div>
              <div class="progress-bar-wrap"><div class="progress-bar ${cls}" style="width:${p.avance}%"></div></div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Gráfica 1: barras avance
  destroyChart('avance');
  charts['avance'] = new Chart(document.getElementById('chartAvance'), {
    type: 'bar',
    data: {
      labels: d.avancePorProyecto.map(p => p.nombre.length > 20 ? p.nombre.slice(0,20)+'…' : p.nombre),
      datasets: [{
        label: 'Avance %', data: d.avancePorProyecto.map(p => p.avance),
        backgroundColor: d.avancePorProyecto.map(p => p.avance>=70?'#16a34a':p.avance>=40?'#f59e0b':'#dc2626'),
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { max: 100, ticks: { callback: v => v + '%' } } }
    }
  });

  // Gráfica 2: presupuesto vs ejecutado
  destroyChart('presupuesto');
  charts['presupuesto'] = new Chart(document.getElementById('chartPresupuesto'), {
    type: 'bar',
    data: {
      labels: d.avancePorProyecto.map(p => p.nombre.length > 20 ? p.nombre.slice(0,20)+'…' : p.nombre),
      datasets: [
        {
          label: 'Presupuesto', data: d.avancePorProyecto.map(p => fmtRaw(p.presupuesto)),
          backgroundColor: 'rgba(37,99,235,.25)', borderColor: '#2563eb', borderWidth: 2, borderRadius: 4,
        },
        {
          label: 'Ejecutado', data: d.avancePorProyecto.map(p => fmtRaw(p.costoEjec)),
          backgroundColor: 'rgba(22,163,74,.4)', borderColor: '#16a34a', borderWidth: 2, borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
      scales: { y: { ticks: { callback: v => {
        const { moneda } = window.CONFIG;
        if (v >= 1e9) return (v/1e9).toFixed(1)+'B';
        if (v >= 1e6) return (v/1e6).toFixed(1)+'M';
        if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
        return v;
      }}} }
    }
  });

  // Gráfica 3: doughnut actividades
  destroyChart('actividades');
  charts['actividades'] = new Chart(document.getElementById('chartActividades'), {
    type: 'doughnut',
    data: {
      labels: ['Completadas', 'En Progreso', 'Pendientes'],
      datasets: [{
        data: [d.actividadesPorEstado.completado, d.actividadesPorEstado.en_progreso, d.actividadesPorEstado.pendiente],
        backgroundColor: ['#16a34a','#2563eb','#94a3b8'],
        borderWidth: 2,
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '65%' }
  });

  window.marcarPagoAlert = async (id) => {
    const pagos = await api('GET', `/api/pagos`);
    const p = pagos.find(x => x.id === id);
    if (p) {
      await api('PUT', `/api/pagos/${id}`, { ...p, estado: 'pagado', fecha_pago: hoy() });
      toast('Pago registrado', 'success');
      renderDashboard();
    }
  };
}

function estadoItem(label, val, cls) {
  return `<div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:.88rem">${label}</span>
    <span class="badge ${cls}">${val}</span>
  </div>`;
}
