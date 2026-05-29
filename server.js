const express = require('express');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const multer = require('multer');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'construccion.db');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `foto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo imágenes permitidas'));
  }
});

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS proyectos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
    descripcion TEXT, ubicacion TEXT, fecha_inicio TEXT, fecha_fin TEXT,
    presupuesto REAL DEFAULT 0, estado TEXT DEFAULT 'activo',
    cliente_id INTEGER, created_at TEXT DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS actividades (
    id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER NOT NULL,
    nombre TEXT NOT NULL, unidad TEXT DEFAULT 'und',
    cantidad_planificada REAL DEFAULT 0, cantidad_ejecutada REAL DEFAULT 0,
    costo_unitario REAL DEFAULT 0, estado TEXT DEFAULT 'pendiente',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS personal (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
    cargo TEXT, telefono TEXT, salario_diario REAL DEFAULT 0,
    proyecto_id INTEGER, activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS asistencia (
    id INTEGER PRIMARY KEY AUTOINCREMENT, personal_id INTEGER NOT NULL,
    proyecto_id INTEGER NOT NULL, fecha TEXT NOT NULL,
    estado TEXT DEFAULT 'presente', horas REAL DEFAULT 8,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(personal_id) REFERENCES personal(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS materiales (
    id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER NOT NULL,
    nombre TEXT NOT NULL, unidad TEXT DEFAULT 'und',
    cantidad_pedida REAL DEFAULT 0, cantidad_recibida REAL DEFAULT 0,
    cantidad_usada REAL DEFAULT 0, costo_unitario REAL DEFAULT 0,
    proveedor TEXT, fecha_pedido TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER NOT NULL,
    concepto TEXT NOT NULL, monto REAL DEFAULT 0,
    fecha_vencimiento TEXT, fecha_pago TEXT,
    estado TEXT DEFAULT 'pendiente', beneficiario TEXT, notas TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY, moneda TEXT DEFAULT 'COP',
    tasa_usd REAL DEFAULT 4200, tasa_aed REAL DEFAULT 1143,
    nombre_empresa TEXT DEFAULT 'GestObra', logo_url TEXT,
    color_primario TEXT DEFAULT '#1a6b3c',
    color_acento TEXT DEFAULT '#f59e0b')`);

  // Migraciones no destructivas para bases de datos existentes
  try { db.run(`ALTER TABLE configuracion ADD COLUMN color_primario TEXT DEFAULT '#1a6b3c'`); } catch {}
  try { db.run(`ALTER TABLE configuracion ADD COLUMN color_acento TEXT DEFAULT '#f59e0b'`); } catch {}

  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
    empresa TEXT, email TEXT, telefono TEXT, direccion TEXT,
    nit TEXT, notas TEXT, created_at TEXT DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS fotos_actividad (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actividad_id INTEGER,
    proyecto_id INTEGER NOT NULL, url TEXT NOT NULL,
    fecha TEXT, comentario TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(actividad_id) REFERENCES actividades(id),
    FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS bitacora (
    id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER NOT NULL,
    fecha TEXT NOT NULL, actividades_dia TEXT, incidentes TEXT,
    observaciones TEXT, clima TEXT, personal_presente INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS subcontratistas (
    id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER NOT NULL,
    nombre TEXT NOT NULL, empresa TEXT, telefono TEXT, especialidad TEXT,
    monto_contrato REAL DEFAULT 0, avance_certificado REAL DEFAULT 0,
    pagado REAL DEFAULT 0, fecha_inicio TEXT, fecha_fin TEXT,
    estado TEXT DEFAULT 'activo', notas TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS historial_precios (
    id INTEGER PRIMARY KEY AUTOINCREMENT, material_nombre TEXT NOT NULL,
    unidad TEXT, precio REAL NOT NULL, proveedor TEXT,
    fecha_compra TEXT NOT NULL, proyecto_id INTEGER,
    cantidad REAL DEFAULT 0, notas TEXT,
    created_at TEXT DEFAULT (datetime('now')))`);

  const cfg = query('SELECT id FROM configuracion WHERE id=1');
  if (!cfg.length) db.run(`INSERT INTO configuracion (id,moneda,tasa_usd,tasa_aed,nombre_empresa) VALUES (1,'COP',4200,1143,'GestObra')`);

  seedData();
  saveDB();
  console.log('Base de datos iniciada correctamente.');
}

function saveDB() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function lastId() {
  return query('SELECT last_insert_rowid() as id')[0].id;
}

function seedData() {
  const existing = query('SELECT COUNT(*) as c FROM proyectos');
  if (existing[0].c > 0) return;

  run(`INSERT INTO clientes (nombre,empresa,email,telefono,direccion,nit) VALUES ('Juan Carlos Pérez','Inversiones JCP SAS','jcperez@email.com','3001112233','Cra 10 #45-20','900.123.456-7')`);
  run(`INSERT INTO clientes (nombre,empresa,email,telefono,direccion,nit) VALUES ('María González','Constructora MG Ltda','mgonzalez@email.com','3109998877','Av. 68 #23-10','800.987.321-4')`);

  run(`INSERT INTO proyectos (nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id) VALUES ('Edificio Residencial Norte','Complejo de 12 apartamentos','Calle 45 #23-10','2026-01-15','2026-12-30',850000000,'activo',1)`);
  run(`INSERT INTO proyectos (nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id) VALUES ('Centro Comercial Sur','Local comercial 3 pisos','Av. Principal Km 2','2026-02-01','2026-10-15',1200000000,'activo',2)`);
  run(`INSERT INTO proyectos (nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id) VALUES ('Puente Vehicular','Puente sobre río principal','Vía rural sector 3','2025-08-01','2026-03-30',650000000,'finalizado',1)`);

  run(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (1,'Excavación','m³',500,320,45000,'en_progreso')`);
  run(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (1,'Cimentación','m³',200,200,320000,'completado')`);
  run(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (1,'Estructura metálica','ton',80,45,2800000,'en_progreso')`);
  run(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (1,'Mampostería piso 1','m²',600,600,85000,'completado')`);
  run(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (1,'Mampostería piso 2','m²',600,200,85000,'en_progreso')`);
  run(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (2,'Demolición zona','m²',800,800,25000,'completado')`);
  run(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (2,'Pilotes','und',60,20,1500000,'en_progreso')`);
  run(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (2,'Losa piso 1','m²',1200,0,180000,'pendiente')`);

  run(`INSERT INTO personal (nombre,cargo,telefono,salario_diario,proyecto_id) VALUES ('Carlos Mendoza','Maestro de obra','3001234567',120000,1)`);
  run(`INSERT INTO personal (nombre,cargo,telefono,salario_diario,proyecto_id) VALUES ('Pedro Gómez','Oficial albañil','3009876543',90000,1)`);
  run(`INSERT INTO personal (nombre,cargo,telefono,salario_diario,proyecto_id) VALUES ('Luis Torres','Ayudante','3005551234',65000,1)`);
  run(`INSERT INTO personal (nombre,cargo,telefono,salario_diario,proyecto_id) VALUES ('Andrés Ruiz','Maestro de obra','3007778899',120000,2)`);
  run(`INSERT INTO personal (nombre,cargo,telefono,salario_diario,proyecto_id) VALUES ('Juan Herrera','Electricista','3112223344',95000,2)`);

  const hoy = new Date();
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - i);
    const f = fecha.toISOString().split('T')[0];
    if (fecha.getDay() !== 0 && fecha.getDay() !== 6) {
      run(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (1,1,'${f}','presente',8)`);
      run(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (2,1,'${f}','presente',8)`);
      run(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (3,1,'${f}',${i===2?"'ausente',0":"'presente',8"})`);
      run(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (4,2,'${f}','presente',8)`);
    }
  }

  run(`INSERT INTO materiales (proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido) VALUES (1,'Cemento Portland','bulto',1000,800,650,28000,'Cementos del Valle','2026-01-20')`);
  run(`INSERT INTO materiales (proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido) VALUES (1,'Acero 1/2"','barra',2000,2000,1500,18500,'Aceros SAS','2026-01-18')`);
  run(`INSERT INTO materiales (proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido) VALUES (1,'Arena de río','m³',200,150,120,65000,'Agregados Norte','2026-02-01')`);
  run(`INSERT INTO materiales (proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido) VALUES (2,'Concreto 3000 PSI','m³',500,100,80,420000,'Premezclados SA','2026-02-10')`);
  run(`INSERT INTO materiales (proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido) VALUES (2,'Formaleta metálica','und',50,50,50,380000,'Alquiequipos','2026-02-05')`);

  run(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,created_at) VALUES (1,'Nomina personal marzo',8500000,'2026-03-31','pagado','Personal obra',datetime('now','-60 days'))`);
  run(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,created_at) VALUES (1,'Factura cemento - Cementos Valle',22400000,'2026-04-15','pagado','Cementos del Valle',datetime('now','-45 days'))`);
  run(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,created_at) VALUES (1,'Nomina personal abril',8500000,'2026-04-30','vencido','Personal obra',datetime('now','-30 days'))`);
  run(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,created_at) VALUES (1,'Acero estructural - Aceros SAS',37000000,'2026-05-10','vencido','Aceros SAS',datetime('now','-20 days'))`);
  run(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,created_at) VALUES (1,'Nomina personal mayo',8500000,'2026-05-31','pendiente','Personal obra',datetime('now','-10 days'))`);
  run(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,created_at) VALUES (2,'Factura pilotes - ContratistaSAS',30000000,'2026-05-20','pendiente','Contratista SAS',datetime('now','-8 days'))`);
  run(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,created_at) VALUES (2,'Equipos excavación',15000000,'2026-06-01','pendiente','AlquiMaq Ltda',datetime('now','-3 days'))`);

  run(`INSERT INTO subcontratistas (proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado) VALUES (1,'Roberto Vargas','ElectraObra SAS','3154445566','Instalaciones eléctricas',45000000,60,27000000,'2026-03-01','2026-08-30','activo')`);
  run(`INSERT INTO subcontratistas (proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado) VALUES (1,'Diana Cruz','PlomAndes Ltda','3167776655','Plomería y redes hidrosanitarias',38000000,40,15200000,'2026-03-15','2026-09-15','activo')`);
  run(`INSERT INTO subcontratistas (proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado) VALUES (2,'Constructora Pilotes SA','Pilotes SA','3001002030','Hincado de pilotes',90000000,35,31500000,'2026-02-10','2026-05-30','activo')`);

  run(`INSERT INTO historial_precios (material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas) VALUES ('Cemento Portland','bulto',26000,'Cementos del Valle','2025-10-01',1,500,'Primer pedido')`);
  run(`INSERT INTO historial_precios (material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas) VALUES ('Cemento Portland','bulto',27500,'Cementos del Valle','2025-12-15',1,300,'Segundo pedido - subida de precio')`);
  run(`INSERT INTO historial_precios (material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas) VALUES ('Cemento Portland','bulto',28000,'Cementos del Valle','2026-01-20',1,1000,'Tercer pedido')`);
  run(`INSERT INTO historial_precios (material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas) VALUES ('Acero 1/2"','barra',17000,'Aceros SAS','2025-11-01',1,1000,'Primer lote')`);
  run(`INSERT INTO historial_precios (material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas) VALUES ('Acero 1/2"','barra',18500,'Aceros SAS','2026-01-18',1,2000,'Segundo lote - nueva cotización')`);

  const fechaBit = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(fechaBit);
    d.setDate(fechaBit.getDate() - i);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      run(`INSERT INTO bitacora (proyecto_id,fecha,actividades_dia,incidentes,observaciones,clima,personal_presente) VALUES (1,'${d.toISOString().split('T')[0]}','Avance en mampostería piso 2 y estructura metálica','Sin incidentes relevantes','Se requiere mayor personal para próxima semana','Soleado parcialmente nublado',4)`);
    }
  }
}

