// ── Configuración global ────────────────────────────────────────────────────
window.CONFIG = { moneda: 'COP', tasa_usd: 4200, tasa_aed: 1143, nombre_empresa: 'GestObra' };

async function loadConfig() {
  try {
    const cfg = await api('GET', '/api/configuracion');
    window.CONFIG = cfg;
    applyTheme(cfg);
  } catch (e) {}
}

function applyTheme(cfg) {
  const r = document.documentElement;
  const primario = cfg.color_primario || '#1a6b3c';
  // Derivar variantes del color principal
  r.style.setProperty('--primary', primario);
  r.style.setProperty('--primary-dark', darkenColor(primario, 0.25));
  r.style.setProperty('--primary-light', lightenColor(primario, 0.2));
  r.style.setProperty('--accent', cfg.color_acento || '#f59e0b');
  document.getElementById('logoEmpresa').textContent = cfg.nombre_empresa || 'GestObra';
  document.getElementById('monedaBadge').textContent = cfg.moneda || 'COP';
  document.title = (cfg.nombre_empresa || 'GestObra') + ' – Gestión de Proyectos';
}

function hexToHSL(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}else{
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}
    h/=6;
  }
  return [h*360,s*100,l*100];
}
function hslToHex(h,s,l){
  s/=100;l/=100;
  const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12;const c=l-a*Math.max(Math.min(k-3,9-k,1),-1);return Math.round(255*c).toString(16).padStart(2,'0');};
  return `#${f(0)}${f(8)}${f(4)}`;
}
function darkenColor(hex, amt) {
  try { const [h,s,l]=hexToHSL(hex); return hslToHex(h,s,Math.max(0,l-amt*100)); } catch { return hex; }
}
function lightenColor(hex, amt) {
  try { const [h,s,l]=hexToHSL(hex); return hslToHex(h,s,Math.min(100,l+amt*100)); } catch { return hex; }
}

// ── Utilidades ──────────────────────────────────────────────────────────────
function fmt(n) {
  const v = n || 0;
  const { moneda = 'COP', tasa_usd = 4200, tasa_aed = 1143 } = window.CONFIG;
  let amount = v;
  if (moneda === 'USD') amount = v / tasa_usd;
  else if (moneda === 'AED') amount = v / tasa_aed;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: moneda,
      maximumFractionDigits: moneda === 'COP' ? 0 : 2
    }).format(amount);
  } catch {
    return amount.toFixed(2) + ' ' + moneda;
  }
}

function fmtRaw(n) {
  const v = n || 0;
  const { moneda = 'COP', tasa_usd = 4200, tasa_aed = 1143 } = window.CONFIG;
  if (moneda === 'USD') return v / tasa_usd;
  if (moneda === 'AED') return v / tasa_aed;
  return v;
}

const fmtNum  = n => new Intl.NumberFormat('es-CO').format(n || 0);
const fmtFecha = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const hoy     = () => new Date().toISOString().split('T')[0];

// ── API helper ──────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

async function apiUpload(url, formData) {
  const r = await fetch(url, { method: 'POST', body: formData });
  return r.json();
}

// ── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ── Modal ────────────────────────────────────────────────────────────────────
let modalResolve = null;
function openModal(title, html, onSave, opts = {}) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalBackdrop').classList.add('open');
  const saveBtn = document.getElementById('modalSave');
  saveBtn.textContent = opts.saveLabel || 'Guardar';
  saveBtn.style.display = opts.hideSave ? 'none' : '';
  modalResolve = onSave;
}
function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  modalResolve = null;
}
document.getElementById('modalClose').onclick  = closeModal;
document.getElementById('modalCancel').onclick = closeModal;
document.getElementById('modalSave').onclick   = () => { if (modalResolve) modalResolve(); };
document.getElementById('modalBackdrop').onclick = e => { if (e.target.id === 'modalBackdrop') closeModal(); };

// ── Sidebar ──────────────────────────────────────────────────────────────────
document.getElementById('menuBtn').onclick = () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('open');
};
document.getElementById('sidebarClose').onclick = closeSidebar;
document.getElementById('overlay').onclick = closeSidebar;
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
function openLightbox(src) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.innerHTML = `<button class="lightbox-close" onclick="document.getElementById('lightbox').classList.remove('open')">✕</button><img id="lightbox-img" src="">`;
    lb.onclick = e => { if (e.target === lb) lb.classList.remove('open'); };
    document.body.appendChild(lb);
  }
  document.getElementById('lightbox-img').src = src;
  lb.classList.add('open');
}

// ── Chart registry (destroy before recreate) ─────────────────────────────────
const charts = {};
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyState(icon, msg) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${msg}</p></div>`;
}
function proyOpts(proyectos, selId) {
  return proyectos.map(p => `<option value="${p.id}" ${p.id == selId ? 'selected' : ''}>${p.nombre}</option>`).join('');
}
