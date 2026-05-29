async function renderMateriales() {
  const c = document.getElementById('content');
  const [mats, proyectos] = await Promise.all([api('GET','/api/materiales'), api('GET','/api/proyectos')]);
  const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');

  function render(lista) {
    c.innerHTML = `
      <div class="section-header">
        <h2>Materiales (${lista.length})</h2>
        <button class="btn btn-primary" onclick="_newMat()">+ Nuevo Material</button>
      </div>
      <div class="filters">
        <select id="mat-fp" onchange="_filtMat()"><option value="">Todos los proyectos</option>${pOpts}</select>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Proyecto</th><th>Material</th><th>Unidad</th>
            <th>Pedido</th><th>Recibido</th><th>Usado</th>
            <th>Disponible</th><th>Costo Unit.</th><th>Proveedor</th><th></th>
          </tr></thead>
          <tbody>
            ${lista.map(m=>{
              const disp=m.cantidad_recibida-m.cantidad_usada;
              const alertCls=disp<0?'text-danger':disp===0?'text-warning':'text-success';
              const pct=m.cantidad_pedida>0?Math.min(100,Math.round(m.cantidad_recibida/m.cantidad_pedida*100)):0;
              return `<tr>
                <td>${m.proyecto_nombre}</td>
                <td class="fw-bold">${m.nombre}</td>
                <td>${m.unidad}</td>
                <td class="text-right">${fmtNum(m.cantidad_pedida)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:5px">
                    <div class="progress-bar-wrap" style="min-width:45px"><div class="progress-bar ${pct>=100?'high':'mid'}" style="width:${pct}%"></div></div>
                    <span style="font-size:.78rem">${fmtNum(m.cantidad_recibida)} (${pct}%)</span>
                  </div>
                </td>
                <td class="text-right">${fmtNum(m.cantidad_usada)}</td>
                <td class="text-right fw-bold ${alertCls}">${fmtNum(disp)}</td>
                <td class="text-right">${fmt(m.costo_unitario)}</td>
                <td>${m.proveedor||'-'}</td>
                <td><div class="gap-8">
                  <button class="btn-icon" title="Registrar en historial de precios" onclick="_logHistorial(${m.id})">📈</button>
                  <button class="btn-icon" onclick="_editMat(${m.id})">✏️</button>
                  <button class="btn-icon" onclick="_delMat(${m.id})">🗑️</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    const fp=document.getElementById('mat-fp');
    if(fp) fp.value=window._matFP||'';
  }

  window._filtMat = () => {
    window._matFP=document.getElementById('mat-fp').value;
    render(window._matFP?mats.filter(m=>String(m.proyecto_id)===window._matFP):mats);
  };

  window._newMat = () => openModal('Nuevo Material', formMat({},pOpts), async ()=>{
    if(!document.getElementById('fm-n').value.trim()) return toast('Nombre obligatorio','error');
    await api('POST','/api/materiales',recogerMat(true));
    closeModal(); toast('Material agregado','success'); renderMateriales();
  });

  window._editMat = (id)=>{
    const m=mats.find(x=>x.id===id);
    openModal('Editar Material',formMat(m,pOpts), async ()=>{
      await api('PUT',`/api/materiales/${id}`,recogerMat(false));
      closeModal(); toast('Guardado','success'); renderMateriales();
    });
  };

  window._delMat = async(id)=>{
    if(!confirm('¿Eliminar?')) return;
    await api('DELETE',`/api/materiales/${id}`);
    toast('Eliminado'); renderMateriales();
  };

  window._logHistorial = (id)=>{
    const m=mats.find(x=>x.id===id);
    openModal('Registrar en Historial de Precios',`
      <div class="form-grid">
        <div class="form-group full"><label>Material</label><input value="${m.nombre}" disabled></div>
        <div class="form-group"><label>Precio (COP)</label><input id="lh-p" type="number" value="${m.costo_unitario}"></div>
        <div class="form-group"><label>Fecha compra</label><input id="lh-f" type="date" value="${hoy()}"></div>
        <div class="form-group"><label>Cantidad</label><input id="lh-c" type="number" value="${m.cantidad_recibida}"></div>
        <div class="form-group"><label>Proveedor</label><input id="lh-pr" value="${m.proveedor||''}"></div>
        <div class="form-group full"><label>Notas</label><input id="lh-nt" placeholder="Observaciones"></div>
      </div>`, async ()=>{
      await api('POST','/api/historial-precios',{
        material_nombre:m.nombre, unidad:m.unidad,
        precio:parseFloat(document.getElementById('lh-p').value)||0,
        fecha_compra:document.getElementById('lh-f').value,
        cantidad:parseFloat(document.getElementById('lh-c').value)||0,
        proveedor:document.getElementById('lh-pr').value,
        notas:document.getElementById('lh-nt').value,
        proyecto_id:m.proyecto_id,
      });
      closeModal(); toast('Registrado en historial','success');
    });
  };

  render(mats);
}

function formMat(m={},pOpts='') {
  return `<div class="form-grid">
    ${!m.id?`<div class="form-group full"><label>Proyecto *</label><select id="fm-py">${pOpts}</select></div>`:''}
    <div class="form-group full"><label>Nombre *</label><input id="fm-n" value="${m.nombre||''}" placeholder="Ej: Cemento Portland"></div>
    <div class="form-group"><label>Unidad</label><input id="fm-u" value="${m.unidad||'und'}"></div>
    <div class="form-group"><label>Fecha Pedido</label><input id="fm-f" type="date" value="${m.fecha_pedido||''}"></div>
    <div class="form-group"><label>Cant. Pedida</label><input id="fm-cp" type="number" step="0.01" value="${m.cantidad_pedida||0}"></div>
    <div class="form-group"><label>Cant. Recibida</label><input id="fm-cr" type="number" step="0.01" value="${m.cantidad_recibida||0}"></div>
    <div class="form-group"><label>Cant. Usada</label><input id="fm-cu" type="number" step="0.01" value="${m.cantidad_usada||0}"></div>
    <div class="form-group"><label>Costo Unit. (COP)</label><input id="fm-co" type="number" step="0.01" value="${m.costo_unitario||0}"></div>
    <div class="form-group full"><label>Proveedor</label><input id="fm-pr" value="${m.proveedor||''}"></div>
  </div>`;
}

function recogerMat(withProy) {
  return {
    ...(withProy?{proyecto_id:document.getElementById('fm-py').value}:{}),
    nombre:document.getElementById('fm-n').value,
    unidad:document.getElementById('fm-u').value,
    fecha_pedido:document.getElementById('fm-f').value,
    cantidad_pedida:   parseFloat(document.getElementById('fm-cp').value)||0,
    cantidad_recibida: parseFloat(document.getElementById('fm-cr').value)||0,
    cantidad_usada:    parseFloat(document.getElementById('fm-cu').value)||0,
    costo_unitario:    parseFloat(document.getElementById('fm-co').value)||0,
    proveedor:document.getElementById('fm-pr').value,
  };
}
