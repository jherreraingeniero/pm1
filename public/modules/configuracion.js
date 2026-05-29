async function renderConfiguracion() {
  const c = document.getElementById('content');
  const cfg = await api('GET', '/api/configuracion');

  const COLORES_PRESET = [
    { nombre: 'Verde Construcción', primario: '#1a6b3c', acento: '#f59e0b' },
    { nombre: 'Azul Corporativo',   primario: '#1d4ed8', acento: '#f59e0b' },
    { nombre: 'Naranja Energía',    primario: '#c2410c', acento: '#0ea5e9' },
    { nombre: 'Gris Profesional',   primario: '#334155', acento: '#10b981' },
    { nombre: 'Violeta Moderno',    primario: '#6d28d9', acento: '#f59e0b' },
    { nombre: 'Rojo Tierra',        primario: '#991b1b', acento: '#d97706' },
  ];

  c.innerHTML = `
    <!-- Identidad de la empresa -->
    <div class="config-section">
      <h3>🏢 Identidad de la Empresa</h3>
      <div class="form-grid" style="max-width:520px">
        <div class="form-group full">
          <label>Nombre de la empresa / organización</label>
          <input id="cfg-empresa" value="${cfg.nombre_empresa||'GestObra'}"
            placeholder="Nombre que aparece en el menú y en los PDFs"
            oninput="_previewEmpresa(this.value)">
          <span style="font-size:.76rem;color:var(--text-muted);margin-top:3px">
            Vista previa en el sidebar: <strong id="prev-empresa">${cfg.nombre_empresa||'GestObra'}</strong>
          </span>
        </div>
      </div>
    </div>

    <!-- Tema de color -->
    <div class="config-section">
      <h3>🎨 Tema de Color</h3>
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px">
        Elige un esquema predefinido o personaliza los colores manualmente. Los cambios se aplican al instante.
      </p>
      <div style="font-size:.8rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">ESQUEMAS PREDEFINIDOS</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:20px">
        ${COLORES_PRESET.map(preset=>`
          <div class="currency-card" onclick="_aplicarPreset('${preset.primario}','${preset.acento}')"
               style="display:flex;align-items:center;gap:10px;padding:10px 14px;text-align:left">
            <div style="display:flex;gap:4px">
              <div style="width:20px;height:20px;border-radius:50%;background:${preset.primario};border:2px solid rgba(0,0,0,.1)"></div>
              <div style="width:20px;height:20px;border-radius:50%;background:${preset.acento};border:2px solid rgba(0,0,0,.1)"></div>
            </div>
            <span style="font-size:.8rem">${preset.nombre}</span>
          </div>`).join('')}
      </div>
      <div style="font-size:.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">PERSONALIZADO</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end">
        <div class="form-group">
          <label>Color principal (sidebar, botones)</label>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="color" id="cfg-color-p" value="${cfg.color_primario||'#1a6b3c'}"
              oninput="_previewColor(this.value,'p')"
              style="width:48px;height:36px;border-radius:6px;border:1px solid var(--border);cursor:pointer;padding:2px">
            <input type="text" id="cfg-color-p-hex" value="${cfg.color_primario||'#1a6b3c'}"
              style="width:100px;font-family:monospace"
              oninput="_syncColor(this.value,'p')">
          </div>
        </div>
        <div class="form-group">
          <label>Color de acento (resaltados, alertas)</label>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="color" id="cfg-color-a" value="${cfg.color_acento||'#f59e0b'}"
              oninput="_previewColor(this.value,'a')"
              style="width:48px;height:36px;border-radius:6px;border:1px solid var(--border);cursor:pointer;padding:2px">
            <input type="text" id="cfg-color-a-hex" value="${cfg.color_acento||'#f59e0b'}"
              style="width:100px;font-family:monospace"
              oninput="_syncColor(this.value,'a')">
          </div>
        </div>
        <div class="form-group">
          <label>Vista previa sidebar</label>
          <div id="sidebar-preview" style="width:140px;height:80px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
            <div id="sp-header" style="background:${darkenColor(cfg.color_primario||'#1a6b3c',0.25)};padding:8px 10px;display:flex;align-items:center;gap:6px">
              <span style="font-size:1rem">🏗️</span>
              <span id="sp-nombre" style="color:#fff;font-size:.72rem;font-weight:700">${cfg.nombre_empresa||'GestObra'}</span>
            </div>
            <div id="sp-body" style="background:${darkenColor(cfg.color_primario||'#1a6b3c',0.25)};padding:6px 10px;display:flex;flex-direction:column;gap:4px">
              <div style="background:rgba(255,255,255,.12);border-left:3px solid ${cfg.color_acento||'#f59e0b'};border-radius:3px;padding:3px 6px">
                <span style="color:#fff;font-size:.68rem">📊 Dashboard</span>
              </div>
              <div style="padding:3px 6px">
                <span style="color:rgba(255,255,255,.65);font-size:.68rem">🏢 Proyectos</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Divisa -->
    <div class="config-section">
      <h3>💱 Configuración de Divisa</h3>
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px">
        Todos los montos se guardan internamente en COP. La conversión es solo visual.
      </p>
      <div class="currency-cards">
        <div class="currency-card ${cfg.moneda==='COP'?'selected':''}" onclick="_selMoneda('COP')">
          <div class="c-symbol">$</div><div class="c-name">Peso Colombiano<br>COP</div>
        </div>
        <div class="currency-card ${cfg.moneda==='USD'?'selected':''}" onclick="_selMoneda('USD')">
          <div class="c-symbol">$</div><div class="c-name">Dólar Americano<br>USD</div>
        </div>
        <div class="currency-card ${cfg.moneda==='AED'?'selected':''}" onclick="_selMoneda('AED')">
          <div class="c-symbol">د.إ</div><div class="c-name">Dirham EAU<br>AED</div>
        </div>
      </div>
      <div class="config-grid" style="max-width:460px" id="tasas-wrap">
        <div class="form-group">
          <label>1 USD = ? COP</label>
          <input id="cfg-usd" type="number" value="${cfg.tasa_usd||4200}" placeholder="4200">
        </div>
        <div class="form-group">
          <label>1 AED = ? COP</label>
          <input id="cfg-aed" type="number" value="${cfg.tasa_aed||1143}" placeholder="1143">
        </div>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="_guardarCfg()">💾 Guardar Configuración</button>
      <button class="btn btn-secondary" onclick="_resetCfg()">↩️ Restaurar valores por defecto</button>
    </div>
  `;

  let monedaSel = cfg.moneda || 'COP';

  window._previewEmpresa = (v) => {
    document.getElementById('prev-empresa').textContent = v || 'GestObra';
    document.getElementById('sp-nombre').textContent = v || 'GestObra';
  };

  window._previewColor = (val, tipo) => {
    if (tipo === 'p') {
      document.getElementById('cfg-color-p-hex').value = val;
      document.getElementById('sp-header').style.background = darkenColor(val, 0.25);
      document.getElementById('sp-body').style.background   = darkenColor(val, 0.25);
      applyTheme({ ...window.CONFIG, color_primario: val });
    } else {
      document.getElementById('cfg-color-a-hex').value = val;
      document.getElementById('sp-body').querySelector('div').style.borderLeftColor = val;
      applyTheme({ ...window.CONFIG, color_acento: val });
    }
  };

  window._syncColor = (val, tipo) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(val)) return;
    if (tipo === 'p') document.getElementById('cfg-color-p').value = val;
    else              document.getElementById('cfg-color-a').value = val;
    window._previewColor(val, tipo);
  };

  window._aplicarPreset = (primario, acento) => {
    document.getElementById('cfg-color-p').value = primario;
    document.getElementById('cfg-color-a').value = acento;
    document.getElementById('cfg-color-p-hex').value = primario;
    document.getElementById('cfg-color-a-hex').value = acento;
    document.getElementById('sp-header').style.background = darkenColor(primario, 0.25);
    document.getElementById('sp-body').style.background   = darkenColor(primario, 0.25);
    document.getElementById('sp-body').querySelector('div').style.borderLeftColor = acento;
    applyTheme({ ...window.CONFIG, color_primario: primario, color_acento: acento });
  };

  window._selMoneda = (m) => {
    monedaSel = m;
    document.querySelectorAll('.currency-card').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
  };

  window._guardarCfg = async () => {
    const body = {
      nombre_empresa: document.getElementById('cfg-empresa').value || 'GestObra',
      moneda: monedaSel,
      tasa_usd: parseFloat(document.getElementById('cfg-usd').value) || 4200,
      tasa_aed: parseFloat(document.getElementById('cfg-aed').value) || 1143,
      color_primario: document.getElementById('cfg-color-p').value,
      color_acento:   document.getElementById('cfg-color-a').value,
    };
    await api('PUT', '/api/configuracion', body);
    window.CONFIG = { ...window.CONFIG, ...body };
    applyTheme(window.CONFIG);
    toast('Configuración guardada', 'success');
  };

  window._resetCfg = async () => {
    if (!confirm('¿Restaurar valores por defecto?')) return;
    const def = { nombre_empresa:'GestObra', moneda:'COP', tasa_usd:4200, tasa_aed:1143, color_primario:'#1a6b3c', color_acento:'#f59e0b' };
    await api('PUT', '/api/configuracion', def);
    window.CONFIG = { ...window.CONFIG, ...def };
    applyTheme(window.CONFIG);
    toast('Restaurado', 'success');
    renderConfiguracion();
  };
}
