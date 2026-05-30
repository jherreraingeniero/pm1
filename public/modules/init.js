// ── Router ────────────────────────────────────────────────────────────────────
const secciones = {
  dashboard:       renderDashboard,
  proyectos:       renderProyectos,
  actividades:     renderActividades,
  personal:        renderPersonal,
  asistencia:      renderAsistencia,
  materiales:      renderMateriales,
  pagos:           renderPagos,
  clientes:        renderClientes,
  bitacora:        renderBitacora,
  subcontratistas: renderSubcontratistas,
  historial:       renderHistorial,
  presupuesto:     renderPresupuesto,
  fotos:           renderFotos,
  informes:        renderInformes,
  reporte:         renderReporte,
  facturas:        renderFacturas,
  configuracion:   renderConfiguracion,
};

const titulos = {
  dashboard: 'Dashboard', proyectos: 'Proyectos', actividades: 'Actividades',
  personal: 'Personal', asistencia: 'Control de Asistencia', materiales: 'Materiales',
  pagos: 'Pagos', clientes: 'Clientes', bitacora: 'Bitácora Diaria',
  subcontratistas: 'Subcontratistas', historial: 'Historial de Precios',
  presupuesto: 'Presupuesto vs Real', fotos: 'Fotos de Avance',
  informes: 'Informes PDF', reporte: 'Reporte Cliente',
  facturas: 'Facturación', configuracion: 'Configuración',
};

let seccionActual = 'dashboard';

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    const s = el.dataset.section;
    if (!secciones[s]) return;
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('pageTitle').textContent = titulos[s] || s;
    seccionActual = s;
    secciones[s]();
    closeSidebar();
  });
});

// ── Fecha en topbar ───────────────────────────────────────────────────────────
document.getElementById('fechaHoy').textContent =
  new Date().toLocaleDateString('es-CO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

// ── Arranque ──────────────────────────────────────────────────────────────────
(async () => {
  await loadConfig();
  renderDashboard();
})();
