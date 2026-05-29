async function renderProyectos() {
  const c = document.getElementById('content');
  const [lista, clientes] = await Promise.all([api('GET', '/api/proyectos'), api('GET', '/api/clientes')]);
  const cliOpts = clientes.map(cl => `<option value="${cl.id}">${cl.nombre}${cl.empresa?' – '+cl.empresa:''}</option>`).join('');

  c.innerHTML = `
    <div class="section-header">
      <h2>Proyectos (${lista.length})</h2>
      <button class="btn btn-primary" onclick="_nuevoProy()">+ Nuevo Proyecto</button>
    </div>
    <div class="proyectos-grid">
      ${lista.length ? lista.map(p => proyectoCard(p)).join('') : emptyState('🏢','No hay proyectos aún')}
    </div>`;

  window._nuevoProy = () => openModal('Nuevo Proyecto', formProy({}, cliOpts), async () => {
    const nombre = document.getElementById('fp-nombre').value.trim();
    if (!nombre) return toast('El nombre es obligatorio','error');
    await api('POST','/api/proyectos', recogerProy());
    closeModal(); toast('Proyecto creado','success'); renderProyectos();
  });

  window._editProy = async (id) => {
    const p = lista.find(x=>x.id===id);
    openModal('Editar Proyecto', formProy(p, cliOpts), async () => {
      await api('PUT',`/api/proyectos/${id}`, recogerProy());
      closeModal(); toast('Guardado','success'); renderProyectos();
    });
  };

  window._delProy = async (id) => {
    if (!confirm('¿Eliminar este proyecto?')) return;
    await api('DELETE',`/api/proyectos/${id}`);
    toast('Proyecto eliminado'); renderProyectos();
  };
}

function proyectoCard(p) {
  const badgeCls = p.estado==='activo'?'badge-success':p.estado==='finalizado'?'badge-gray':'badge-warning';
  return `<div class="proyecto-card ${p.estado}">
    <div class="proyecto-card-header">
      <div class="proyecto-nombre">${p.nombre}</div>
      <span class="badge ${badgeCls}">${p.estado}</span>
    </div>
    <div class="proyecto-info">
      ${p.cliente_nombre?`<span>👤 ${p.cliente_nombre}${p.cliente_empresa?' · '+p.cliente_empresa:''}</span>`:''}
      <span>📍 ${p.ubicacion||'Sin ubicación'}</span>
      <span>📅 ${fmtFecha(p.fecha_inicio)} → ${fmtFecha(p.fecha_fin)}</span>
      <span>💰 ${fmt(p.presupuesto)}</span>
      ${p.descripcion?`<span>📝 ${p.descripcion}</span>`:''}
    </div>
    <div class="proyecto-actions">
      <button class="btn btn-secondary btn-sm" onclick="_editProy(${p.id})">✏️ Editar</button>
      <button class="btn btn-danger btn-sm" onclick="_delProy(${p.id})">🗑️</button>
    </div>
  </div>`;
}

function formProy(p={}, cliOpts='') {
  return `<div class="form-grid">
    <div class="form-group full"><label>Nombre *</label>
      <input id="fp-nombre" value="${p.nombre||''}" placeholder="Ej: Edificio Residencial Norte"></div>
    <div class="form-group full"><label>Descripción</label>
      <textarea id="fp-desc">${p.descripcion||''}</textarea></div>
    <div class="form-group full"><label>Ubicación</label>
      <input id="fp-ubic" value="${p.ubicacion||''}" placeholder="Dirección o sector"></div>
    <div class="form-group"><label>Fecha Inicio</label>
      <input id="fp-ini" type="date" value="${p.fecha_inicio||''}"></div>
    <div class="form-group"><label>Fecha Fin</label>
      <input id="fp-fin" type="date" value="${p.fecha_fin||''}"></div>
    <div class="form-group"><label>Presupuesto (COP base)</label>
      <input id="fp-pres" type="number" value="${p.presupuesto||0}"></div>
    <div class="form-group"><label>Estado</label>
      <select id="fp-est">
        <option value="activo" ${p.estado==='activo'?'selected':''}>Activo</option>
        <option value="pausado" ${p.estado==='pausado'?'selected':''}>Pausado</option>
        <option value="finalizado" ${p.estado==='finalizado'?'selected':''}>Finalizado</option>
      </select></div>
    <div class="form-group full"><label>Cliente</label>
      <select id="fp-cli"><option value="">Sin cliente</option>${cliOpts.replace(`value="${p.cliente_id}"`,`value="${p.cliente_id}" selected`)}</select></div>
  </div>`;
}

function recogerProy() {
  return {
    nombre: document.getElementById('fp-nombre').value,
    descripcion: document.getElementById('fp-desc').value,
    ubicacion: document.getElementById('fp-ubic').value,
    fecha_inicio: document.getElementById('fp-ini').value,
    fecha_fin: document.getElementById('fp-fin').value,
    presupuesto: parseFloat(document.getElementById('fp-pres').value)||0,
    estado: document.getElementById('fp-est').value,
    cliente_id: document.getElementById('fp-cli').value||null,
  };
}
