const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const multer    = require('multer');
const sharp     = require('sharp');
const Anthropic = require('@anthropic-ai/sdk');

const IS_PG = !!process.env.DATABASE_URL;   // true en Railway, false en local
const app    = express();
const PORT   = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `foto_${Date.now()}_${Math.random().toString(36).slice(2,7)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Solo imágenes'))
});

// ── Capa de base de datos (SQLite local / PostgreSQL producción) ───────────────
let pgPool, sqliteDb;

// Convierte ? → $1, $2, ... para PostgreSQL
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// SQLite helpers síncronos
function _sqliteQuery(sql, params = []) {
  const stmt = sqliteDb.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function _sqliteSave() {
  fs.writeFileSync(path.join(__dirname, 'construccion.db'), Buffer.from(sqliteDb.export()));
}

// Interfaz unificada (siempre async)
async function dbQuery(sql, params = []) {
  if (IS_PG) {
    const { rows } = await pgPool.query(toPg(sql), params);
    return rows;
  }
  return _sqliteQuery(sql, params);
}

async function dbRun(sql, params = []) {
  if (IS_PG) {
    let pgSql = toPg(sql);
    const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
    if (isInsert) pgSql += ' RETURNING id';
    const result = await pgPool.query(pgSql, params);
    return isInsert ? (result.rows[0] || {}) : {};
  }
  sqliteDb.run(sql, params);
  _sqliteSave();
  const r = _sqliteQuery('SELECT last_insert_rowid() as id');
  return { id: r[0]?.id };
}

// ── Schema ────────────────────────────────────────────────────────────────────
async function createTables() {
  const serial = IS_PG ? 'SERIAL' : 'INTEGER';
  const ai     = IS_PG ? ''       : 'AUTOINCREMENT';
  const now    = IS_PG ? 'NOW()'  : "datetime('now')";
  const tsType = IS_PG ? 'TIMESTAMPTZ' : 'TEXT';

  const tables = [
    `CREATE TABLE IF NOT EXISTS proyectos (
      id ${serial} PRIMARY KEY ${ai}, nombre TEXT NOT NULL,
      descripcion TEXT, ubicacion TEXT, fecha_inicio TEXT, fecha_fin TEXT,
      presupuesto REAL DEFAULT 0, estado TEXT DEFAULT 'activo',
      cliente_id INTEGER, created_at ${tsType} DEFAULT (${now}))`,

    `CREATE TABLE IF NOT EXISTS actividades (
      id ${serial} PRIMARY KEY ${ai}, proyecto_id INTEGER NOT NULL,
      nombre TEXT NOT NULL, unidad TEXT DEFAULT 'und',
      cantidad_planificada REAL DEFAULT 0, cantidad_ejecutada REAL DEFAULT 0,
      costo_unitario REAL DEFAULT 0, estado TEXT DEFAULT 'pendiente',
      created_at ${tsType} DEFAULT (${now}),
      FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`,

    `CREATE TABLE IF NOT EXISTS personal (
      id ${serial} PRIMARY KEY ${ai}, nombre TEXT NOT NULL,
      cargo TEXT, telefono TEXT, salario_diario REAL DEFAULT 0,
      proyecto_id INTEGER, activo INTEGER DEFAULT 1,
      created_at ${tsType} DEFAULT (${now}),
      FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`,

    `CREATE TABLE IF NOT EXISTS asistencia (
      id ${serial} PRIMARY KEY ${ai}, personal_id INTEGER NOT NULL,
      proyecto_id INTEGER NOT NULL, fecha TEXT NOT NULL,
      estado TEXT DEFAULT 'presente', horas REAL DEFAULT 8,
      created_at ${tsType} DEFAULT (${now}),
      FOREIGN KEY(personal_id) REFERENCES personal(id))`,

    `CREATE TABLE IF NOT EXISTS materiales (
      id ${serial} PRIMARY KEY ${ai}, proyecto_id INTEGER NOT NULL,
      nombre TEXT NOT NULL, unidad TEXT DEFAULT 'und',
      cantidad_pedida REAL DEFAULT 0, cantidad_recibida REAL DEFAULT 0,
      cantidad_usada REAL DEFAULT 0, costo_unitario REAL DEFAULT 0,
      proveedor TEXT, fecha_pedido TEXT,
      created_at ${tsType} DEFAULT (${now}),
      FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`,

    `CREATE TABLE IF NOT EXISTS pagos (
      id ${serial} PRIMARY KEY ${ai}, proyecto_id INTEGER NOT NULL,
      concepto TEXT NOT NULL, monto REAL DEFAULT 0,
      fecha_vencimiento TEXT, fecha_pago TEXT,
      estado TEXT DEFAULT 'pendiente', beneficiario TEXT, notas TEXT,
      created_at ${tsType} DEFAULT (${now}),
      FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`,

    `CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY, moneda TEXT DEFAULT 'COP',
      tasa_usd REAL DEFAULT 4200, tasa_aed REAL DEFAULT 1143,
      nombre_empresa TEXT DEFAULT 'GestObra', logo_url TEXT,
      color_primario TEXT DEFAULT '#1a6b3c',
      color_acento TEXT DEFAULT '#f59e0b')`,

    `CREATE TABLE IF NOT EXISTS clientes (
      id ${serial} PRIMARY KEY ${ai}, nombre TEXT NOT NULL,
      empresa TEXT, email TEXT, telefono TEXT, direccion TEXT,
      nit TEXT, notas TEXT, created_at ${tsType} DEFAULT (${now}))`,

    `CREATE TABLE IF NOT EXISTS fotos_actividad (
      id ${serial} PRIMARY KEY ${ai}, actividad_id INTEGER,
      proyecto_id INTEGER NOT NULL, url TEXT NOT NULL,
      fecha TEXT, comentario TEXT,
      created_at ${tsType} DEFAULT (${now}),
      FOREIGN KEY(actividad_id) REFERENCES actividades(id),
      FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`,

    `CREATE TABLE IF NOT EXISTS bitacora (
      id ${serial} PRIMARY KEY ${ai}, proyecto_id INTEGER NOT NULL,
      fecha TEXT NOT NULL, actividades_dia TEXT, incidentes TEXT,
      observaciones TEXT, clima TEXT, personal_presente INTEGER DEFAULT 0,
      created_at ${tsType} DEFAULT (${now}),
      FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`,

    `CREATE TABLE IF NOT EXISTS subcontratistas (
      id ${serial} PRIMARY KEY ${ai}, proyecto_id INTEGER NOT NULL,
      nombre TEXT NOT NULL, empresa TEXT, telefono TEXT, especialidad TEXT,
      monto_contrato REAL DEFAULT 0, avance_certificado REAL DEFAULT 0,
      pagado REAL DEFAULT 0, fecha_inicio TEXT, fecha_fin TEXT,
      estado TEXT DEFAULT 'activo', notas TEXT,
      created_at ${tsType} DEFAULT (${now}),
      FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`,

    `CREATE TABLE IF NOT EXISTS historial_precios (
      id ${serial} PRIMARY KEY ${ai}, material_nombre TEXT NOT NULL,
      unidad TEXT, precio REAL NOT NULL, proveedor TEXT,
      fecha_compra TEXT NOT NULL, proyecto_id INTEGER,
      cantidad REAL DEFAULT 0, notas TEXT,
      created_at ${tsType} DEFAULT (${now}))`,

    `CREATE TABLE IF NOT EXISTS facturas (
      id ${serial} PRIMARY KEY ${ai}, proyecto_id INTEGER,
      fecha TEXT, proveedor TEXT,
      categoria TEXT DEFAULT 'Otros',
      monto REAL DEFAULT 0, descripcion TEXT,
      url_foto TEXT, notas TEXT,
      created_at ${tsType} DEFAULT (${now}),
      FOREIGN KEY(proyecto_id) REFERENCES proyectos(id))`,
  ];

  for (const sql of tables) {
    if (IS_PG) await pgPool.query(sql.replace(/AUTOINCREMENT/g,''));
    else        sqliteDb.run(sql);
  }

  // Migraciones seguras (columnas que pueden faltar en DBs antiguas)
  if (IS_PG) {
    await pgPool.query(`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS color_primario TEXT DEFAULT '#1a6b3c'`);
    await pgPool.query(`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS color_acento   TEXT DEFAULT '#f59e0b'`);
  } else {
    try { sqliteDb.run(`ALTER TABLE configuracion ADD COLUMN color_primario TEXT DEFAULT '#1a6b3c'`); } catch {}
    try { sqliteDb.run(`ALTER TABLE configuracion ADD COLUMN color_acento   TEXT DEFAULT '#f59e0b'`); } catch {}
  }
}

// ── Seed data ─────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

async function seedData() {
  await dbRun(`INSERT INTO clientes (nombre,empresa,email,telefono,direccion,nit) VALUES (?,?,?,?,?,?)`,
    ['Juan Carlos Pérez','Inversiones JCP SAS','jcperez@email.com','3001112233','Cra 10 #45-20','900.123.456-7']);
  await dbRun(`INSERT INTO clientes (nombre,empresa,email,telefono,direccion,nit) VALUES (?,?,?,?,?,?)`,
    ['María González','Constructora MG Ltda','mgonzalez@email.com','3109998877','Av. 68 #23-10','800.987.321-4']);

  await dbRun(`INSERT INTO proyectos (nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id) VALUES (?,?,?,?,?,?,?,?)`,
    ['Edificio Residencial Norte','Complejo de 12 apartamentos','Calle 45 #23-10','2026-01-15','2026-12-30',850000000,'activo',1]);
  await dbRun(`INSERT INTO proyectos (nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id) VALUES (?,?,?,?,?,?,?,?)`,
    ['Centro Comercial Sur','Local comercial 3 pisos','Av. Principal Km 2','2026-02-01','2026-10-15',1200000000,'activo',2]);
  await dbRun(`INSERT INTO proyectos (nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id) VALUES (?,?,?,?,?,?,?,?)`,
    ['Puente Vehicular','Puente sobre río principal','Vía rural sector 3','2025-08-01','2026-03-30',650000000,'finalizado',1]);

  const actSeed = [
    [1,'Excavación','m³',500,320,45000,'en_progreso'],
    [1,'Cimentación','m³',200,200,320000,'completado'],
    [1,'Estructura metálica','ton',80,45,2800000,'en_progreso'],
    [1,'Mampostería piso 1','m²',600,600,85000,'completado'],
    [1,'Mampostería piso 2','m²',600,200,85000,'en_progreso'],
    [2,'Demolición zona','m²',800,800,25000,'completado'],
    [2,'Pilotes','und',60,20,1500000,'en_progreso'],
    [2,'Losa piso 1','m²',1200,0,180000,'pendiente'],
  ];
  for (const a of actSeed)
    await dbRun(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (?,?,?,?,?,?,?)`, a);

  const persSeed = [
    ['Carlos Mendoza','Maestro de obra','3001234567',120000,1],
    ['Pedro Gómez','Oficial albañil','3009876543',90000,1],
    ['Luis Torres','Ayudante','3005551234',65000,1],
    ['Andrés Ruiz','Maestro de obra','3007778899',120000,2],
    ['Juan Herrera','Electricista','3112223344',95000,2],
  ];
  for (const p of persSeed)
    await dbRun(`INSERT INTO personal (nombre,cargo,telefono,salario_diario,proyecto_id) VALUES (?,?,?,?,?)`, p);

  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      const f = d.toISOString().split('T')[0];
      await dbRun(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (?,?,?,?,?)`, [1,1,f,'presente',8]);
      await dbRun(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (?,?,?,?,?)`, [2,1,f,'presente',8]);
      await dbRun(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (?,?,?,?,?)`, [3,1,f,i===2?'ausente':'presente',i===2?0:8]);
      await dbRun(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (?,?,?,?,?)`, [4,2,f,'presente',8]);
    }
  }

  const matSeed = [
    [1,'Cemento Portland','bulto',1000,800,650,28000,'Cementos del Valle','2026-01-20'],
    [1,'Acero 1/2"','barra',2000,2000,1500,18500,'Aceros SAS','2026-01-18'],
    [1,'Arena de río','m³',200,150,120,65000,'Agregados Norte','2026-02-01'],
    [2,'Concreto 3000 PSI','m³',500,100,80,420000,'Premezclados SA','2026-02-10'],
    [2,'Formaleta metálica','und',50,50,50,380000,'Alquiequipos','2026-02-05'],
  ];
  for (const m of matSeed)
    await dbRun(`INSERT INTO materiales (proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido) VALUES (?,?,?,?,?,?,?,?,?)`, m);

  const pagoSeed = [
    [1,'Nomina personal marzo',8500000,'2026-03-31','pagado','Personal obra', daysAgo(60)],
    [1,'Factura cemento - Cementos Valle',22400000,'2026-04-15','pagado','Cementos del Valle', daysAgo(45)],
    [1,'Nomina personal abril',8500000,'2026-04-30','vencido','Personal obra', daysAgo(30)],
    [1,'Acero estructural - Aceros SAS',37000000,'2026-05-10','vencido','Aceros SAS', daysAgo(20)],
    [1,'Nomina personal mayo',8500000,'2026-05-31','pendiente','Personal obra', daysAgo(10)],
    [2,'Factura pilotes - ContratistaSAS',30000000,'2026-05-20','pendiente','Contratista SAS', daysAgo(8)],
    [2,'Equipos excavación',15000000,'2026-06-01','pendiente','AlquiMaq Ltda', daysAgo(3)],
  ];
  for (const pg of pagoSeed)
    await dbRun(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,created_at) VALUES (?,?,?,?,?,?,?)`, pg);

  const subSeed = [
    [1,'Roberto Vargas','ElectraObra SAS','3154445566','Instalaciones eléctricas',45000000,60,27000000,'2026-03-01','2026-08-30','activo'],
    [1,'Diana Cruz','PlomAndes Ltda','3167776655','Plomería y redes hidrosanitarias',38000000,40,15200000,'2026-03-15','2026-09-15','activo'],
    [2,'Constructora Pilotes SA','Pilotes SA','3001002030','Hincado de pilotes',90000000,35,31500000,'2026-02-10','2026-05-30','activo'],
  ];
  for (const s of subSeed)
    await dbRun(`INSERT INTO subcontratistas (proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, s);

  const histSeed = [
    ['Cemento Portland','bulto',26000,'Cementos del Valle','2025-10-01',1,500,'Primer pedido'],
    ['Cemento Portland','bulto',27500,'Cementos del Valle','2025-12-15',1,300,'Segundo pedido'],
    ['Cemento Portland','bulto',28000,'Cementos del Valle','2026-01-20',1,1000,'Tercer pedido'],
    ['Acero 1/2"','barra',17000,'Aceros SAS','2025-11-01',1,1000,'Primer lote'],
    ['Acero 1/2"','barra',18500,'Aceros SAS','2026-01-18',1,2000,'Segundo lote'],
  ];
  for (const h of histSeed)
    await dbRun(`INSERT INTO historial_precios (material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas) VALUES (?,?,?,?,?,?,?,?)`, h);

  for (let i = 0; i < 5; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      const f = d.toISOString().split('T')[0];
      await dbRun(`INSERT INTO bitacora (proyecto_id,fecha,actividades_dia,incidentes,observaciones,clima,personal_presente) VALUES (?,?,?,?,?,?,?)`,
        [1,f,'Avance en mampostería piso 2 y estructura metálica','Sin incidentes relevantes','Se requiere mayor personal para próxima semana','Soleado parcialmente nublado',4]);
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function initDB() {
  if (IS_PG) {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  } else {
    const initSqlJs = require('sql.js');
    const DB_PATH   = path.join(__dirname, 'construccion.db');
    const SQL       = await initSqlJs();
    sqliteDb = fs.existsSync(DB_PATH)
      ? new SQL.Database(fs.readFileSync(DB_PATH))
      : new SQL.Database();
  }

  await createTables();

  // Configuración inicial
  const cfg = await dbQuery('SELECT id FROM configuracion WHERE id=1');
  if (!cfg.length)
    await dbRun(`INSERT INTO configuracion (id,moneda,tasa_usd,tasa_aed,nombre_empresa) VALUES (?,?,?,?,?)`,
      [1,'COP',4200,1143,'GestObra']);

  // Seed solo si no hay proyectos
  const existing = await dbQuery('SELECT COUNT(*) as c FROM proyectos');
  if (parseInt(existing[0].c) === 0) await seedData();

  if (!IS_PG) _sqliteSave();
  console.log(`✅ Base de datos iniciada (${IS_PG ? 'PostgreSQL 🐘' : 'SQLite 📁'}).`);
}

// ── API: CONFIGURACIÓN ────────────────────────────────────────────────────────
app.get('/api/configuracion', async (req, res) => {
  const r = await dbQuery('SELECT * FROM configuracion WHERE id=1');
  res.json(r[0] || { id:1, moneda:'COP', tasa_usd:4200, tasa_aed:1143, nombre_empresa:'GestObra' });
});
app.put('/api/configuracion', async (req, res) => {
  const { moneda,tasa_usd,tasa_aed,nombre_empresa,color_primario,color_acento } = req.body;
  await dbRun(`UPDATE configuracion SET moneda=?,tasa_usd=?,tasa_aed=?,nombre_empresa=?,color_primario=?,color_acento=? WHERE id=1`,
    [moneda,tasa_usd,tasa_aed,nombre_empresa,color_primario||'#1a6b3c',color_acento||'#f59e0b']);
  res.json({ ok:true });
});

// ── API: DASHBOARD ────────────────────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  const [proyectos, actividades, pagos] = await Promise.all([
    dbQuery('SELECT * FROM proyectos'),
    dbQuery('SELECT * FROM actividades'),
    dbQuery('SELECT * FROM pagos'),
  ]);
  const hoy = new Date().toISOString().split('T')[0];
  const asistenciaHoy = await dbQuery(`SELECT COUNT(*) as c FROM asistencia WHERE fecha=? AND estado='presente'`, [hoy]);

  const alertQuery = IS_PG
    ? `SELECT pg.*, p.nombre as proyecto_nombre FROM pagos pg JOIN proyectos p ON pg.proyecto_id=p.id
       WHERE pg.estado IN ('pendiente','vencido') AND pg.created_at <= NOW() - INTERVAL '7 days'
       ORDER BY pg.created_at ASC`
    : `SELECT pg.*, p.nombre as proyecto_nombre FROM pagos pg JOIN proyectos p ON pg.proyecto_id=p.id
       WHERE pg.estado IN ('pendiente','vencido') AND DATE(pg.created_at) <= DATE('now','-7 days')
       ORDER BY pg.created_at ASC`;
  const alertas = await dbQuery(alertQuery);

  const avancePorProyecto = proyectos.map(p => {
    const acts = actividades.filter(a => a.proyecto_id == p.id);
    const avance = acts.length
      ? Math.round(acts.reduce((s,a) => s + (a.cantidad_planificada > 0 ? a.cantidad_ejecutada/a.cantidad_planificada : 0), 0) / acts.length * 100)
      : 0;
    const costoEjec = acts.reduce((s,a) => s + a.cantidad_ejecutada * a.costo_unitario, 0);
    const costoPlan = acts.reduce((s,a) => s + a.cantidad_planificada * a.costo_unitario, 0);
    return { id:p.id, nombre:p.nombre, avance, estado:p.estado, presupuesto:p.presupuesto, costoEjec, costoPlan };
  });

  res.json({
    totalProyectos: proyectos.length,
    activos: proyectos.filter(p => p.estado==='activo').length,
    avanceTotal: avancePorProyecto.length
      ? Math.round(avancePorProyecto.reduce((s,p)=>s+p.avance,0) / avancePorProyecto.length) : 0,
    pagosPendientes: pagos.filter(p=>p.estado==='pendiente').reduce((s,p)=>s+parseFloat(p.monto),0),
    pagosVencidos:   pagos.filter(p=>p.estado==='vencido').reduce((s,p)=>s+parseFloat(p.monto),0),
    personalHoy: parseInt(asistenciaHoy[0].c),
    actividadesPorEstado: {
      pendiente:   actividades.filter(a=>a.estado==='pendiente').length,
      en_progreso: actividades.filter(a=>a.estado==='en_progreso').length,
      completado:  actividades.filter(a=>a.estado==='completado').length,
    },
    avancePorProyecto,
    alertas
  });
});