// ─── API: CONFIGURACIÓN ────────────────────────────────────────────────────
app.get('/api/configuracion', (req, res) => {
  const r = query('SELECT * FROM configuracion WHERE id=1');
  res.json(r[0] || { id:1, moneda:'COP', tasa_usd:4200, tasa_aed:1143, nombre_empresa:'GestObra' });
});
app.put('/api/configuracion', (req, res) => {
  const { moneda, tasa_usd, tasa_aed, nombre_empresa, color_primario, color_acento } = req.body;
  run(`UPDATE configuracion SET moneda=?,tasa_usd=?,tasa_aed=?,nombre_empresa=?,color_primario=?,color_acento=? WHERE id=1`,
    [moneda, tasa_usd, tasa_aed, nombre_empresa, color_primario || '#1a6b3c', color_acento || '#f59e0b']);
  res.json({ ok: true });
});

// ─── API: DASHBOARD ────────────────────────────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  const proyectos   = query('SELECT * FROM proyectos');
  const actividades = query('SELECT * FROM actividades');
  const pagos       = query('SELECT * FROM pagos');
  const hoy = new Date().toISOString().split('T')[0];
  const asistenciaHoy = query(`SELECT COUNT(*) as c FROM asistencia WHERE fecha=? AND estado='presente'`, [hoy]);

  const alertas = query(`SELECT pg.*, p.nombre as proyecto_nombre FROM pagos pg JOIN proyectos p ON pg.proyecto_id=p.id
    WHERE pg.estado IN ('pendiente','vencido') AND DATE(pg.created_at) <= DATE('now','-7 days')
    ORDER BY pg.created_at ASC`);

  const avancePorProyecto = proyectos.map(p => {
    const acts = actividades.filter(a => a.proyecto_id === p.id);
    const avance = acts.length
      ? Math.round(acts.reduce((s,a) => s + (a.cantidad_planificada > 0 ? a.cantidad_ejecutada/a.cantidad_planificada : 0), 0) / acts.length * 100)
      : 0;
    const costoEjec = acts.reduce((s,a) => s + a.cantidad_ejecutada * a.costo_unitario, 0);
    const costoPlan = acts.reduce((s,a) => s + a.cantidad_planificada * a.costo_unitario, 0);
    return { id: p.id, nombre: p.nombre, avance, estado: p.estado, presupuesto: p.presupuesto, costoEjec, costoPlan };
  });

  res.json({
    totalProyectos: proyectos.length,
    activos: proyectos.filter(p => p.estado === 'activo').length,
    avanceTotal: avancePorProyecto.length
      ? Math.round(avancePorProyecto.reduce((s,p) => s+p.avance, 0) / avancePorProyecto.length)
      : 0,
    pagosPendientes: pagos.filter(p => p.estado === 'pendiente').reduce((s,p) => s+p.monto, 0),
    pagosVencidos:   pagos.filter(p => p.estado === 'vencido').reduce((s,p) => s+p.monto, 0),
    personalHoy: asistenciaHoy[0].c,
    actividadesPorEstado: {
      pendiente:   actividades.filter(a => a.estado === 'pendiente').length,
      en_progreso: actividades.filter(a => a.estado === 'en_progreso').length,
      completado:  actividades.filter(a => a.estado === 'completado').length,
    },
    avancePorProyecto,
    alertas
  });
});

