async function renderHistorial() {
  const c = document.getElementById('content');
  const [historial, proyectos] = await Promise.all([api('GET','/api/historial-precios'), api('GET','/api/proyectos')]);
  const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');

  // Calcular tendencia por material
  const porMaterial = {};
  historial.forEach(h=>{
    if (!porMaterial[h.material_nombre]) porMaterial[h.material_nombre]=[];
    porMaterial[h.material_nombre].push(h);
  });
  Object.values(porMaterial).forEach(arr=>arr.sort((a,b)=>a.fecha_compra>b.fecha_compra?1:-1));

  function getTendencia(nombre, precio) {
    const arr=porMaterial[nombre];
    if(!arr||arr.length<2) return '';
    const prev=arr[arr.findIndex(x=>x.precio===precio)-1];
    if(!prev) return '';
    const diff=precio-prev.precio;
    if(diff>0) return `<span class="precio-trend up">▲ ${fmt(diff)}</span>`;
    if(diff<0) return `<span class="precio-trend down">▼ ${fmt(Math.abs(diff))}</span>`;
    return '';
  }

  c.innerHTML = `
    <div class="section-header">
      <h2>Historial de Precios (${historial.length} registros)</h2>
      <button class="btn btn-primary" onclick="_newHist()">+ Registrar Compra</button>
    </div>
    <div class="filters">
      <input type="text" id="hist-bq" placeholder="🔍 Buscar material..." oninput="_filtHist()" style="min-width:200px">
    </div>
    <div id="hist-tabla">
      ${renderTablaHist(historial, getTendencia)}
    </div>`;

  window._filtHist = ()=>{
    const q=document.getElementById('hist-bq').value.toLowerCase();
    const f=q?historial.filter(h=>h.material_nombre.toLowerCase().includes(q)):historial;
    document.getElementById('hist-tabla').innerHTML=renderTablaHist(f,getTendencia);
  };

  window._newHist = ()=> openModal('Registrar Precio de Compra', formHist({},pOpts), async ()=>{
    const n=document.getElementById('fh-n').value.trim();
    const p=document.getElementById('fh-p').value;
    if(!n||!p) return toast('Material y precio obligatorios','error');
    await api('POST','/api/historial-precios',{
      material_nombre:n, unidad:document.getElementById('fh-u').value,
      precio:parseFloat(p)||0,
      proveedor:document.getElementById('fh-pr').value,
      fecha_compra:document.getElementById('fh-f').value,
      proyecto_id:document.getElementById('fh-py').value||null,
      cantidad:parseFloat(document.getElementById('fh-c').value)||0,
      notas:document.getElementById('fh-nt').value,
    });
    closeModal(); toast('Registrado','success'); renderHistorial();
  });

  window._delHist = async(id)=>{
    if(!confirm('¿Eliminar?')) return;
    await api('DELETE',`/api/historial-precios/${id}`);
    toast('Eliminado'); renderHistorial();
  };
}

function renderTablaHist(lista, getTendencia) {
  if(!lista.length) return emptyState('📈','No hay registros de precios');
  return `<div class="table-wrapper">
    <table>
      <thead><tr>
        <th>Material</th><th>Unidad</th><th>Precio Unit.</th><th>Tendencia</th>
        <th>Cantidad</th><th>Proveedor</th><th>Proyecto</th><th>Fecha</th><th>Notas</th><th></th>
      </tr></thead>
      <tbody>
        ${lista.map(h=>`<tr>
          <td class="fw-bold">${h.material_nombre}</td>
          <td>${h.unidad||'-'}</td>
          <td class="text-right fw-bold">${fmt(h.precio)}</td>
          <td>${getTendencia(h.material_nombre,h.precio)}</td>
          <td class="text-right">${fmtNum(h.cantidad)}</td>
          <td>${h.proveedor||'-'}</td>
          <td>${h.proyecto_nombre||'-'}</td>
          <td>${fmtFecha(h.fecha_compra)}</td>
          <td>${h.notas||'-'}</td>
          <td><button class="btn-icon" onclick="_delHist(${h.id})">🗑️</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function formHist(h={},pOpts='') {
  return `<div class="form-grid">
    <div class="form-group full"><label>Nombre del Material *</label><input id="fh-n" value="${h.material_nombre||''}" placeholder="Ej: Cemento Portland"></div>
    <div class="form-group"><label>Unidad</label><input id="fh-u" value="${h.unidad||'und'}"></div>
    <div class="form-group"><label>Precio Unitario (COP) *</label><input id="fh-p" type="number" value="${h.precio||''}"></div>
    <div class="form-group"><label>Cantidad Comprada</label><input id="fh-c" type="number" value="${h.cantidad||0}"></div>
    <div class="form-group"><label>Proveedor</label><input id="fh-pr" value="${h.proveedor||''}"></div>
    <div class="form-group"><label>Fecha de Compra</label><input id="fh-f" type="date" value="${h.fecha_compra||hoy()}"></div>
    <div class="form-group full"><label>Proyecto (opcional)</label><select id="fh-py"><option value="">Sin proyecto</option>${pOpts}</select></div>
    <div class="form-group full"><label>Notas</label><input id="fh-nt" value="${h.notas||''}" placeholder="Observaciones o contexto"></div>
  </div>`;
}
