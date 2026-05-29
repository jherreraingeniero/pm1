# GestObra — Sistema de Gestión de Proyectos de Construcción

Aplicación web completa para gestión de proyectos de construcción. Desarrollada con Node.js, Express y SQLite.

## Características

- **Dashboard** con métricas generales, gráficas de avance y alertas de pagos
- **Proyectos** — creación y seguimiento con presupuesto, fechas y estado
- **Actividades** — cantidades planificadas vs ejecutadas con barra de progreso
- **Personal** — registro de trabajadores y control de asistencia diaria
- **Materiales** — control de inventario (pedido / recibido / usado)
- **Pagos** — seguimiento de pagos con alertas automáticas de vencimiento
- **Clientes** — directorio de clientes vinculados a proyectos
- **Bitácora diaria** — registro de actividades, clima e incidentes por día
- **Subcontratistas** — control de contratos, avance certificado y saldo
- **Historial de precios** — seguimiento histórico del costo de materiales
- **Presupuesto vs Real** — comparativa de costos con alerta de sobrecosto
- **Fotos de avance** — galería de fotografías por actividad
- **Informes PDF** — generación de reportes completos descargables
- **Reporte para cliente** — vista pública sin costos internos, compartible por URL
- **Configuración** — tema de color, nombre de empresa y divisa (COP / USD / AED)

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd gestobra

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor
npm start
```

Abre tu navegador en **http://localhost:3000**

## Requisitos

- Node.js v18 o superior
- npm

No requiere instalación de base de datos — usa SQLite embebido (sql.js).

## Estructura del proyecto

```
├── server.js              # Servidor Express + API REST + base de datos
├── package.json
├── public/
│   ├── index.html         # SPA principal
│   ├── reporte-cliente.html  # Vista pública para clientes
│   ├── styles.css
│   ├── uploads/           # Fotos subidas (excluidas de git)
│   └── modules/           # Módulos JavaScript del frontend
│       ├── core.js        # Utilidades, API fetch, tema, config
│       ├── dashboard.js
│       ├── proyectos.js
│       ├── actividades.js
│       ├── personal.js
│       ├── asistencia.js
│       ├── materiales.js
│       ├── pagos.js
│       ├── clientes.js
│       ├── bitacora.js
│       ├── subcontratistas.js
│       ├── historial.js
│       ├── presupuesto.js
│       ├── fotos.js
│       ├── informes.js
│       ├── reporte.js
│       ├── configuracion.js
│       └── init.js        # Router de secciones
```

## Notas

- La base de datos (`construccion.db`) se genera automáticamente al primer inicio con datos de ejemplo.
- Las fotos se almacenan en `public/uploads/` (no se suben a Git).
- Todos los montos se guardan internamente en COP; la conversión a USD/AED es solo visual.
