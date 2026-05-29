async function renderClientes() {
  const c = document.getElementById('content');
  const clientes = await api('GET', '/api/clientes');
  c.innerHTML = `
    <div class="section-header">
      <h2>Clientes (${clientes.length})</h2>
      <button class="btn btn-primary" onclick="_newCli()">+ Nuevo Cliente</button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Nombre</th><th>Empresa</th><th>NIT</th><th>Email</th><th>Teléfono</th><th>Dirección</th><th></th></tr></thead>
        <tbody>
          ${clientes.length ? clientes.map(cl=>`<tr>
            <td class="fw-bold">${cl.nombre}</td>
            <td>${cl.empresa||'-'}</td>
            <td>${cl.nit||'-'}</td>
            <td>${cl.email?`<a href="mailto:${cl.email}">${cl.email}</a>`:'-'}</td>
            <td>${cl.telefono||'-'}</td>
            <td>${cl.direccion||'-'}</td>
            <td><div class="gap-8">
              <button class="btn-icon" onclick="_editCli(${cl.id})">✏️</button>
              <button class="btn-icon" onclick="_delCli(${cl.id})">🗑️</button>
            </div></td>
          </tr>`).join('') : `<tr><td colspan="7">${emptyState('👤','No hay clientes registrados')}</td></tr>`}
        </tbody>
      </table>
    </div>`;

  window._newCli = () => openModal('Nuevo Cliente', formCli({}), async ()=>{
    if(!document.getElementById('fcl-n').value.trim()) return toast('Nombre obligatorio','error');
    await api('POST','/api/clientes', recogerCli());
    closeModal(); toast('Cliente agregado','success'); renderClientes();
  });

  window._editCli = (id)=>{
    const cl=clientes.find(x=>x.id===id);
    openModal('Editar Cliente', formCli(cl), async ()=>{
      await api('PUT',`/api/clientes/${id}`, recogerCli());
      closeModal(); toast('Guardado','success'); renderClientes();
    });
  };

  window._delCli = async (id)=>{
    if(!confirm('¿Eliminar cliente?')) return;
    await api('DELETE',`/api/clientes/${id}`);
    toast('Eliminado'); renderClientes();
  };
}

function formCli(cl={}) {
  return `<div class="form-grid">
    <div class="form-group full"><label>Nombre *</label><input id="fcl-n" value="${cl.nombre||''}" placeholder="Nombre del contacto"></div>
    <div class="form-group"><label>Empresa</label><input id="fcl-e" value="${cl.empresa||''}"></div>
    <div class="form-group"><label>NIT / Documento</label><input id="fcl-nit" value="${cl.nit||''}"></div>
    <div class="form-group"><label>Email</label><input id="fcl-em" type="email" value="${cl.email||''}"></div>
    <div class="form-group"><label>Teléfono</label><input id="fcl-t" value="${cl.telefono||''}"></div>
    <div class="form-group full"><label>Dirección</label><input id="fcl-d" value="${cl.direccion||''}"></div>
    <div class="form-group full"><label>Notas</label><textarea id="fcl-nt">${cl.notas||''}</textarea></div>
  </div>`;
}

function recogerCli() {
  return {
    nombre:  document.getElementById('fcl-n').value,
    empresa: document.getElementById('fcl-e').value,
    nit:     document.getElementById('fcl-nit').value,
    email:   document.getElementById('fcl-em').value,
    telefono:document.getElementById('fcl-t').value,
    direccion:document.getElementById('fcl-d').value,
    notas:   document.getElementById('fcl-nt').value,
  };
}
