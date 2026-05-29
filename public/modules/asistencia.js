async function renderAsistencia() {
  const c = document.getElementById('content');
  const [personal, proyectos] = await Promise.all([api('GET','/api/personal'), api('GET','/api/proyectos')]);
  let fechaSel = hoy(), proySel = '';

  async function renderDia() {
    const params = new URLSearchParams({ fecha: fechaSel });
    if (proySel) params.set('proyecto_id', proySel);
    const asistencia = await api('GET', '/api/asistencia?' + params);
    const asistMap = {};
    asistencia.forEach(a => asistMap[a.personal_id] = a);
    let filtP = proySel ? personal.filter(p=>String(p.proyecto_id)===proySel) : personal;
    const presentes  = asistencia.filter(a=>a.estado==='presente').length;
    const ausentes   = asistencia.filter(a=>a.estado==='ausente').length;
    const medioDia   = asistencia.filter(a=>a.estado==='medio-dia').length;

    c.innerHTML = `
      <div class="section-header">
        <h2>Control de Asistencia</h2>
        <button class="btn btn-primary" onclick="_guardarAsist()">💾 Guardar Todo</button>
      </div>
      <div class="filters">
        <input type="date" id="as-fecha" value="${fechaSel}" onchange="_cambFecha(this.value)">
        <select id="as-proy" onchange="_cambProy(this.value)">
          <option value="">Todos los proyectos</option>
          ${proyectos.map(p=>`<option value="${p.id}" ${proySel===String(p.id)?'selected':''}>${p.nombre}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap">
        <div class="card" style="padding:12px 18px;min-width:120px">
          <div class="card-title">Presentes</div><div class="card-value text-success">${presentes}</div>
        </div>
        <div class="card" style="padding:12px 18px;min-width:120px">
          <div class="card-title">Medio día</div><div class="card-value text-warning">${medioDia}</div>
        </div>
        <div class="card" style="padding:12px 18px;min-width:120px">
          <div class="card-title">Ausentes</div><div class="card-value text-danger">${ausentes}</div>
        </div>
        <div class="card" style="padding:12px 18px;min-width:120px">
          <div class="card-title">Sin registrar</div><div class="card-value text-muted">${filtP.length - presentes - ausentes - medioDia}</div>
        </div>
      </div>
      <div class="asist-grid">
        ${filtP.map(p=>{
          const reg=asistMap[p.id];
          const est=reg?reg.estado:'';
          return `<div class="asist-card" data-id="${p.id}" data-proy="${p.proyecto_id}">
            <div><div class="asist-nombre">${p.nombre}</div>
              <div class="asist-cargo">${p.cargo||'Sin cargo'} · ${p.proyecto_nombre||'-'}</div>
            </div>
            <div class="asist-controls">
              <button class="asist-btn ${est==='presente'?'selected-presente':''}" data-estado="presente" onclick="selAsist(this)">✅ Presente</button>
              <button class="asist-btn ${est==='medio-dia'?'selected-medio-dia':''}" data-estado="medio-dia" onclick="selAsist(this)">🌗 Medio</button>
              <button class="asist-btn ${est==='ausente'?'selected-ausente':''}" data-estado="ausente" onclick="selAsist(this)">❌ Ausente</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  window._cambFecha = v => { fechaSel=v; renderDia(); };
  window._cambProy  = v => { proySel=v;  renderDia(); };

  window.selAsist = (btn) => {
    const card=btn.closest('.asist-card');
    card.querySelectorAll('.asist-btn').forEach(b=>b.className='asist-btn');
    btn.classList.add('selected-'+btn.dataset.estado);
  };

  window._guardarAsist = async () => {
    const cards = document.querySelectorAll('.asist-card');
    const reqs = [];
    cards.forEach(card => {
      const sel = card.querySelector('.asist-btn[class*="selected-"]');
      if (sel) {
        const est = sel.dataset.estado;
        reqs.push(api('POST','/api/asistencia',{
          personal_id: card.dataset.id, proyecto_id: card.dataset.proy,
          fecha: fechaSel, estado: est,
          horas: est==='presente'?8:est==='medio-dia'?4:0,
        }));
      }
    });
    await Promise.all(reqs);
    toast(`${reqs.length} registros guardados`, 'success');
    renderDia();
  };

  renderDia();
}