// ── API: PRESUPUESTO ──────────────────────────────────────────────────────────
app.get('/api/presupuesto/:id', async (req, res) => {
  const pid = req.params.id;
  const proyecto = (await dbQuery('SELECT * FROM proyectos WHERE id=?', [pid]))[0];
  if (!proyecto) return res.status(404).json({ error:'No encontrado' });
  const [acts, mats, pags, subs] = await Promise.all([
    dbQuery('SELECT * FROM actividades WHERE proyecto_id=?', [pid]),
    dbQuery('SELECT * FROM materiales WHERE proyecto_id=?', [pid]),
    dbQuery('SELECT * FROM pagos WHERE proyecto_id=?', [pid]),
    dbQuery('SELECT * FROM subcontratistas WHERE proyecto_id=?', [pid]),
  ]);
  const costoPlanActs = acts.reduce((s,a)=>s+a.cantidad_planificada*a.costo_unitario,0);
  const costoEjecActs = acts.reduce((s,a)=>s+a.cantidad_ejecutada*a.costo_unitario,0);
  const costoMateriales = mats.reduce((s,m)=>s+m.cantidad_usada*m.costo_unitario,0);
  const pagado      = pags.filter(p=>p.estado==='pagado').reduce((s,p)=>s+parseFloat(p.monto),0);
  const comprometido = pags.reduce((s,p)=>s+parseFloat(p.monto),0);
  const subcontratos = subs.reduce((s,sc)=>s+parseFloat(sc.monto_contrato),0);
  const gastoTotal  = costoEjecActs + costoMateriales;
  res.json({
    presupuesto: parseFloat(proyecto.presupuesto),
    costoPlanActs, costoEjecActs, costoMateriales,
    gastoTotal, pagado, comprometido, subcontratos,
    diferencia: parseFloat(proyecto.presupuesto) - gastoTotal,
    sobrecosto: gastoTotal > parseFloat(proyecto.presupuesto),
    porcentajeUtilizado: proyecto.presupuesto > 0 ? Math.round(gastoTotal/proyecto.presupuesto*100) : 0
  });
});