// ─── API: PRESUPUESTO ──────────────────────────────────────────────────────
app.get('/api/presupuesto/:id', (req, res) => {
  const pid = req.params.id;
  const proyecto = query('SELECT * FROM proyectos WHERE id=?', [pid])[0];
  if (!proyecto) return res.status(404).json({ error: 'No encontrado' });
  const acts = query('SELECT * FROM actividades WHERE proyecto_id=?', [pid]);
  const mats = query('SELECT * FROM materiales WHERE proyecto_id=?', [pid]);
  const pags = query('SELECT * FROM pagos WHERE proyecto_id=?', [pid]);
  const subs = query('SELECT * FROM subcontratistas WHERE proyecto_id=?', [pid]);
  const costoPlanActs = acts.reduce((s,a) => s + a.cantidad_planificada * a.costo_unitario, 0);
  const costoEjecActs = acts.reduce((s,a) => s + a.cantidad_ejecutada * a.costo_unitario, 0);
  const costoMateriales = mats.reduce((s,m) => s + m.cantidad_usada * m.costo_unitario, 0);
  const pagado   = pags.filter(p => p.estado === 'pagado').reduce((s,p) => s+p.monto, 0);
  const comprometido = pags.reduce((s,p) => s+p.monto, 0);
  const subcontratos = subs.reduce((s,sc) => s+sc.monto_contrato, 0);
  const gastoTotal = costoEjecActs + costoMateriales;
  res.json({
    presupuesto: proyecto.presupuesto,
    costoPlanActs, costoEjecActs, costoMateriales,
    gastoTotal, pagado, comprometido, subcontratos,
    diferencia: proyecto.presupuesto - gastoTotal,
    sobrecosto: gastoTotal > proyecto.presupuesto,
    porcentajeUtilizado: proyecto.presupuesto > 0 ? Math.round(gastoTotal / proyecto.presupuesto * 100) : 0
  });
});

