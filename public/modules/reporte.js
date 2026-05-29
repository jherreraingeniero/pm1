async function renderReporte() {
  const c = document.getElementById('content');
  const proyectos = await api('GET', '/api/proyectos');
  const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');
  let selId = window._repFP || (proyectos[0]?.id || '');

  async function mostrar(pid) {
    if (!pid) return;
    const d = await api('GET', `/api/reporte-cliente/${pid}`);
    const p = d.proyecto;
    const estBadge = p.estado==='activo'?'badge-success':p.estado==='finalizado'?'badge-gray':'badge-warning';
    const url = `${window.location.origin}/reporte-cliente?id=${pid}`;

    const actCompletadas = d.actividades.filter(a=>a.estado==='completado').length;
    const actTotal = d.actividades.length;

    c.innerHTML = `
      <div class="section-header">
        <h2>Reporte para Cliente</h2>
      </div>
      <div class="filters">
        <select id="rep-fp" onchange="_cambRep(this.value)">
          ${proyectos.map(pr=>`<option value="${pr.id}" ${pr.id==pid?'selected':''}>${pr.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="share-bar">
        <span class="upload-icon" style="font-size:1rem">🔗</span>
        <span class="share-url">${url}</span>
        <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('URL copiada','success'))">📋 Copiar</button>
        <a href="${url}" target="_blank" class="btn btn-primary btn-sm">👁️ Abrir</a>
      </div>
      <div class="reporte-preview">
        <div class="reporte-header">
          <h1>${p.nombre}</h1>
          <p>${p.descripcion||''}</p>
          <p style="margin-top:6px;opacity:.65;font-size:.8rem">
            ${p.ubicacion||''} · ${fmtFecha(p.fecha_inicio)} → ${fmtFecha(p.fecha_fin)}
            ${p.cliente_nombre?` · Cliente: ${p.cliente_nombre}`:''}
          </p>
        </div>
        <div class="reporte-body">
          <div class="reporte-kpi-row">
            <div class="reporte-kpi">
              <div class="kpi-v">${d.avance}%</div>
              <div class="kpi-l">Avance general</div>
            </div>
            <div class="reporte-kpi">
              <div class="kpi-v">${actCompletadas}/${actTotal}</div>
              <div class="kpi-l">Actividades completadas</div>
            </div>
            <div class="reporte-kpi">
              <div class="kpi-v"><span class="badge ${estBadge}">${p.estado}</span></div>
              <div class="kpi-l">Estado del proyecto</div>
            </div>
            <div class="reporte-kpi">
              <div class="kpi-v">${d.fotos.length}</div>
              <div class="kpi-l">Fotos de avance</div>
            </div>
          </div>

          ${d.actividades.length?`
          <div class="reporte-section">
            <h3>Avance de Actividades</h3>
            ${d.actividades.map(a=>{
              const pct=a.cantidad_planificada>0?Math.min(100,Math.round(a.cantidad_ejecutada/a.cantidad_planificada*100)):0;
              const cls=pct>=100?'high':pct>=50?'mid':'low';
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:3px">
                  <span>${a.nombre} <span style="font-size:.75rem;color:var(--text-muted)">(${a.unidad})</span></span>
                  <span class="fw-bold">${pct}%</span>
                </div>
                <div class="progress-bar-wrap"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>
              </div>`;
            }).join('')}
          </div>`:''}

          ${d.fotos.length?`
          <div class="reporte-section">
            <h3>Registro Fotográfico</h3>
            <div class="reporte-fotos">
              ${d.fotos.slice(0,12).map(f=>`
                <div class="reporte-foto">
                  <img src="${f.url}" alt="${f.comentario||''}" onclick="openLightbox('${f.url}')" style="cursor:pointer">
                  <p>${fmtFecha(f.fecha)}${f.comentario?' · '+f.comentario:''}</p>
                </div>`).join('')}
            </div>
          </div>`:''}

          ${d.bitacora.length?`
          <div class="reporte-section">
            <h3>Novedades Recientes</h3>
            ${d.bitacora.slice(0,5).map(b=>`
              <div style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div class="fw-bold" style="font-size:.87rem;margin-bottom:3px">📅 ${fmtFecha(b.fecha)}</div>
                ${b.actividades_dia?`<div style="font-size:.84rem">${b.actividades_dia}</div>`:''}
                ${b.observaciones?`<div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${b.observaciones}</div>`:''}
              </div>`).join('')}
          </div>`:''}
        </div>
      </div>`;
  }

  window._cambRep = v => { window._repFP=v; selId=v; mostrar(v); };
  mostrar(selId);
}
