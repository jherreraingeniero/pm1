async function renderBitacora() {
  const c = document.getElementById('content');
  const [bitacora, proyectos] = await Promise.all([api('GET','/api/bitacora'), api('GET','/api/proyectos')]);
  const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');

  function render(lista) {
    c.innerHTML = `
      <div class="section-header">
        <h2>Bitácora Diaria (${lista.length} registros)</h2>
        <button class="btn btn-primary" onclick="_newBit()">+ Nueva Entrada</button>
      </div>
      <div class="filters">
        <select id="bit-fp" onchange="_filtBit()"><option value="">Todos los proyectos</option>${pOpts}</select>
      </div>
      ${lista.length ? `<div class="bitacora-list">${lista.map(b=>bitacoraItem(b)).join('')}</div>`
        : emptyState('📓','No hay registros en la bitácora')}`;
    const fp=document.getElementById('bit-fp');
    if(fp) fp.value=window._bitFP||'';
  }

  window._filtBit = ()=>{
    window._bitFP=document.getElementById('bit-fp').value;
    render(window._bitFP?bitacora.filter(b=>String(b.proyecto_id)===window._bitFP):bitacora);
  };

  window._newBit = ()=> openModal('Nueva Entrada de Bitácora', formBit({},pOpts), async ()=>{
    const pid=document.getElementById('fbt-py').value;
    const fecha=document.getElementById('fbt-f').value;
    if(!pid||!fecha) return toast('Proyecto y fecha son obligatorios','error');
    await api('POST','/api/bitacora',recogerBit(true));
    closeModal(); toast('Entrada registrada','success'); renderBitacora();
  });

  window._editBit = (id)=>{
    const b=bitacora.find(x=>x.id===id);
    openModal('Editar Entrada', formBit(b,pOpts,true), async ()=>{
      await api('PUT',`/api/bitacora/${id}`,recogerBit(false));
      closeModal(); toast('Guardado','success'); renderBitacora();
    });
  };

  window._delBit = async (id)=>{
    if(!confirm('¿Eliminar esta entrada?')) return;
    await api('DELETE',`/api/bitacora/${id}`);
    toast('Eliminado'); renderBitacora();
  };

  render(bitacora);
}

function bitacoraItem(b) {
  return `<div class="bitacora-item">
    <div class="bitacora-fecha">
      <span>📅 ${fmtFecha(b.fecha)} · ${b.proyecto_nombre} · 👷 ${b.personal_presente} personas</span>
      <div class="gap-8">
        <button class="btn-icon" onclick="_editBit(${b.id})">✏️</button>
        <button class="btn-icon" onclick="_delBit(${b.id})">🗑️</button>
      </div>
    </div>
    ${b.clima?`<div class="bitacora-section"><label>🌤️ Clima</label><p>${b.clima}</p></div>`:''}
    ${b.actividades_dia?`<div class="bitacora-section"><label>⚙️ Actividades del Día</label><p>${b.actividades_dia}</p></div>`:''}
    ${b.incidentes?`<div class="bitacora-section"><label>⚠️ Incidentes</label><p style="color:var(--danger)">${b.incidentes}</p></div>`:''}
    ${b.observaciones?`<div class="bitacora-section"><label>📝 Observaciones</label><p>${b.observaciones}</p></div>`:''}
  </div>`;
}

function formBit(b={}, pOpts='', editing=false) {
  return `<div class="form-grid">
    ${!editing?`<div class="form-group full"><label>Proyecto *</label><select id="fbt-py">${pOpts}</select></div>`:`<input type="hidden" id="fbt-py" value="${b.proyecto_id}">`}
    <div class="form-group"><label>Fecha *</label><input id="fbt-f" type="date" value="${b.fecha||hoy()}"></div>
    <div class="form-group"><label>Personal presente</label><input id="fbt-pp" type="number" value="${b.personal_presente||0}"></div>
    <div class="form-group"><label>Clima</label><input id="fbt-cl" value="${b.clima||''}" placeholder="Soleado, lluvioso..."></div>
    <div class="form-group full"><label>Actividades del día</label>
      <textarea id="fbt-a">${b.actividades_dia||''}</textarea></div>
    <div class="form-group full"><label>⚠️ Incidentes</label>
      <textarea id="fbt-i">${b.incidentes||''}</textarea></div>
    <div class="form-group full"><label>📝 Observaciones</label>
      <textarea id="fbt-o">${b.observaciones||''}</textarea></div>
  </div>`;
}

function recogerBit(withProy) {
  return {
    ...(withProy?{proyecto_id:document.getElementById('fbt-py').value}:{}),
    fecha:document.getElementById('fbt-f').value,
    personal_presente:parseInt(document.getElementById('fbt-pp').value)||0,
    clima:document.getElementById('fbt-cl').value,
    actividades_dia:document.getElementById('fbt-a').value,
    incidentes:document.getElementById('fbt-i').value,
    observaciones:document.getElementById('fbt-o').value,
  };
}
