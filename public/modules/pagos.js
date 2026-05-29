async function renderPagos() {
  const c = document.getElementById('content');
  const [pagos, proyectos] = await Promise.all([api('GET','/api/pagos'), api('GET','/api/proyectos')]);
  const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');

  function render(lista) {
    const totalPend = lista.filter(p=>p.estado==='pendiente').reduce((s,p)=>s+p.monto,0);
    const totalVenc = lista.filter(p=>p.estado==='vencido').reduce((s,p)=>s+p.monto,0);
    const totalPag  = lista.filter(p=>p.estado==='pagado').reduce((s,p)=>s+p.monto,0);
    c.innerHTML = `
      <div class="section-header">
        <h2>Pagos (${lista.length})</h2>
        <button class="btn btn-primary" onclick="_newPago()">+ Nuevo Pago</button>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap">
        <div class="card metric-card warning" style="flex:1;min-width:140px">
          <div class="card-title">Pendientes</div><div class="card-value" style="font-size:1.15rem">${fmt(totalPend)}</div>
        </div>
        <div class="card metric-card danger" style="flex:1;min-width:140px">
          <div class="card-title">Vencidos</div><div class="card-value" style="font-size:1.15rem">${fmt(totalVenc)}</div>
        </div>
        <div class="card metric-card success" style="flex:1;min-width:140px">
          <div class="card-title">Pagados</div><div class="card-value" style="font-size:1.15rem">${fmt(totalPag)}</div>
        </div>
      </div>
      <div class="filters">
        <select id="pg-fp" onchange="_filtPago()"><option value="">Todos los proyectos</option>${pOpts}</select>
        <select id="pg-fe" onchange="_filtPago()">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="vencido">Vencido</option>
          <option value="pagado">Pagado</option>
        </select>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Proyecto</th><th>Concepto</th><th>Beneficiario</th>
            <th>Monto</th><th>Vencimiento</th><th>Fecha Pago</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>
            ${lista.map(p=>{
              const bCls={pendiente:'badge-warning',vencido:'badge-danger',pagado:'badge-success'}[p.estado]||'badge-gray';
              const bLbl={pendiente:'Pendiente',vencido:'Vencido',pagado:'Pagado'}[p.estado]||p.estado;
              return `<tr>
                <td>${p.proyecto_nombre}</td>
                <td class="fw-bold">${p.concepto}</td>
                <td>${p.beneficiario||'-'}</td>
                <td class="text-right fw-bold">${fmt(p.monto)}</td>
                <td>${fmtFecha(p.fecha_vencimiento)}</td>
                <td>${fmtFecha(p.fecha_pago)}</td>
                <td><span class="badge ${bCls}">${bLbl}</span></td>
                <td><div class="gap-8">
                  ${p.estado!=='pagado'?`<button class="btn btn-sm" style="background:#dcfce7;color:#15803d;border:1px solid #16a34a" onclick="_pagarPago(${p.id})">✅ Pagar</button>`:''}
                  <button class="btn-icon" onclick="_editPago(${p.id})">✏️</button>
                  <button class="btn-icon" onclick="_delPago(${p.id})">🗑️</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    const fp=document.getElementById('pg-fp'),fe=document.getElementById('pg-fe');
    if(fp) fp.value=window._pgFP||'';
    if(fe) fe.value=window._pgFE||'';
  }

  window._filtPago = () => {
    window._pgFP=document.getElementById('pg-fp').value;
    window._pgFE=document.getElementById('pg-fe').value;
    let f=pagos;
    if(window._pgFP) f=f.filter(p=>String(p.proyecto_id)===window._pgFP);
    if(window._pgFE) f=f.filter(p=>p.estado===window._pgFE);
    render(f);
  };

  window._newPago = () => openModal('Nuevo Pago', formPago({},pOpts), async ()=>{
    if(!document.getElementById('fpg-c').value.trim()) return toast('Concepto obligatorio','error');
    await api('POST','/api/pagos',recogerPago(true));
    closeModal(); toast('Pago registrado','success'); renderPagos();
  });

  window._editPago = (id)=>{
    const p=pagos.find(x=>x.id===id);
    openModal('Editar Pago',formPago(p,pOpts), async ()=>{
      await api('PUT',`/api/pagos/${id}`,recogerPago(false));
      closeModal(); toast('Guardado','success'); renderPagos();
    });
  };

  window._pagarPago = async (id)=>{
    const p=pagos.find(x=>x.id===id);
    await api('PUT',`/api/pagos/${id}`,{...p,estado:'pagado',fecha_pago:hoy()});
    toast('Pago registrado','success'); renderPagos();
  };

  window._delPago = async (id)=>{
    if(!confirm('¿Eliminar?')) return;
    await api('DELETE',`/api/pagos/${id}`);
    toast('Eliminado'); renderPagos();
  };

  render(pagos);
}

function formPago(p={},pOpts='') {
  return `<div class="form-grid">
    ${!p.id?`<div class="form-group full"><label>Proyecto *</label><select id="fpg-py">${pOpts}</select></div>`:''}
    <div class="form-group full"><label>Concepto *</label><input id="fpg-c" value="${p.concepto||''}" placeholder="Ej: Nómina mayo"></div>
    <div class="form-group"><label>Beneficiario</label><input id="fpg-b" value="${p.beneficiario||''}"></div>
    <div class="form-group"><label>Monto (COP)</label><input id="fpg-m" type="number" value="${p.monto||0}"></div>
    <div class="form-group"><label>Fecha Vencimiento</label><input id="fpg-fv" type="date" value="${p.fecha_vencimiento||''}"></div>
    <div class="form-group"><label>Fecha Pago</label><input id="fpg-fp" type="date" value="${p.fecha_pago||''}"></div>
    <div class="form-group"><label>Estado</label>
      <select id="fpg-e">
        <option value="pendiente" ${p.estado==='pendiente'?'selected':''}>Pendiente</option>
        <option value="vencido"   ${p.estado==='vencido'?'selected':''}>Vencido</option>
        <option value="pagado"    ${p.estado==='pagado'?'selected':''}>Pagado</option>
      </select></div>
    <div class="form-group full"><label>Notas</label><textarea id="fpg-n">${p.notas||''}</textarea></div>
  </div>`;
}

function recogerPago(withProy) {
  return {
    ...(withProy?{proyecto_id:document.getElementById('fpg-py').value}:{}),
    concepto:document.getElementById('fpg-c').value,
    beneficiario:document.getElementById('fpg-b').value,
    monto:parseFloat(document.getElementById('fpg-m').value)||0,
    fecha_vencimiento:document.getElementById('fpg-fv').value,
    fecha_pago:document.getElementById('fpg-fp').value,
    estado:document.getElementById('fpg-e').value,
    notas:document.getElementById('fpg-n').value,
  };
}