// ─── API: PROYECTOS ────────────────────────────────────────────────────────
app.get('/api/proyectos', (req, res) => res.json(
  query('SELECT p.*, c.nombre as cliente_nombre FROM proyectos p LEFT JOIN clientes c ON p.cliente_id=c.id ORDER BY p.created_at DESC')));

app.post('/api/proyectos', (req, res) => {
  const { nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id } = req.body;
  run(`INSERT INTO proyectos (nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id) VALUES (?,?,?,?,?,?,?,?)`,
    [nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto||0,estado||'activo',cliente_id||null]);
  res.json({ ok:true });
});
app.put('/api/proyectos/:id', (req, res) => {
  const { nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id } = req.body;
  run(`UPDATE proyectos SET nombre=?,descripcion=?,ubicacion=?,fecha_inicio=?,fecha_fin=?,presupuesto=?,estado=?,cliente_id=? WHERE id=?`,
    [nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id||null,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/proyectos/:id', (req, res) => {
  run('DELETE FROM proyectos WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ─── API: ACTIVIDADES ──────────────────────────────────────────────────────
app.get('/api/actividades', (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT a.*,p.nombre as proyecto_nombre FROM actividades a JOIN proyectos p ON a.proyecto_id=p.id`;
  const params = [];
  if (proyecto_id) { sql += ' WHERE a.proyecto_id=?'; params.push(proyecto_id); }
  res.json(query(sql + ' ORDER BY a.created_at DESC', params));
});
app.post('/api/actividades', (req, res) => {
  const { proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado } = req.body;
  run(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (?,?,?,?,?,?,?)`,
    [proyecto_id,nombre,unidad||'und',cantidad_planificada||0,cantidad_ejecutada||0,costo_unitario||0,estado||'pendiente']);
  res.json({ ok:true, id: lastId() });
});
app.put('/api/actividades/:id', (req, res) => {
  const { nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado } = req.body;
  run(`UPDATE actividades SET nombre=?,unidad=?,cantidad_planificada=?,cantidad_ejecutada=?,costo_unitario=?,estado=? WHERE id=?`,
    [nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/actividades/:id', (req, res) => {
  run('DELETE FROM actividades WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ─── API: FOTOS ────────────────────────────────────────────────────────────
app.get('/api/fotos', (req, res) => {
  const { actividad_id, proyecto_id } = req.query;
  let sql = `SELECT f.*,a.nombre as actividad_nombre,p.nombre as proyecto_nombre FROM fotos_actividad f
    LEFT JOIN actividades a ON f.actividad_id=a.id JOIN proyectos p ON f.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (actividad_id) { sql += ' AND f.actividad_id=?'; params.push(actividad_id); }
  if (proyecto_id)  { sql += ' AND f.proyecto_id=?';  params.push(proyecto_id); }
  res.json(query(sql + ' ORDER BY f.fecha DESC, f.created_at DESC', params));
});
app.post('/api/fotos', upload.single('foto'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  const { actividad_id, proyecto_id, fecha, comentario } = req.body;
  const url = '/uploads/' + req.file.filename;
  run(`INSERT INTO fotos_actividad (actividad_id,proyecto_id,url,fecha,comentario) VALUES (?,?,?,?,?)`,
    [actividad_id||null, proyecto_id, url, fecha||new Date().toISOString().split('T')[0], comentario||'']);
  res.json({ ok:true, url });
});
app.delete('/api/fotos/:id', (req, res) => {
  const foto = query('SELECT * FROM fotos_actividad WHERE id=?', [req.params.id])[0];
  if (foto) {
    const filePath = path.join(__dirname, 'public', foto.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    run('DELETE FROM fotos_actividad WHERE id=?', [req.params.id]);
  }
  res.json({ ok:true });
});

// ─── API: PERSONAL ─────────────────────────────────────────────────────────
app.get('/api/personal', (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT p.*,pr.nombre as proyecto_nombre FROM personal p LEFT JOIN proyectos pr ON p.proyecto_id=pr.id WHERE p.activo=1`;
  const params = [];
  if (proyecto_id) { sql += ' AND p.proyecto_id=?'; params.push(proyecto_id); }
  res.json(query(sql, params));
});
app.post('/api/personal', (req, res) => {
  const { nombre,cargo,telefono,salario_diario,proyecto_id } = req.body;
  run(`INSERT INTO personal (nombre,cargo,telefono,salario_diario,proyecto_id) VALUES (?,?,?,?,?)`,
    [nombre,cargo,telefono,salario_diario||0,proyecto_id||null]);
  res.json({ ok:true });
});
app.put('/api/personal/:id', (req, res) => {
  const { nombre,cargo,telefono,salario_diario,proyecto_id,activo } = req.body;
  run(`UPDATE personal SET nombre=?,cargo=?,telefono=?,salario_diario=?,proyecto_id=?,activo=? WHERE id=?`,
    [nombre,cargo,telefono,salario_diario,proyecto_id||null,activo!==undefined?activo:1,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/personal/:id', (req, res) => {
  run('UPDATE personal SET activo=0 WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ─── API: ASISTENCIA ───────────────────────────────────────────────────────
app.get('/api/asistencia', (req, res) => {
  const { fecha, proyecto_id } = req.query;
  let sql = `SELECT a.*,p.nombre as personal_nombre,p.cargo,pr.nombre as proyecto_nombre
    FROM asistencia a JOIN personal p ON a.personal_id=p.id JOIN proyectos pr ON a.proyecto_id=pr.id WHERE 1=1`;
  const params = [];
  if (fecha)      { sql += ' AND a.fecha=?';       params.push(fecha); }
  if (proyecto_id){ sql += ' AND a.proyecto_id=?'; params.push(proyecto_id); }
  res.json(query(sql + ' ORDER BY a.fecha DESC,p.nombre', params));
});
app.post('/api/asistencia', (req, res) => {
  const { personal_id, proyecto_id, fecha, estado, horas } = req.body;
  const exists = query('SELECT id FROM asistencia WHERE personal_id=? AND fecha=?', [personal_id, fecha]);
  if (exists.length) {
    run('UPDATE asistencia SET estado=?,horas=? WHERE personal_id=? AND fecha=?',
      [estado, horas||8, personal_id, fecha]);
  } else {
    run(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (?,?,?,?,?)`,
      [personal_id, proyecto_id, fecha, estado||'presente', horas||8]);
  }
  res.json({ ok:true });
});

// ─── API: MATERIALES ───────────────────────────────────────────────────────
app.get('/api/materiales', (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT m.*,p.nombre as proyecto_nombre FROM materiales m JOIN proyectos p ON m.proyecto_id=p.id`;
  const params = [];
  if (proyecto_id) { sql += ' WHERE m.proyecto_id=?'; params.push(proyecto_id); }
  res.json(query(sql + ' ORDER BY m.created_at DESC', params));
});
app.post('/api/materiales', (req, res) => {
  const { proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido } = req.body;
  run(`INSERT INTO materiales (proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido) VALUES (?,?,?,?,?,?,?,?,?)`,
    [proyecto_id,nombre,unidad||'und',cantidad_pedida||0,cantidad_recibida||0,cantidad_usada||0,costo_unitario||0,proveedor,fecha_pedido]);
  res.json({ ok:true });
});
app.put('/api/materiales/:id', (req, res) => {
  const { nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido } = req.body;
  run(`UPDATE materiales SET nombre=?,unidad=?,cantidad_pedida=?,cantidad_recibida=?,cantidad_usada=?,costo_unitario=?,proveedor=?,fecha_pedido=? WHERE id=?`,
    [nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/materiales/:id', (req, res) => {
  run('DELETE FROM materiales WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ─── API: PAGOS ────────────────────────────────────────────────────────────
app.get('/api/pagos', (req, res) => {
  const { proyecto_id, estado } = req.query;
  let sql = `SELECT pg.*,p.nombre as proyecto_nombre FROM pagos pg JOIN proyectos p ON pg.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (proyecto_id) { sql += ' AND pg.proyecto_id=?'; params.push(proyecto_id); }
  if (estado)      { sql += ' AND pg.estado=?';       params.push(estado); }
  res.json(query(sql + ' ORDER BY pg.fecha_vencimiento ASC', params));
});
app.post('/api/pagos', (req, res) => {
  const { proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,notas } = req.body;
  run(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,notas) VALUES (?,?,?,?,?,?,?)`,
    [proyecto_id,concepto,monto||0,fecha_vencimiento,estado||'pendiente',beneficiario,notas]);
  res.json({ ok:true });
});
app.put('/api/pagos/:id', (req, res) => {
  const { concepto,monto,fecha_vencimiento,fecha_pago,estado,beneficiario,notas } = req.body;
  run(`UPDATE pagos SET concepto=?,monto=?,fecha_vencimiento=?,fecha_pago=?,estado=?,beneficiario=?,notas=? WHERE id=?`,
    [concepto,monto,fecha_vencimiento,fecha_pago,estado,beneficiario,notas,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/pagos/:id', (req, res) => {
  run('DELETE FROM pagos WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ─── API: CLIENTES ─────────────────────────────────────────────────────────
app.get('/api/clientes', (req, res) => res.json(query('SELECT * FROM clientes ORDER BY nombre')));
app.post('/api/clientes', (req, res) => {
  const { nombre,empresa,email,telefono,direccion,nit,notas } = req.body;
  run(`INSERT INTO clientes (nombre,empresa,email,telefono,direccion,nit,notas) VALUES (?,?,?,?,?,?,?)`,
    [nombre,empresa,email,telefono,direccion,nit,notas]);
  res.json({ ok:true });
});
app.put('/api/clientes/:id', (req, res) => {
  const { nombre,empresa,email,telefono,direccion,nit,notas } = req.body;
  run(`UPDATE clientes SET nombre=?,empresa=?,email=?,telefono=?,direccion=?,nit=?,notas=? WHERE id=?`,
    [nombre,empresa,email,telefono,direccion,nit,notas,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/clientes/:id', (req, res) => {
  run('DELETE FROM clientes WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ─── API: BITÁCORA ─────────────────────────────────────────────────────────
app.get('/api/bitacora', (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT b.*,p.nombre as proyecto_nombre FROM bitacora b JOIN proyectos p ON b.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (proyecto_id) { sql += ' AND b.proyecto_id=?'; params.push(proyecto_id); }
  res.json(query(sql + ' ORDER BY b.fecha DESC', params));
});
app.post('/api/bitacora', (req, res) => {
  const { proyecto_id,fecha,actividades_dia,incidentes,observaciones,clima,personal_presente } = req.body;
  run(`INSERT INTO bitacora (proyecto_id,fecha,actividades_dia,incidentes,observaciones,clima,personal_presente) VALUES (?,?,?,?,?,?,?)`,
    [proyecto_id,fecha,actividades_dia,incidentes,observaciones,clima,personal_presente||0]);
  res.json({ ok:true, id: lastId() });
});
app.put('/api/bitacora/:id', (req, res) => {
  const { actividades_dia,incidentes,observaciones,clima,personal_presente } = req.body;
  run(`UPDATE bitacora SET actividades_dia=?,incidentes=?,observaciones=?,clima=?,personal_presente=? WHERE id=?`,
    [actividades_dia,incidentes,observaciones,clima,personal_presente||0,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/bitacora/:id', (req, res) => {
  run('DELETE FROM bitacora WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ─── API: SUBCONTRATISTAS ──────────────────────────────────────────────────
app.get('/api/subcontratistas', (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT s.*,p.nombre as proyecto_nombre FROM subcontratistas s JOIN proyectos p ON s.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (proyecto_id) { sql += ' AND s.proyecto_id=?'; params.push(proyecto_id); }
  res.json(query(sql + ' ORDER BY s.created_at DESC', params));
});
app.post('/api/subcontratistas', (req, res) => {
  const { proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado,notas } = req.body;
  run(`INSERT INTO subcontratistas (proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado,notas) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato||0,avance_certificado||0,pagado||0,fecha_inicio,fecha_fin,estado||'activo',notas]);
  res.json({ ok:true });
});
app.put('/api/subcontratistas/:id', (req, res) => {
  const { nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado,notas } = req.body;
  run(`UPDATE subcontratistas SET nombre=?,empresa=?,telefono=?,especialidad=?,monto_contrato=?,avance_certificado=?,pagado=?,fecha_inicio=?,fecha_fin=?,estado=?,notas=? WHERE id=?`,
    [nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado,notas,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/subcontratistas/:id', (req, res) => {
  run('DELETE FROM subcontratistas WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ─── API: HISTORIAL PRECIOS ────────────────────────────────────────────────
app.get('/api/historial-precios', (req, res) => {
  const { material } = req.query;
  let sql = `SELECT h.*,p.nombre as proyecto_nombre FROM historial_precios h LEFT JOIN proyectos p ON h.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (material) { sql += ' AND h.material_nombre LIKE ?'; params.push(`%${material}%`); }
  res.json(query(sql + ' ORDER BY h.fecha_compra DESC', params));
});
app.get('/api/historial-precios/materiales', (req, res) => {
  res.json(query('SELECT DISTINCT material_nombre FROM historial_precios ORDER BY material_nombre'));
});
app.post('/api/historial-precios', (req, res) => {
  const { material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas } = req.body;
  run(`INSERT INTO historial_precios (material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas) VALUES (?,?,?,?,?,?,?,?)`,
    [material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id||null,cantidad||0,notas]);
  res.json({ ok:true });
});
app.delete('/api/historial-precios/:id', (req, res) => {
  run('DELETE FROM historial_precios WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ─── API: REPORTE CLIENTE (sin costos internos) ────────────────────────────
app.get('/api/reporte-cliente/:id', (req, res) => {
  const pid = req.params.id;
  const proyecto = query('SELECT p.*,c.nombre as cliente_nombre,c.empresa as cliente_empresa FROM proyectos p LEFT JOIN clientes c ON p.cliente_id=c.id WHERE p.id=?', [pid])[0];
  if (!proyecto) return res.status(404).json({ error: 'No encontrado' });
  const acts = query('SELECT id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,estado FROM actividades WHERE proyecto_id=?', [pid]);
  const fotos = query('SELECT f.*,a.nombre as actividad_nombre FROM fotos_actividad f LEFT JOIN actividades a ON f.actividad_id=a.id WHERE f.proyecto_id=? ORDER BY f.fecha DESC', [pid]);
  const bitacora = query('SELECT fecha,actividades_dia,observaciones,clima,personal_presente FROM bitacora WHERE proyecto_id=? ORDER BY fecha DESC LIMIT 10', [pid]);
  const avance = acts.length
    ? Math.round(acts.reduce((s,a) => s+(a.cantidad_planificada>0?a.cantidad_ejecutada/a.cantidad_planificada:0),0)/acts.length*100)
    : 0;
  res.json({ proyecto, actividades: acts, fotos, bitacora, avance });
});

// ─── SPA Fallback ──────────────────────────────────────────────────────────
app.get('/reporte-cliente', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reporte-cliente.html')));
app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDB().then(() => {
  app.listen(PORT, () => console.log(`\n✅ Servidor iniciado en http://localhost:${PORT}\n`));
}).catch(console.error);
