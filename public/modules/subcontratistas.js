async function renderSubcontratistas() {
  const c = document.getElementById('content');
  const [subs, proyectos] = await Promise.all([api('GET','/api/subcontratistas'), api('GET','/api/proyectos')]);
  const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');

  function render(lista) {
    c.innerHTML = `
      <div class="section-header">
        <h2>Subcontratistas (${lista.length})</h2>
        <button class="btn btn-primary" onclick="_newSub()">+ Nuevo Subcontratista</button>
      </div>
      <div class="filters">
        <select id="sub-fp" onchange="_filtSub()"><option value="">Todos los proyectos</option>${pOpts}</select>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Proyecto</th><th>Nombre / Empresa</th><th>Especialidad</th>
            <th>Contrato</th><th>Avance %</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>
            ${lista.map(s=>{
              const saldo = (s.avance_certificado/100)*s.monto_contrato - s.pagado;
              const saldoCls = saldo>0?'positivo':'negativo';
              const pct = Math.min(100,s.avance_certificado||0);
              const cls = pct>=70?'high':pct>=40?'mid':'low';
              const estCls = {activo:'badge-success',terminado:'badge-gray',suspendido:'badge-danger'}[s.estado]||'badge-gray';
              return `<tr>
                <td>${s.proyecto_nombre}</td>
                <td><div class="fw-bold">${s.nombre}</div><div class="text-muted" style="font-size:.78rem">${s.empresa||''}</div></td>
                <td>${s.especialidad||'-'}</td>
                <td class="text-right fw-bold">${fmt(s.monto_contrato)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:5px">
                    <div class="progress-bar-wrap" style="min-width:50px"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>
                    <span style="font-size:.78rem">${pct}%</span>
                  </div>
                </td>
                <td class="text-right">${fmt(s.pagado)}</td>
                <td class="text-right fw-bold sub-saldo ${saldoCls}">${fmt(saldo)}</td>
                <td><span class="badge ${estCls}">${s.estado}</span></td>
                <td><div class="gap-8">
                  <button class="btn-icon" onclick="_editSub(${s.id})">✏️</button>
                  <button class="btn-icon" onclick="_delSub(${s.id})">🗑️</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr class="pago-total-row">
            <td colspan="3" class="text-right fw-bold">TOTALES:</td>
            <td class="text-right fw-bold">${fmt(lista.reduce((s,x)=>s+x.monto_contrato,0))}</td>
            <td></td>
            <td class="text-right fw-bold">${fmt(lista.reduce((s,x)=>s+x.pagado,0))}</td>
            <td class="text-right fw-bold">${fmt(lista.reduce((s,x)=>s+(x.avance_certificado/100*x.monto_contrato-x.pagado),0))}</td>
            <td colspan="2"></td>
          </tr></tfoot>
        </table>
      </div>`;
    const fp=document.getElementById('sub-fp');
    if(fp) fp.value=window._subFP||'';
  }

  window._filtSub = ()=>{
    window._subFP=document.getElementById('sub-fp').value;
    render(window._subFP?subs.filter(s=>String(s.proyecto_id)===window._subFP):subs);
  };

  window._newSub = ()=> openModal('Nuevo Subcontratista', formSub({},pOpts), async ()=>{
    if(!document.getElementById('fsc-n').value.trim()) return toast('Nombre obligatorio','error');
    await api('POST','/api/subcontratistas',recogerSub(true));
    closeModal(); toast('Subcontratista agregado','success'); renderSubcontratistas();
  });

  window._editSub = (id)=>{
    const s=subs.find(x=>x.id===id);
    openModal('Editar Subcontratista',formSub(s,pOpts), async ()=>{
      await api('PUT',`/api/subcontratistas/${id}`,recogerSub(false));
      closeModal(); toast('Guardado','success'); renderSubcontratistas();
    });
  };

  window._delSub = async(id)=>{
    if(!confirm('¿Eliminar?')) return;
    await api('DELETE',`/api/subcontratistas/${id}`);
    toast('Eliminado'); renderSubcontratistas();
  };

  render(subs);
}

function formSub(s={},pOpts='') {
  return `<div class="form-grid">
    ${!s.id?`<div class="form-group full"><label>Proyecto *</label><select id="fsc-py">${pOpts}</select></div>`:''}
    <div class="form-group full"><label>Nombre del Responsable *</label><input id="fsc-n" value="${s.nombre||''}"></div>
    <div class="form-group"><label>Empresa</label><input id="fsc-e" value="${s.empresa||''}"></div>
    <div class="form-group"><label>Teléfono</label><input id="fsc-t" value="${s.telefono||''}"></div>
    <div class="form-group full"><label>Especialidad / Trabajo</label><input id="fsc-esp" value="${s.especialidad||''}"></div>
    <div class="form-group"><label>Monto Contrato (COP)</label><input id="fsc-mc" type="number" value="${s.monto_contrato||0}"></div>
    <div class="form-group"><label>Avance Certificado (%)</label><input id="fsc-ac" type="number" min="0" max="100" value="${s.avance_certificado||0}"></div>
    <div class="form-group"><label>Monto Pagado (COP)</label><input id="fsc-pg" type="number" value="${s.pagado||0}"></div>
    <div class="form-group"><label>Fecha Inicio</label><input id="fsc-fi" type="date" value="${s.fecha_inicio||''}"></div>
    <div class="form-group"><label>Fecha Fin</label><input id="fsc-ff" type="date" value="${s.fecha_fin||''}"></div>
    <div class="form-group full"><label>Estado</label>
      <select id="fsc-s">
        <option value="activo"    ${s.estado==='activo'?'selected':''}>Activo</option>
        <option value="terminado" ${s.estado==='terminado'?'selected':''}>Terminado</option>
        <option value="suspendido"${s.estado==='suspendido'?'selected':''}>Suspendido</option>
      </select></div>
    <div class="form-group full"><label>Notas</label><textarea id="fsc-nt">${s.notas||''}</textarea></div>
  </div>`;
}

function recogerSub(withProy) {
  return {
    ...(withProy?{proyecto_id:document.getElementById('fsc-py').value}:{}),
    nombre:document.getElementById('fsc-n').value,
    empresa:document.getElementById('fsc-e').value,
    telefono:document.getElementById('fsc-t').value,
    especialidad:document.getElementById('fsc-esp').value,
    monto_contrato:parseFloat(document.getElementById('fsc-mc').value)||0,
    avance_certificado:parseFloat(document.getElementById('fsc-ac').value)||0,
    pagado:parseFloat(document.getElementById('fsc-pg').value)||0,
    fecha_inicio:document.getElementById('fsc-fi').value,
    fecha_fin:document.getElementById('fsc-ff').value,
    estado:document.getElementById('fsc-s').value,
    notas:document.getElementById('fsc-nt').value,
  };
}
