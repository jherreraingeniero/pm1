async function renderFotos() {
  const c = document.getElementById('content');
  const proyectos = await api('GET', '/api/proyectos');
  let proySel = window._fotoFP || '';

  async function renderGaleria() {
    const params = proySel ? `?proyecto_id=${proySel}` : '';
    const fotos = await api('GET', `/api/fotos${params}`);

    // Agrupar por actividad
    const grupos = {};
    fotos.forEach(f=>{
      const key = f.actividad_nombre || 'General';
      if(!grupos[key]) grupos[key]=[];
      grupos[key].push(f);
    });

    c.innerHTML = `
      <div class="section-header">
        <h2>Fotos de Avance (${fotos.length})</h2>
        <button class="btn btn-primary" onclick="_subirFotoGen()">📸 Subir Foto</button>
      </div>
      <div class="filters">
        <select id="foto-fp" onchange="_cambFotoFP(this.value)">
          <option value="">Todos los proyectos</option>
          ${proyectos.map(p=>`<option value="${p.id}" ${proySel===String(p.id)?'selected':''}>${p.nombre}</option>`).join('')}
        </select>
      </div>
      ${fotos.length ? Object.entries(grupos).map(([act, imgs])=>`
        <div style="margin-bottom:24px">
          <h3 style="font-size:.88rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">
            📋 ${act} (${imgs.length})
          </h3>
          <div class="fotos-grid">
            ${imgs.map(f=>`<div class="foto-card">
              <img class="foto-img" src="${f.url}" alt="${f.comentario||''}" onclick="openLightbox('${f.url}')">
              <div class="foto-info">
                <div class="foto-actividad">${f.proyecto_nombre||''}</div>
                <div class="foto-meta">📅 ${fmtFecha(f.fecha)}</div>
                ${f.comentario?`<div class="foto-comentario">${f.comentario}</div>`:''}
              </div>
              <div class="foto-actions">
                <button class="btn-icon" onclick="_delFotoGal(${f.id})">🗑️ Eliminar</button>
              </div>
            </div>`).join('')}
          </div>
        </div>`).join('')
      : emptyState('📷','No hay fotos. Sube fotos desde el módulo de Actividades o desde aquí.')}`;
  }

  window._cambFotoFP = v => { window._fotoFP=v; proySel=v; renderGaleria(); };

  window._delFotoGal = async (id) => {
    if(!confirm('¿Eliminar foto?')) return;
    await api('DELETE',`/api/fotos/${id}`);
    toast('Foto eliminada'); renderGaleria();
  };

  window._subirFotoGen = () => {
    const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');
    openModal('📸 Subir Foto de Avance', `
      <div class="form-grid">
        <div class="form-group full"><label>Proyecto</label><select id="fg-py">${pOpts}</select></div>
        <div class="form-group full">
          <label>Foto</label>
          <div class="upload-zone" onclick="document.getElementById('fg-inp').click()">
            <input type="file" id="fg-inp" accept="image/*" onchange="_prevFG(this)">
            <div class="upload-icon">📸</div>
            <p>Clic para seleccionar imagen</p>
            <img id="fg-prev" src="" style="display:none;max-height:120px;margin:8px auto;border-radius:6px">
          </div>
        </div>
        <div class="form-group"><label>Fecha</label><input id="fg-f" type="date" value="${hoy()}"></div>
        <div class="form-group"><label>Comentario</label><input id="fg-c" placeholder="Descripción del avance"></div>
      </div>`, async () => {
      const inp = document.getElementById('fg-inp');
      if(!inp.files[0]) return toast('Selecciona una imagen','error');
      const fd = new FormData();
      fd.append('foto', inp.files[0]);
      fd.append('proyecto_id', document.getElementById('fg-py').value);
      fd.append('fecha', document.getElementById('fg-f').value);
      fd.append('comentario', document.getElementById('fg-c').value);
      const r = await apiUpload('/api/fotos', fd);
      if(r.ok) { closeModal(); toast('Foto subida','success'); renderGaleria(); }
      else toast('Error al subir','error');
    });
  };

  window._prevFG = (inp) => {
    const img=document.getElementById('fg-prev');
    img.src=URL.createObjectURL(inp.files[0]);
    img.style.display='block';
  };

  renderGaleria();
}
