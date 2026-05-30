const CATS = [
  'Materiales de construcción','Mano de obra','Equipos y maquinaria',
  'Subcontratos','Servicios públicos','Transporte y logística',
  'Herramientas','Honorarios profesionales','Otros'
];
const CAT_COLORES = [
  '#ef4444','#f97316','#eab308','#22c55e','#06b6d4',
  '#3b82f6','#8b5cf6','#ec4899','#94a3b8'
];

async function renderFacturas() {
  const c = document.getElementById('content');
  const proyectos = await api('GET', '/api/proyectos');
  const pOpts = `<option value="">— Sin proyecto —</option>` +
    proyectos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  const catOpts = CATS.map(c => `<option value="${c}">${c}</option>`).join('');

  c.innerHTML = `
    <div class="section-header">
      <h2>Facturación</h2>
    </div>

    <!-- Tabs -->
    <div class="fact-tabs">
      <button class="fact-tab active" onclick="_factTab('subir',this)">📤 Subir Factura</button>
      <button class="fact-tab" onclick="_factTab('registro',this)">🗂️ Registro</button>
      <button class="fact-tab" onclick="_factTab('analisis',this)">📊 Análisis</button>
    </div>

    <!-- TAB: SUBIR -->
    <div id="fact-subir" class="fact-panel">
      <div class="card" style="max-width:680px">
        <h2>Subir factura o recibo</h2>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px">
          Sube una foto o escaneo. La IA leerá los datos automáticamente para que los revises antes de guardar.
        </p>
        <div class="upload-zone" id="fact-upload-zone" onclick="document.getElementById('fact-input').click()">
          <input type="file" id="fact-input" accept="image/*" style="display:none" onchange="_factProcesar(this)">
          <div class="upload-icon">🧾</div>
          <p id="fact-upload-label">Clic para seleccionar imagen de la factura</p>
          <img id="fact-preview-img" src="" style="display:none;max-height:160px;margin:10px auto;border-radius:8px;object-fit:contain">
        </div>
      </div>

      <!-- Estado procesando -->
      <div id="fact-procesando" style="display:none" class="card" style="max-width:680px">
        <div style="text-align:center;padding:24px">
          <div style="font-size:2rem;margin-bottom:10px">🤖</div>
          <p style="font-weight:600;margin-bottom:4px">Analizando factura con IA...</p>
          <p style="font-size:.83rem;color:var(--text-muted)">Esto toma unos segundos</p>
          <div class="fact-spinner"></div>
        </div>
      </div>

      <!-- Formulario de revisión -->
      <div id="fact-revision" style="display:none" class="card" style="max-width:680px">
        <h2>✏️ Revisa y confirma los datos</h2>
        <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:16px">
          Los campos marcados con 🤖 fueron extraídos automáticamente. Corrígelos si es necesario.
        </p>
        <div id="fact-img-wrap" style="margin-bottom:16px">
          <img id="fact-revision-img" src="" style="max-height:200px;border-radius:8px;border:1px solid var(--border);object-fit:contain;display:block;margin:0 auto;cursor:pointer">
          <p style="text-align:center;font-size:.75rem;color:var(--text-muted);margin-top:4px">Clic para ampliar</p>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Proyecto</label>
            <select id="fr-proyecto">${pOpts}</select>
          </div>
          <div class="form-group">
            <label>🤖 Fecha de la factura</label>
            <input type="date" id="fr-fecha">
          </div>
          <div class="form-group">
            <label>🤖 Proveedor</label>
            <input id="fr-proveedor" placeholder="Nombre del proveedor">
          </div>
          <div class="form-group">
            <label>🤖 Categoría</label>
            <select id="fr-categoria">${catOpts}</select>
          </div>
          <div class="form-group">
            <label>🤖 Monto total (COP)</label>
            <input type="number" id="fr-monto" placeholder="0" step="0.01">
          </div>
          <div class="form-group full">
            <label>🤖 Descripción</label>
            <input id="fr-descripcion" placeholder="Qué se compró o contrató">
          </div>
          <div class="form-group full">
            <label>Notas adicionales</label>
            <input id="fr-notas" placeholder="Observaciones, número de factura, etc.">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn btn-secondary" onclick="_factCancelar()">✕ Cancelar</button>
          <button class="btn btn-primary" onclick="_factGuardar()">✅ Confirmar y Guardar</button>
        </div>
      </div>
    </div>

    <!-- TAB: REGISTRO -->
    <div id="fact-registro" class="fact-panel" style="display:none">
      <div class="filters" style="flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <select id="fr-fp" onchange="_factFiltrar()">
          <option value="">Todos los proyectos</option>
          ${proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('')}
        </select>
        <select id="fr-fc" onchange="_factFiltrar()">
          <option value="">Todas las categorías</option>
          ${CATS.map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
        <input type="date" id="fr-fd" onchange="_factFiltrar()" placeholder="Desde" title="Desde">
        <input type="date" id="fr-fh" onchange="_factFiltrar()" placeholder="Hasta" title="Hasta">
        <button class="btn btn-secondary btn-sm" onclick="_factLimpiarFiltros()">↺ Limpiar</button>
      </div>
      <div id="fact-tabla-wrap">
        <div style="text-align:center;padding:40px;color:var(--text-muted)">Cargando...</div>
      </div>
    </div>

    <!-- TAB: ANÁLISIS -->
    <div id="fact-analisis" class="fact-panel" style="display:none">
      <div class="filters" style="margin-bottom:20px">
        <select id="fa-fp" onchange="_factStats()">
          <option value="">Todos los proyectos</option>
          ${proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('')}
        </select>
      </div>
      <div id="fact-kpis" class="kpi-row" style="margin-bottom:24px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div class="card">
          <h2>Por Categoría</h2>
          <canvas id="chart-fact-cat" height="220"></canvas>
        </div>
        <div class="card">
          <h2>Por Proyecto</h2>
          <canvas id="chart-fact-proy" height="220"></canvas>
        </div>
      </div>
      <div class="card">
        <h2>Evolución Mensual</h2>
        <canvas id="chart-fact-mes" height="120"></canvas>
      </div>
    </div>`;

  // ── Estado interno ───────────────────────────────────────────────────────────
  let pendingUrl = null;

  // ── Tab switcher ─────────────────────────────────────────────────────────────
  window._factTab = (tab, btn) => {
    document.querySelectorAll('.fact-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.fact-panel').forEach(p => p.style.display = 'none');
    document.getElementById('fact-' + tab).style.display = '';
    if (tab === 'registro') _factFiltrar();
    if (tab === 'analisis') _factStats();
  };

  // ── Procesar imagen ──────────────────────────────────────────────────────────
  window._factProcesar = async (input) => {
    const file = input.files[0];
    if (!file) return;

    // Preview
    const previewImg = document.getElementById('fact-preview-img');
    previewImg.src = URL.createObjectURL(file);
    previewImg.style.display = 'block';
    document.getElementById('fact-upload-label').textContent = file.name;

    // Mostrar spinner
    document.getElementById('fact-procesando').style.display = '';
    document.getElementById('fact-revision').style.display = 'none';

    const fd = new FormData();
    fd.append('factura', file);
    try {
      const data = await apiUpload('/api/facturas/procesar', fd);
      pendingUrl = data.url;
      const e = data.extracted || {};

      // Rellenar formulario con datos extraídos
      document.getElementById('fr-fecha').value       = e.fecha || hoy();
      document.getElementById('fr-proveedor').value   = e.proveedor || '';
      document.getElementById('fr-monto').value       = e.monto != null ? e.monto : '';
      document.getElementById('fr-descripcion').value = e.descripcion || '';
      if (e.categoria && CATS.includes(e.categoria))
        document.getElementById('fr-categoria').value = e.categoria;

      // Imagen en revisión (clic para lightbox)
      const revImg = document.getElementById('fact-revision-img');
      revImg.src = data.url;
      revImg.onclick = () => openLightbox(data.url);

      document.getElementById('fact-procesando').style.display = 'none';
      document.getElementById('fact-revision').style.display   = '';
    } catch (err) {
      document.getElementById('fact-procesando').style.display = 'none';
      toast('Error al procesar la imagen', 'error');
    }
  };

  // ── Guardar factura confirmada ────────────────────────────────────────────────
  window._factGuardar = async () => {
    const monto = parseFloat(document.getElementById('fr-monto').value);
    if (!document.getElementById('fr-proveedor').value.trim())
      return toast('Ingresa el proveedor', 'error');
    if (!monto || monto <= 0)
      return toast('Ingresa un monto válido', 'error');

    await api('POST', '/api/facturas', {
      proyecto_id: document.getElementById('fr-proyecto').value || null,
      fecha:       document.getElementById('fr-fecha').value,
      proveedor:   document.getElementById('fr-proveedor').value.trim(),
      categoria:   document.getElementById('fr-categoria').value,
      monto,
      descripcion: document.getElementById('fr-descripcion').value.trim(),
      url_foto:    pendingUrl,
      notas:       document.getElementById('fr-notas').value.trim(),
    });

    toast('Factura guardada', 'success');
    _factCancelar();
    // Resetear zona de upload
    document.getElementById('fact-input').value = '';
    document.getElementById('fact-preview-img').style.display = 'none';
    document.getElementById('fact-upload-label').textContent = 'Clic para seleccionar imagen de la factura';
    pendingUrl = null;
  };

  window._factCancelar = () => {
    document.getElementById('fact-revision').style.display = 'none';
    document.getElementById('fact-procesando').style.display = 'none';
  };

  // ── Tabla de facturas ─────────────────────────────────────────────────────────
  window._factFiltrar = async () => {
    const params = new URLSearchParams();
    const fp = document.getElementById('fr-fp')?.value;
    const fc = document.getElementById('fr-fc')?.value;
    const fd = document.getElementById('fr-fd')?.value;
    const fh = document.getElementById('fr-fh')?.value;
    if (fp) params.set('proyecto_id', fp);
    if (fc) params.set('categoria', fc);
    if (fd) params.set('desde', fd);
    if (fh) params.set('hasta', fh);

    const lista = await api('GET', '/api/facturas?' + params.toString());
    const total = lista.reduce((s, f) => s + parseFloat(f.monto || 0), 0);

    const wrap = document.getElementById('fact-tabla-wrap');
    if (!lista.length) {
      wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">Sin facturas con los filtros seleccionados</div>`;
      return;
    }

    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:.85rem;color:var(--text-muted)">${lista.length} factura(s)</span>
        <span style="font-weight:700;color:var(--primary)">Total: ${fmt(total)}</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Foto</th><th>Fecha</th><th>Proveedor</th><th>Categoría</th>
            <th>Proyecto</th><th class="text-right">Monto</th><th>Descripción</th><th></th>
          </tr></thead>
          <tbody>
            ${lista.map(f => `<tr>
              <td>${f.url_foto
                ? `<img src="${f.url_foto}" style="width:44px;height:36px;object-fit:cover;border-radius:4px;cursor:pointer" onclick="openLightbox('${f.url_foto}')">`
                : `<span style="font-size:1.2rem">🧾</span>`}
              </td>
              <td>${fmtFecha(f.fecha)}</td>
              <td class="fw-bold">${f.proveedor||'—'}</td>
              <td><span class="badge badge-gray">${f.categoria||'—'}</span></td>
              <td>${f.proyecto_nombre||'<span style="color:var(--text-muted)">Sin proyecto</span>'}</td>
              <td class="text-right fw-bold">${fmt(f.monto)}</td>
              <td style="font-size:.82rem;color:var(--text-muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.descripcion||''}</td>
              <td><div class="gap-8">
                <button class="btn-icon" onclick="_factEditar(${f.id})">✏️</button>
                <button class="btn-icon" onclick="_factEliminar(${f.id})">🗑️</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  };

  window._factLimpiarFiltros = () => {
    ['fr-fp','fr-fc','fr-fd','fr-fh'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    _factFiltrar();
  };

  window._factEditar = async (id) => {
    const lista = await api('GET', '/api/facturas');
    const f = lista.find(x => x.id === id);
    if (!f) return;
    openModal('Editar Factura', `
      <div class="form-grid">
        <div class="form-group"><label>Proyecto</label>
          <select id="fe-p">${pOpts}</select></div>
        <div class="form-group"><label>Fecha</label>
          <input type="date" id="fe-fecha" value="${f.fecha||''}"></div>
        <div class="form-group"><label>Proveedor</label>
          <input id="fe-prov" value="${f.proveedor||''}"></div>
        <div class="form-group"><label>Categoría</label>
          <select id="fe-cat">${catOpts}</select></div>
        <div class="form-group"><label>Monto (COP)</label>
          <input type="number" id="fe-monto" value="${f.monto||0}"></div>
        <div class="form-group full"><label>Descripción</label>
          <input id="fe-desc" value="${f.descripcion||''}"></div>
        <div class="form-group full"><label>Notas</label>
          <input id="fe-notas" value="${f.notas||''}"></div>
      </div>`, async () => {
        document.getElementById('fe-p').value = f.proyecto_id || '';
        await api('PUT', `/api/facturas/${id}`, {
          proyecto_id:  document.getElementById('fe-p').value || null,
          fecha:        document.getElementById('fe-fecha').value,
          proveedor:    document.getElementById('fe-prov').value,
          categoria:    document.getElementById('fe-cat').value,
          monto:        parseFloat(document.getElementById('fe-monto').value)||0,
          descripcion:  document.getElementById('fe-desc').value,
          notas:        document.getElementById('fe-notas').value,
        });
        closeModal(); toast('Factura actualizada','success'); _factFiltrar();
      });
    // set values after render
    setTimeout(() => {
      document.getElementById('fe-p').value   = f.proyecto_id || '';
      document.getElementById('fe-cat').value = f.categoria   || 'Otros';
    }, 0);
  };

  window._factEliminar = async (id) => {
    if (!confirm('¿Eliminar esta factura? Se borrará también la imagen.')) return;
    await api('DELETE', `/api/facturas/${id}`);
    toast('Factura eliminada'); _factFiltrar();
  };

  // ── Gráficas ──────────────────────────────────────────────────────────────────
  window._factStats = async () => {
    const pid   = document.getElementById('fa-fp')?.value || '';
    const stats = await api('GET', '/api/facturas/stats' + (pid ? `?proyecto_id=${pid}` : ''));

    // KPIs
    const total    = parseFloat(stats.totales?.total || 0);
    const cantidad = parseInt(stats.totales?.cantidad || 0);
    const topCat   = stats.porCategoria[0];
    document.getElementById('fact-kpis').innerHTML = `
      <div class="kpi"><div class="v">${fmt(total)}</div><div class="l">Gasto total facturado</div></div>
      <div class="kpi"><div class="v">${cantidad}</div><div class="l">Facturas registradas</div></div>
      <div class="kpi"><div class="v">${cantidad ? fmt(total/cantidad) : '—'}</div><div class="l">Promedio por factura</div></div>
      <div class="kpi"><div class="v" style="font-size:1rem">${topCat ? topCat.categoria.split(' ')[0] : '—'}</div><div class="l">Categoría principal</div></div>`;

    // Gráfica por categoría
    destroyChart('factCat');
    if (stats.porCategoria.length) {
      const ctx = document.getElementById('chart-fact-cat').getContext('2d');
      charts['factCat'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels:   stats.porCategoria.map(r => r.categoria.replace(' de construcción','').replace(' y logística','')),
          datasets: [{ label: 'Total', data: stats.porCategoria.map(r => fmtRaw(r.total)),
            backgroundColor: stats.porCategoria.map((_,i) => CAT_COLORES[i % CAT_COLORES.length]),
            borderRadius: 4 }]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } },
          scales:{ y:{ ticks:{ callback: v => fmt(v/1e6)+'M' } } } }
      });
    }

    // Gráfica por proyecto
    destroyChart('factProy');
    if (stats.porProyecto.length) {
      const ctx = document.getElementById('chart-fact-proy').getContext('2d');
      charts['factProy'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels:   stats.porProyecto.map(r => r.proyecto),
          datasets: [{ label: 'Total', data: stats.porProyecto.map(r => fmtRaw(r.total)),
            backgroundColor: '#1a6b3c', borderRadius: 4 }]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } },
          scales:{ y:{ ticks:{ callback: v => fmt(v/1e6)+'M' } } } }
      });
    }

    // Gráfica evolución mensual
    destroyChart('factMes');
    if (stats.porMes.length) {
      const ctx = document.getElementById('chart-fact-mes').getContext('2d');
      charts['factMes'] = new Chart(ctx, {
        type: 'line',
        data: {
          labels:   stats.porMes.map(r => r.mes),
          datasets: [{ label: 'Gasto mensual', data: stats.porMes.map(r => fmtRaw(r.total)),
            borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.15)',
            fill: true, tension: 0.3, pointRadius: 4 }]
        },
        options: { responsive:true,
          scales:{ y:{ ticks:{ callback: v => fmt(v/1e6)+'M' } } } }
      });
    }
  };
}
