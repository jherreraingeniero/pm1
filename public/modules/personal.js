async function renderPersonal() {
  const c = document.getElementById('content');
  const [personal, proyectos] = await Promise.all([api('GET','/api/personal'), api('GET','/api/proyectos')]);
  const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');

  c.innerHTML = `
    <div class="section-header">
      <h2>Personal (${personal.length})</h2>
      <button class="btn btn-primary" onclick="_newPers()">+ Nuevo Empleado</button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Nombre</th><th>Cargo</th><th>Proyecto</th><th>Teléfono</th><th>Salario/Día</th><th></th></tr></thead>
        <tbody>
          ${personal.map(p=>`<tr>
            <td class="fw-bold">${p.nombre}</td>
            <td>${p.cargo||'-'}</td>
            <td>${p.proyecto_nombre||'Sin proyecto'}</td>
            <td>${p.telefono||'-'}</td>
            <td class="text-right">${fmt(p.salario_diario)}</td>
            <td><div class="gap-8">
              <button class="btn-icon" onclick="_editPers(${p.id})">✏️</button>
              <button class="btn-icon" onclick="_delPers(${p.id})">🗑️</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  window._newPers = () => openModal('Nuevo Empleado', formPers({}, pOpts), async () => {
    if (!document.getElementById('fps-n').value.trim()) return toast('Nombre obligatorio','error');
    await api('POST','/api/personal', recogerPers());
    closeModal(); toast('Empleado agregado','success'); renderPersonal();
  });

  window._editPers = (id) => {
    const p=personal.find(x=>x.id===id);
    openModal('Editar Empleado', formPers(p, pOpts), async () => {
      await api('PUT',`/api/personal/${id}`, {...recogerPers(), activo:1});
      closeModal(); toast('Guardado','success'); renderPersonal();
    });
  };

  window._delPers = async (id) => {
    if (!confirm('¿Desactivar empleado?')) return;
    await api('DELETE',`/api/personal/${id}`);
    toast('Desactivado'); renderPersonal();
  };
}

function formPers(p={}, pOpts='') {
  return `<div class="form-grid">
    <div class="form-group full"><label>Nombre *</label><input id="fps-n" value="${p.nombre||''}" placeholder="Nombre completo"></div>
    <div class="form-group"><label>Cargo</label><input id="fps-c" value="${p.cargo||''}" placeholder="Maestro, Oficial..."></div>
    <div class="form-group"><label>Teléfono</label><input id="fps-t" value="${p.telefono||''}"></div>
    <div class="form-group"><label>Salario Diario (COP)</label><input id="fps-s" type="number" value="${p.salario_diario||0}"></div>
    <div class="form-group full"><label>Proyecto</label>
      <select id="fps-p"><option value="">Sin asignar</option>${pOpts.replace(`value="${p.proyecto_id}"`,`value="${p.proyecto_id}" selected`)}</select></div>
  </div>`;
}

function recogerPers() {
  return {
    nombre: document.getElementById('fps-n').value,
    cargo: document.getElementById('fps-c').value,
    telefono: document.getElementById('fps-t').value,
    salario_diario: parseFloat(document.getElementById('fps-s').value)||0,
    proyecto_id: document.getElementById('fps-p').value||null,
  };
}
