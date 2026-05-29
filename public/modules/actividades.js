async function renderActividades() {
  const c = document.getElementById('content');
  const [acts, proyectos] = await Promise.all([api('GET','/api/actividades'), api('GET','/api/proyectos')]);
  const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');

  function render(lista) {
    const totalPlan = lista.reduce((s,a)=>s+a.costo_unitario*a.cantidad_planificada,0);
    const totalEjec = lista.reduce((s,a)=>s+a.costo_unitario*a.cantidad_ejecutada,0);
    c.innerHTML = `
      <div class="section-header">
        <h2>Actividades (${lista.length})</h2>
        <button class="btn btn-primary" onclick="_newAct()">+ Nueva Actividad</button>
      </div>
      <div class="filters">
        <select id="fa-fp" onchange="_filtAct()"><option value="">Todos los proyectos</option>${pOpts}</select>
        <select id="fa-fe" onchange="_filtAct()">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_progreso">En Progreso</option>
          <option value="completado">Completado</option>
        </select>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Proyecto</th><th>Actividad</th><th>Unidad</th>
            <th>Planificado</th><th>Ejecutado</th><th>Avance</th>
            <th>Costo Unit.</th><th>Total Plan.</th><th>Estado</th><th>Fotos</th><th></th>
          </tr></thead>
          <tbody>
            ${lista.map(a => {
              const pct = a.cantidad_planificada>0 ? Math.min(100,Math.round(a.cantidad_ejecutada/a.cantidad_planificada*100)) : 0;
              const cls = pct>=100?'high':pct>=50?'mid':'low';
              const estCls = {pendiente:'badge-gray',en_progreso:'badge-info',completado:'badge-success'}[a.estado]||'badge-gray';
              const estLbl = {pendiente:'Pendiente',en_progreso:'En Progreso',completado:'Completado'}[a.estado]||a.estado;
              return `<tr>
                <td>${a.proyecto_nombre}</td>
                <td class="fw-bold">${a.nombre}</td>
                <td>${a.unidad}</td>
                <td class="text-right">${fmtNum(a.cantidad_planificada)}</td>
                <td class="text-right">${fmtNum(a.cantidad_ejecutada)}</td>
                <td><div style="display:flex;align-items:center;gap:6px">
                  <div class="progress-bar-wrap" style="min-width:55px"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>
                  <span style="font-size:.78rem;min-width:30px">${pct}%</span>
                </div></td>
                <td class="text-right">${fmt(a.costo_unitario)}</td>
                <td class="text-right">${fmt(a.costo_unitario*a.cantidad_planificada)}</td>
                <td><span class="badge ${estCls}">${estLbl}</span></td>
                <td><button class="btn-icon" title="Ver/subir fotos" onclick="_fotosAct(${a.id})">📷</button></td>
                <td><div class="gap-8">
                  <button class="btn-icon" onclick="_editAct(${a.id})">✏️</button>
                  <button class="btn-icon" onclick="_delAct(${a.id})">🗑️</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr class="pago-total-row">
            <td colspan="7" class="text-right fw-bold">TOTAL PLANIFICADO / EJECUTADO:</td>
            <td class="text-right fw-bold">${fmt(totalPlan)}</td>
            <td colspan="3"></td>
          </tr></tfoot>
        </table>
      </div>`;
    const fp=document.getElementById('fa-fp'), fe=document.getElementById('fa-fe');
    if(fp) fp.value=window._actFP||'';
    if(fe) fe.value=window._actFE||'';
  }

  window._filtAct = () => {
    window._actFP = document.getElementById('fa-fp').value;
    window._actFE = document.getElementById('fa-fe').value;
    let f = acts;
    if(window._actFP) f=f.filter(a=>String(a.proyecto_id)===window._actFP);
    if(window._actFE) f=f.filter(a=>a.estado===window._actFE);
    render(f);
  };

  window._newAct = () => openModal('Nueva Actividad', formAct({},pOpts), async ()=>{
    const nombre=document.getElementById('fac-n').value.trim();
    if(!nombre) return toast('Nombre obligatorio','error');
    await api('POST','/api/actividades',recogerAct(true));
    closeModal(); toast('Actividad creada','success'); renderActividades();
  });

  window._editAct = (id) => {
    const a=acts.find(x=>x.id===id);
    openModal('Editar Actividad', formAct(a,pOpts), async ()=>{
      await api('PUT',`/api/actividades/${id}`,recogerAct(false));
      closeModal(); toast('Guardado','success'); renderActividades();
    });
  };

  window._delAct = async (id)=>{
    if(!confirm('¿Eliminar?')) return;
    await api('DELETE',`/api/actividades/${id}`);
    toast('Eliminada'); renderActividades();
  };

  window._fotosAct = async (actId) => {
    const act = acts.find(a => a.id === actId);
    const actNombre = act ? act.nombre : 'Actividad';
    const fotos = await api('GET', `/api/fotos?actividad_id=${actId}`);
    const proyId = act?.proyecto_id || '';
    openModal(`📷 Fotos – ${actNombre}`, fotoModal(fotos, actId, proyId), null, { hideSave: true });
    // handlers inline en el HTML del modal
  };

  render(acts);
}

function formAct(a={},pOpts='') {
  return `<div class="form-grid">
    ${!a.id?`<div class="form-group full"><label>Proyecto *</label><select id="fac-p">${pOpts}</select></div>`:''}
    <div class="form-group full"><label>Nombre *</label><input id="fac-n" value="${a.nombre||''}" placeholder="Ej: Excavación"></div>
    <div class="form-group"><label>Unidad</label><input id="fac-u" value="${a.unidad||'m³'}"></div>
    <div class="form-group"><label>Cant. Planificada</label><input id="fac-cp" type="number" step="0.01" value="${a.cantidad_planificada||0}"></div>
    <div class="form-group"><label>Cant. Ejecutada</label><input id="fac-ce" type="number" step="0.01" value="${a.cantidad_ejecutada||0}"></div>
    <div class="form-group"><label>Costo Unitario (COP)</label><input id="fac-co" type="number" step="0.01" value="${a.costo_unitario||0}"></div>
    <div class="form-group"><label>Estado</label>
      <select id="fac-s">
        <option value="pendiente" ${a.estado==='pendiente'?'selected':''}>Pendiente</option>
        <option value="en_progreso" ${a.estado==='en_progreso'?'selected':''}>En Progreso</option>
        <option value="completado" ${a.estado==='completado'?'selected':''}>Completado</option>
      </select></div>
  </div>`;
}

function recogerAct(withProy) {
  return {
    ...(withProy?{proyecto_id:document.getElementById('fac-p').value}:{}),
    nombre: document.getElementById('fac-n').value,
    unidad: document.getElementById('fac-u').value,
    cantidad_planificada: parseFloat(document.getElementById('fac-cp').value)||0,
    cantidad_ejecutada:   parseFloat(document.getElementById('fac-ce').value)||0,
    costo_unitario:       parseFloat(document.getElementById('fac-co').value)||0,
    estado: document.getElementById('fac-s').value,
  };
}

function fotoModal(fotos, actId, proyId) {
  const lista = fotos.length
    ? fotos.map(f=>`<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <img src="${f.url}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="openLightbox('${f.url}')">
        <div style="flex:1;font-size:.83rem">
          <div class="fw-bold">${fmtFecha(f.fecha)}</div>
          <div class="text-muted">${f.comentario||'Sin comentario'}</div>
        </div>
        <button class="btn-icon" onclick="_delFoto(${f.id},this)">🗑️</button>
      </div>`).join('')
    : '<p class="text-muted" style="text-align:center;padding:12px">Sin fotos aún</p>';

  return `<div id="fotos-lista">${lista}</div>
    <hr style="margin:14px 0">
    <div class="form-grid">
      <div class="form-group full">
        <label>Subir nueva foto</label>
        <div class="upload-zone" onclick="document.getElementById('foto-input').click()">
          <input type="file" id="foto-input" accept="image/*" onchange="_previewFoto(this)">
          <div class="upload-icon">📸</div>
          <p>Clic para seleccionar imagen (máx 15MB)</p>
          <img id="foto-preview" src="" style="display:none;max-height:120px;margin:8px auto;border-radius:6px">
        </div>
      </div>
      <div class="form-group"><label>Fecha</label><input id="foto-fecha" type="date" value="${hoy()}"></div>
      <div class="form-group"><label>Comentario</label><input id="foto-coment" placeholder="Descripción del avance"></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-primary" onclick="_subirFoto(${actId},${proyId})">📤 Subir Foto</button>
    </div>`;
}

window._previewFoto = (input) => {
  const file = input.files[0];
  if (!file) return;
  const img = document.getElementById('foto-preview');
  img.src = URL.createObjectURL(file);
  img.style.display = 'block';
  document.querySelector('.upload-zone p').textContent = file.name;
};

window._subirFoto = async (actId, proyId) => {
  const input = document.getElementById('foto-input');
  if (!input.files[0]) return toast('Selecciona una imagen','error');
  const fd = new FormData();
  fd.append('foto', input.files[0]);
  fd.append('actividad_id', actId);
  fd.append('proyecto_id', proyId);
  fd.append('fecha', document.getElementById('foto-fecha').value);
  fd.append('comentario', document.getElementById('foto-coment').value);
  toast('Subiendo...');
  const r = await apiUpload('/api/fotos', fd);
  if (r.ok) {
    toast('Foto subida','success');
    const fotos = await api('GET', `/api/fotos?actividad_id=${actId}`);
    document.getElementById('fotos-lista').innerHTML = fotos.map(f =>
      `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <img src="${f.url}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="openLightbox('${f.url}')">
        <div style="flex:1;font-size:.83rem"><div class="fw-bold">${fmtFecha(f.fecha)}</div><div class="text-muted">${f.comentario||''}</div></div>
        <button class="btn-icon" onclick="_delFoto(${f.id},this)">🗑️</button>
      </div>`).join('');
  } else toast('Error al subir','error');
};

window._delFoto = async (id, btn) => {
  if (!confirm('¿Eliminar foto?')) return;
  await api('DELETE', `/api/fotos/${id}`);
  btn.closest('div[style]').remove();
  toast('Foto eliminada');
};