// ── API: PROYECTOS ────────────────────────────────────────────────────────────
app.get('/api/proyectos', async (req, res) => res.json(
  await dbQuery('SELECT p.*, c.nombre as cliente_nombre FROM proyectos p LEFT JOIN clientes c ON p.cliente_id=c.id ORDER BY p.created_at DESC')));

app.post('/api/proyectos', async (req, res) => {
  const { nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id } = req.body;
  await dbRun(`INSERT INTO proyectos (nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id) VALUES (?,?,?,?,?,?,?,?)`,
    [nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto||0,estado||'activo',cliente_id||null]);
  res.json({ ok:true });
});
app.put('/api/proyectos/:id', async (req, res) => {
  const { nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id } = req.body;
  await dbRun(`UPDATE proyectos SET nombre=?,descripcion=?,ubicacion=?,fecha_inicio=?,fecha_fin=?,presupuesto=?,estado=?,cliente_id=? WHERE id=?`,
    [nombre,descripcion,ubicacion,fecha_inicio,fecha_fin,presupuesto,estado,cliente_id||null,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/proyectos/:id', async (req, res) => {
  await dbRun('DELETE FROM proyectos WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── API: ACTIVIDADES ──────────────────────────────────────────────────────────
app.get('/api/actividades', async (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT a.*,p.nombre as proyecto_nombre FROM actividades a JOIN proyectos p ON a.proyecto_id=p.id`;
  const params = [];
  if (proyecto_id) { sql += ' WHERE a.proyecto_id=?'; params.push(proyecto_id); }
  res.json(await dbQuery(sql + ' ORDER BY a.created_at DESC', params));
});
app.post('/api/actividades', async (req, res) => {
  const { proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado } = req.body;
  const r = await dbRun(`INSERT INTO actividades (proyecto_id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado) VALUES (?,?,?,?,?,?,?)`,
    [proyecto_id,nombre,unidad||'und',cantidad_planificada||0,cantidad_ejecutada||0,costo_unitario||0,estado||'pendiente']);
  res.json({ ok:true, id:r.id });
});
app.put('/api/actividades/:id', async (req, res) => {
  const { nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado } = req.body;
  await dbRun(`UPDATE actividades SET nombre=?,unidad=?,cantidad_planificada=?,cantidad_ejecutada=?,costo_unitario=?,estado=? WHERE id=?`,
    [nombre,unidad,cantidad_planificada,cantidad_ejecutada,costo_unitario,estado,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/actividades/:id', async (req, res) => {
  await dbRun('DELETE FROM actividades WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── API: FOTOS ────────────────────────────────────────────────────────────────
app.get('/api/fotos', async (req, res) => {
  const { actividad_id, proyecto_id } = req.query;
  let sql = `SELECT f.*,a.nombre as actividad_nombre,p.nombre as proyecto_nombre
    FROM fotos_actividad f LEFT JOIN actividades a ON f.actividad_id=a.id
    JOIN proyectos p ON f.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (actividad_id) { sql += ' AND f.actividad_id=?'; params.push(actividad_id); }
  if (proyecto_id)  { sql += ' AND f.proyecto_id=?';  params.push(proyecto_id); }
  res.json(await dbQuery(sql + ' ORDER BY f.fecha DESC, f.created_at DESC', params));
});
app.post('/api/fotos', upload.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error:'No se recibió imagen' });
  const { actividad_id, proyecto_id, fecha, comentario } = req.body;

  // Comprimir y redimensionar con sharp (máx 1200px, calidad 75%)
  const filePath = req.file.path;
  const ext      = path.extname(req.file.filename).toLowerCase();
  const outName  = req.file.filename.replace(ext, '.jpg');
  const outPath  = path.join(UPLOADS_DIR, outName);
  try {
    await sharp(filePath)
      .rotate()                          // respeta orientación EXIF
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toFile(outPath);
    if (outPath !== filePath) fs.unlinkSync(filePath); // elimina el original si cambió extensión
  } catch {
    // Si sharp falla (formato raro), usa el archivo original tal cual
  }

  const url = '/uploads/' + outName;
  await dbRun(`INSERT INTO fotos_actividad (actividad_id,proyecto_id,url,fecha,comentario) VALUES (?,?,?,?,?)`,
    [actividad_id||null, proyecto_id, url, fecha||new Date().toISOString().split('T')[0], comentario||'']);
  res.json({ ok:true, url });
});
app.delete('/api/fotos/:id', async (req, res) => {
  const foto = (await dbQuery('SELECT * FROM fotos_actividad WHERE id=?', [req.params.id]))[0];
  if (foto) {
    const filePath = path.join(__dirname, 'public', foto.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await dbRun('DELETE FROM fotos_actividad WHERE id=?', [req.params.id]);
  }
  res.json({ ok:true });
});

// ── API: PERSONAL ─────────────────────────────────────────────────────────────
app.get('/api/personal', async (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT p.*,pr.nombre as proyecto_nombre FROM personal p LEFT JOIN proyectos pr ON p.proyecto_id=pr.id WHERE p.activo=1`;
  const params = [];
  if (proyecto_id) { sql += ' AND p.proyecto_id=?'; params.push(proyecto_id); }
  res.json(await dbQuery(sql, params));
});
app.post('/api/personal', async (req, res) => {
  const { nombre,cargo,telefono,salario_diario,proyecto_id } = req.body;
  await dbRun(`INSERT INTO personal (nombre,cargo,telefono,salario_diario,proyecto_id) VALUES (?,?,?,?,?)`,
    [nombre,cargo,telefono,salario_diario||0,proyecto_id||null]);
  res.json({ ok:true });
});
app.put('/api/personal/:id', async (req, res) => {
  const { nombre,cargo,telefono,salario_diario,proyecto_id,activo } = req.body;
  await dbRun(`UPDATE personal SET nombre=?,cargo=?,telefono=?,salario_diario=?,proyecto_id=?,activo=? WHERE id=?`,
    [nombre,cargo,telefono,salario_diario,proyecto_id||null,activo!==undefined?activo:1,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/personal/:id', async (req, res) => {
  await dbRun('UPDATE personal SET activo=0 WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── API: ASISTENCIA ───────────────────────────────────────────────────────────
app.get('/api/asistencia', async (req, res) => {
  const { fecha, proyecto_id } = req.query;
  let sql = `SELECT a.*,p.nombre as personal_nombre,p.cargo,pr.nombre as proyecto_nombre
    FROM asistencia a JOIN personal p ON a.personal_id=p.id JOIN proyectos pr ON a.proyecto_id=pr.id WHERE 1=1`;
  const params = [];
  if (fecha)       { sql += ' AND a.fecha=?';       params.push(fecha); }
  if (proyecto_id) { sql += ' AND a.proyecto_id=?'; params.push(proyecto_id); }
  res.json(await dbQuery(sql + ' ORDER BY a.fecha DESC,p.nombre', params));
});
app.post('/api/asistencia', async (req, res) => {
  const { personal_id, proyecto_id, fecha, estado, horas } = req.body;
  const exists = await dbQuery('SELECT id FROM asistencia WHERE personal_id=? AND fecha=?', [personal_id, fecha]);
  if (exists.length) {
    await dbRun('UPDATE asistencia SET estado=?,horas=? WHERE personal_id=? AND fecha=?',
      [estado, horas||8, personal_id, fecha]);
  } else {
    await dbRun(`INSERT INTO asistencia (personal_id,proyecto_id,fecha,estado,horas) VALUES (?,?,?,?,?)`,
      [personal_id, proyecto_id, fecha, estado||'presente', horas||8]);
  }
  res.json({ ok:true });
});

// ── API: MATERIALES ───────────────────────────────────────────────────────────
app.get('/api/materiales', async (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT m.*,p.nombre as proyecto_nombre FROM materiales m JOIN proyectos p ON m.proyecto_id=p.id`;
  const params = [];
  if (proyecto_id) { sql += ' WHERE m.proyecto_id=?'; params.push(proyecto_id); }
  res.json(await dbQuery(sql + ' ORDER BY m.created_at DESC', params));
});
app.post('/api/materiales', async (req, res) => {
  const { proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido } = req.body;
  await dbRun(`INSERT INTO materiales (proyecto_id,nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido) VALUES (?,?,?,?,?,?,?,?,?)`,
    [proyecto_id,nombre,unidad||'und',cantidad_pedida||0,cantidad_recibida||0,cantidad_usada||0,costo_unitario||0,proveedor,fecha_pedido]);
  res.json({ ok:true });
});
app.put('/api/materiales/:id', async (req, res) => {
  const { nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido } = req.body;
  await dbRun(`UPDATE materiales SET nombre=?,unidad=?,cantidad_pedida=?,cantidad_recibida=?,cantidad_usada=?,costo_unitario=?,proveedor=?,fecha_pedido=? WHERE id=?`,
    [nombre,unidad,cantidad_pedida,cantidad_recibida,cantidad_usada,costo_unitario,proveedor,fecha_pedido,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/materiales/:id', async (req, res) => {
  await dbRun('DELETE FROM materiales WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── API: PAGOS ────────────────────────────────────────────────────────────────
app.get('/api/pagos', async (req, res) => {
  const { proyecto_id, estado } = req.query;
  let sql = `SELECT pg.*,p.nombre as proyecto_nombre FROM pagos pg JOIN proyectos p ON pg.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (proyecto_id) { sql += ' AND pg.proyecto_id=?'; params.push(proyecto_id); }
  if (estado)      { sql += ' AND pg.estado=?';       params.push(estado); }
  res.json(await dbQuery(sql + ' ORDER BY pg.fecha_vencimiento ASC', params));
});
app.post('/api/pagos', async (req, res) => {
  const { proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,notas } = req.body;
  await dbRun(`INSERT INTO pagos (proyecto_id,concepto,monto,fecha_vencimiento,estado,beneficiario,notas) VALUES (?,?,?,?,?,?,?)`,
    [proyecto_id,concepto,monto||0,fecha_vencimiento,estado||'pendiente',beneficiario,notas]);
  res.json({ ok:true });
});
app.put('/api/pagos/:id', async (req, res) => {
  const { concepto,monto,fecha_vencimiento,fecha_pago,estado,beneficiario,notas } = req.body;
  await dbRun(`UPDATE pagos SET concepto=?,monto=?,fecha_vencimiento=?,fecha_pago=?,estado=?,beneficiario=?,notas=? WHERE id=?`,
    [concepto,monto,fecha_vencimiento,fecha_pago,estado,beneficiario,notas,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/pagos/:id', async (req, res) => {
  await dbRun('DELETE FROM pagos WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── API: CLIENTES ─────────────────────────────────────────────────────────────
app.get('/api/clientes', async (req, res) => res.json(await dbQuery('SELECT * FROM clientes ORDER BY nombre')));
app.post('/api/clientes', async (req, res) => {
  const { nombre,empresa,email,telefono,direccion,nit,notas } = req.body;
  await dbRun(`INSERT INTO clientes (nombre,empresa,email,telefono,direccion,nit,notas) VALUES (?,?,?,?,?,?,?)`,
    [nombre,empresa,email,telefono,direccion,nit,notas]);
  res.json({ ok:true });
});
app.put('/api/clientes/:id', async (req, res) => {
  const { nombre,empresa,email,telefono,direccion,nit,notas } = req.body;
  await dbRun(`UPDATE clientes SET nombre=?,empresa=?,email=?,telefono=?,direccion=?,nit=?,notas=? WHERE id=?`,
    [nombre,empresa,email,telefono,direccion,nit,notas,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/clientes/:id', async (req, res) => {
  await dbRun('DELETE FROM clientes WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── API: BITÁCORA ─────────────────────────────────────────────────────────────
app.get('/api/bitacora', async (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT b.*,p.nombre as proyecto_nombre FROM bitacora b JOIN proyectos p ON b.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (proyecto_id) { sql += ' AND b.proyecto_id=?'; params.push(proyecto_id); }
  res.json(await dbQuery(sql + ' ORDER BY b.fecha DESC', params));
});
app.post('/api/bitacora', async (req, res) => {
  const { proyecto_id,fecha,actividades_dia,incidentes,observaciones,clima,personal_presente } = req.body;
  const r = await dbRun(`INSERT INTO bitacora (proyecto_id,fecha,actividades_dia,incidentes,observaciones,clima,personal_presente) VALUES (?,?,?,?,?,?,?)`,
    [proyecto_id,fecha,actividades_dia,incidentes,observaciones,clima,personal_presente||0]);
  res.json({ ok:true, id:r.id });
});
app.put('/api/bitacora/:id', async (req, res) => {
  const { actividades_dia,incidentes,observaciones,clima,personal_presente } = req.body;
  await dbRun(`UPDATE bitacora SET actividades_dia=?,incidentes=?,observaciones=?,clima=?,personal_presente=? WHERE id=?`,
    [actividades_dia,incidentes,observaciones,clima,personal_presente||0,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/bitacora/:id', async (req, res) => {
  await dbRun('DELETE FROM bitacora WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── API: SUBCONTRATISTAS ──────────────────────────────────────────────────────
app.get('/api/subcontratistas', async (req, res) => {
  const { proyecto_id } = req.query;
  let sql = `SELECT s.*,p.nombre as proyecto_nombre FROM subcontratistas s JOIN proyectos p ON s.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (proyecto_id) { sql += ' AND s.proyecto_id=?'; params.push(proyecto_id); }
  res.json(await dbQuery(sql + ' ORDER BY s.created_at DESC', params));
});
app.post('/api/subcontratistas', async (req, res) => {
  const { proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado,notas } = req.body;
  await dbRun(`INSERT INTO subcontratistas (proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado,notas) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [proyecto_id,nombre,empresa,telefono,especialidad,monto_contrato||0,avance_certificado||0,pagado||0,fecha_inicio,fecha_fin,estado||'activo',notas]);
  res.json({ ok:true });
});
app.put('/api/subcontratistas/:id', async (req, res) => {
  const { nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado,notas } = req.body;
  await dbRun(`UPDATE subcontratistas SET nombre=?,empresa=?,telefono=?,especialidad=?,monto_contrato=?,avance_certificado=?,pagado=?,fecha_inicio=?,fecha_fin=?,estado=?,notas=? WHERE id=?`,
    [nombre,empresa,telefono,especialidad,monto_contrato,avance_certificado,pagado,fecha_inicio,fecha_fin,estado,notas,req.params.id]);
  res.json({ ok:true });
});
app.delete('/api/subcontratistas/:id', async (req, res) => {
  await dbRun('DELETE FROM subcontratistas WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── API: HISTORIAL PRECIOS ────────────────────────────────────────────────────
app.get('/api/historial-precios', async (req, res) => {
  const { material } = req.query;
  let sql = `SELECT h.*,p.nombre as proyecto_nombre FROM historial_precios h LEFT JOIN proyectos p ON h.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (material) { sql += ' AND h.material_nombre LIKE ?'; params.push(`%${material}%`); }
  res.json(await dbQuery(sql + ' ORDER BY h.fecha_compra DESC', params));
});
app.get('/api/historial-precios/materiales', async (req, res) =>
  res.json(await dbQuery('SELECT DISTINCT material_nombre FROM historial_precios ORDER BY material_nombre')));
app.post('/api/historial-precios', async (req, res) => {
  const { material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas } = req.body;
  await dbRun(`INSERT INTO historial_precios (material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id,cantidad,notas) VALUES (?,?,?,?,?,?,?,?)`,
    [material_nombre,unidad,precio,proveedor,fecha_compra,proyecto_id||null,cantidad||0,notas]);
  res.json({ ok:true });
});
app.delete('/api/historial-precios/:id', async (req, res) => {
  await dbRun('DELETE FROM historial_precios WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── API: REPORTE CLIENTE ──────────────────────────────────────────────────────
app.get('/api/reporte-cliente/:id', async (req, res) => {
  const pid = req.params.id;
  const proyecto = (await dbQuery(
    'SELECT p.*,c.nombre as cliente_nombre,c.empresa as cliente_empresa FROM proyectos p LEFT JOIN clientes c ON p.cliente_id=c.id WHERE p.id=?', [pid]))[0];
  if (!proyecto) return res.status(404).json({ error:'No encontrado' });
  const [acts, fotos, bitacora] = await Promise.all([
    dbQuery('SELECT id,nombre,unidad,cantidad_planificada,cantidad_ejecutada,estado FROM actividades WHERE proyecto_id=?', [pid]),
    dbQuery('SELECT f.*,a.nombre as actividad_nombre FROM fotos_actividad f LEFT JOIN actividades a ON f.actividad_id=a.id WHERE f.proyecto_id=? ORDER BY f.fecha DESC', [pid]),
    dbQuery('SELECT fecha,actividades_dia,observaciones,clima,personal_presente FROM bitacora WHERE proyecto_id=? ORDER BY fecha DESC LIMIT 10', [pid]),
  ]);
  const avance = acts.length
    ? Math.round(acts.reduce((s,a)=>s+(a.cantidad_planificada>0?a.cantidad_ejecutada/a.cantidad_planificada:0),0)/acts.length*100) : 0;
  res.json({ proyecto, actividades:acts, fotos, bitacora, avance });
});

// ── API: FACTURAS ─────────────────────────────────────────────────────────────
const CATEGORIAS_FACTURA = [
  'Materiales de construcción','Mano de obra','Equipos y maquinaria',
  'Subcontratos','Servicios públicos','Transporte y logística',
  'Herramientas','Honorarios profesionales','Otros'
];

// Procesar imagen con Claude para extraer datos de la factura
app.post('/api/facturas/procesar', upload.single('factura'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

  const filePath = req.file.path;
  const ext      = path.extname(req.file.filename).toLowerCase();
  const outName  = req.file.filename.replace(ext, '.jpg');
  const outPath  = path.join(UPLOADS_DIR, outName);

  // Comprimir para almacenamiento (mayor calidad para legibilidad de texto)
  try {
    await sharp(filePath)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(outPath);
    if (outPath !== filePath) fs.unlinkSync(filePath);
  } catch { /* conservar original si falla */ }

  const url = '/uploads/' + outName;
  let extracted = { fecha: null, proveedor: null, monto: null, descripcion: null, categoria: 'Otros' };

  // OCR con Claude si hay API key
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const imageBase64 = fs.readFileSync(outPath).toString('base64');
      const msg = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: `Eres un asistente de contabilidad para obras de construcción.
Extrae los datos de esta factura/recibo y responde ÚNICAMENTE con un JSON válido, sin texto adicional:
{
  "fecha": "YYYY-MM-DD o null",
  "proveedor": "nombre del proveedor o null",
  "monto": número sin símbolos ni puntos de miles (solo el TOTAL a pagar) o null,
  "descripcion": "descripción breve en máx 80 caracteres o null",
  "categoria": una de estas exactamente: ${JSON.stringify(CATEGORIAS_FACTURA)}
}` }
          ]
        }]
      });
      const raw = msg.content[0].text.trim().replace(/^```json|```$/g, '').trim();
      extracted = { ...extracted, ...JSON.parse(raw) };
    } catch (e) {
      console.error('Claude OCR error:', e.message);
    }
  }

  res.json({ ok: true, url, extracted });
});

// Stats para gráficas
app.get('/api/facturas/stats', async (req, res) => {
  const { proyecto_id } = req.query;
  const filtro  = proyecto_id ? ' AND f.proyecto_id=?' : '';
  const params  = proyecto_id ? [proyecto_id] : [];

  const porCategoria = await dbQuery(
    `SELECT categoria, SUM(monto) as total, COUNT(*) as cantidad
     FROM facturas f WHERE 1=1${filtro} GROUP BY categoria ORDER BY total DESC`, params);

  const porProyecto = await dbQuery(
    `SELECT p.nombre as proyecto, SUM(f.monto) as total, COUNT(*) as cantidad
     FROM facturas f JOIN proyectos p ON f.proyecto_id=p.id
     WHERE 1=1${filtro} GROUP BY p.nombre ORDER BY total DESC`, params);

  const porMes = IS_PG
    ? await dbQuery(
        `SELECT TO_CHAR(fecha::date,'YYYY-MM') as mes, SUM(monto) as total
         FROM facturas f WHERE fecha IS NOT NULL${filtro}
         GROUP BY mes ORDER BY mes`, params)
    : await dbQuery(
        `SELECT strftime('%Y-%m', fecha) as mes, SUM(monto) as total
         FROM facturas f WHERE fecha IS NOT NULL${filtro}
         GROUP BY mes ORDER BY mes`, params);

  const totales = await dbQuery(
    `SELECT COUNT(*) as cantidad, COALESCE(SUM(monto),0) as total
     FROM facturas f WHERE 1=1${filtro}`, params);

  res.json({ porCategoria, porProyecto, porMes, totales: totales[0] });
});

// CRUD
app.get('/api/facturas', async (req, res) => {
  const { proyecto_id, categoria, desde, hasta } = req.query;
  let sql = `SELECT f.*, p.nombre as proyecto_nombre
    FROM facturas f LEFT JOIN proyectos p ON f.proyecto_id=p.id WHERE 1=1`;
  const params = [];
  if (proyecto_id) { sql += ' AND f.proyecto_id=?'; params.push(proyecto_id); }
  if (categoria)   { sql += ' AND f.categoria=?';   params.push(categoria); }
  if (desde)       { sql += ' AND f.fecha>=?';       params.push(desde); }
  if (hasta)       { sql += ' AND f.fecha<=?';       params.push(hasta); }
  res.json(await dbQuery(sql + ' ORDER BY f.fecha DESC, f.created_at DESC', params));
});

app.post('/api/facturas', async (req, res) => {
  const { proyecto_id,fecha,proveedor,categoria,monto,descripcion,url_foto,notas } = req.body;
  const r = await dbRun(
    `INSERT INTO facturas (proyecto_id,fecha,proveedor,categoria,monto,descripcion,url_foto,notas)
     VALUES (?,?,?,?,?,?,?,?)`,
    [proyecto_id||null, fecha, proveedor, categoria||'Otros', monto||0, descripcion, url_foto, notas]);
  res.json({ ok:true, id:r.id });
});

app.put('/api/facturas/:id', async (req, res) => {
  const { proyecto_id,fecha,proveedor,categoria,monto,descripcion,notas } = req.body;
  await dbRun(
    `UPDATE facturas SET proyecto_id=?,fecha=?,proveedor=?,categoria=?,monto=?,descripcion=?,notas=? WHERE id=?`,
    [proyecto_id||null, fecha, proveedor, categoria, monto||0, descripcion, notas, req.params.id]);
  res.json({ ok:true });
});

app.delete('/api/facturas/:id', async (req, res) => {
  const f = (await dbQuery('SELECT url_foto FROM facturas WHERE id=?', [req.params.id]))[0];
  if (f?.url_foto) {
    const fp = path.join(__dirname, 'public', f.url_foto);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  await dbRun('DELETE FROM facturas WHERE id=?', [req.params.id]);
  res.json({ ok:true });
});

// ── SPA Fallback ──────────────────────────────────────────────────────────────
app.get('/reporte-cliente', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reporte-cliente.html')));
app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Arranque ──────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`\n✅ Servidor en http://localhost:${PORT}\n`));
}).catch(err => { console.error('Error iniciando DB:', err); process.exit(1); });
