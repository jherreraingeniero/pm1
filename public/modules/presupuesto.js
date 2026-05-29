async function renderPresupuesto() {
  const c = document.getElementById('content');
  const proyectos = await api('GET', '/api/proyectos');

  let selId = window._presFP || (proyectos[0]?.id || '');

  async function renderProy(id) {
    if (!id) { c.innerHTML = emptyState('📊', 'No hay proyectos'); return; }
    const d = await api('GET', `/api/presupuesto/${id}`);
    const pct = d.porcentajeUtilizado;
    const barCls = pct >= 90 ? 'low' : pct >= 70 ? 'mid' : 'high';

    c.innerHTML = `
      <div class="section-header">
        <h2>Control de Presupuesto</h2>
      </div>
      <div class="filters">
        <select id="pres-fp" onchange="_cambPres(this.value)">
          ${proyectos.map(p=>`<option value="${p.id}" ${p.id==id?'selected':''}>${p.nombre}</option>`).join('')}
        </select>
      </div>
      ${d.sobrecosto ? `<div class="sobrecosto-banner">🚨 ¡SOBRECOSTO DETECTADO! El gasto ejecutado supera el presupuesto en ${fmt(Math.abs(d.diferencia))}</div>` : ''}
      <div class="grid-2">
        <div class="card">
          <div class="card-title">Resumen Financiero</div>
          <div style="margin-top:12px">
            <div class="budget-row">
              <span>📋 Presupuesto total</span>
              <span class="fw-bold">${fmt(d.presupuesto)}</span>
            </div>
            <div class="budget-row">
              <span>📐 Costo planificado (actividades)</span>
              <span>${fmt(d.costoPlanActs)}</span>
            </div>
            <div class="budget-row">
              <span>⚙️ Costo ejecutado (actividades)</span>
              <span>${fmt(d.costoEjecActs)}</span>
            </div>
            <div class="budget-row">
              <span>🧱 Materiales usados</span>
              <span>${fmt(d.costoMateriales)}</span>
            </div>
            <div class="budget-row">
              <span>🤝 Subcontratos totales</span>
              <span>${fmt(d.subcontratos)}</span>
            </div>
            <div class="budget-row">
              <span>💳 Total comprometido (pagos)</span>
              <span>${fmt(d.comprometido)}</span>
            </div>
            <div class="budget-row">
              <span>✅ Total pagado</span>
              <span class="text-success fw-bold">${fmt(d.pagado)}</span>
            </div>
            <div class="budget-row total ${d.sobrecosto?'sobrecosto':''}">
              <span>${d.sobrecosto?'🚨 Sobrecosto':'✅ Saldo disponible'}</span>
              <span class="${d.sobrecosto?'text-danger':'text-success'}">${fmt(Math.abs(d.diferencia))}</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Uso del Presupuesto — ${pct}%</div>
          <div class="chart-wrap mt-16"><canvas id="chartPres"></canvas></div>
          <div style="margin-top:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:.85rem">Ejecutado vs Presupuesto</span>
              <span class="fw-bold">${pct}%</span>
            </div>
            <div class="progress-bar-wrap" style="height:12px">
              <div class="progress-bar ${barCls}" style="width:${Math.min(100,pct)}%"></div>
            </div>
          </div>
        </div>
      </div>`;

    destroyChart('pres');
    const labels = ['Ejecutado Actividades','Materiales Usados','Saldo Restante'];
    const ejec = fmtRaw(d.costoEjecActs);
    const mats = fmtRaw(d.costoMateriales);
    const saldo = Math.max(0, fmtRaw(d.presupuesto - d.costoEjecActs - d.costoMateriales));
    charts['pres'] = new Chart(document.getElementById('chartPres'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data:[ejec,mats,saldo], backgroundColor:['#dc2626','#f59e0b','#16a34a'], borderWidth:2 }]
      },
      options: { responsive:true, maintainAspectRatio:false, cutout:'60%',
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12, font:{ size:11 } } } } }
    });
  }

  window._cambPres = (id) => { window._presFP=id; selId=id; renderProy(id); };
  renderProy(selId);
}
