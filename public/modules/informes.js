async function renderInformes() {
  const c = document.getElementById('content');
  const proyectos = await api('GET', '/api/proyectos');
  const pOpts = proyectos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');

  c.innerHTML = `
    <div class="section-header"><h2>Informes PDF</h2></div>
    <p class="text-muted" style="margin-bottom:20px;font-size:.88rem">
      Genera reportes completos de cada proyecto en formato PDF para imprimir o compartir.
    </p>
    <div class="config-section">
      <h3>Generar Informe de Proyecto</h3>
      <div class="form-grid" style="max-width:500px">
        <div class="form-group full"><label>Proyecto</label>
          <select id="inf-py">${pOpts}</select></div>
        <div class="form-group full"><label>Secciones a incluir</label>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:normal">
              <input type="checkbox" id="inf-acts" checked> Actividades y avance
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:normal">
              <input type="checkbox" id="inf-pers" checked> Personal
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:normal">
              <input type="checkbox" id="inf-mats" checked> Materiales
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:normal">
              <input type="checkbox" id="inf-pags" checked> Pagos
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:normal">
              <input type="checkbox" id="inf-subs" checked> Subcontratistas
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:normal">
              <input type="checkbox" id="inf-bit"> Bitácora (últimas 10 entradas)
            </label>
          </div>
        </div>
      </div>
      <div style="margin-top:16px">
        <button class="btn btn-primary" onclick="_generarPDF()">📄 Generar PDF</button>
      </div>
    </div>`;

  window._generarPDF = async () => {
    const pid = document.getElementById('inf-py').value;
    if (!pid) return toast('Selecciona un proyecto','error');
    toast('Generando PDF...');

    const incActs = document.getElementById('inf-acts').checked;
    const incPers = document.getElementById('inf-pers').checked;
    const incMats = document.getElementById('inf-mats').checked;
    const incPags = document.getElementById('inf-pags').checked;
    const incSubs = document.getElementById('inf-subs').checked;
    const incBit  = document.getElementById('inf-bit').checked;

    const [proyectos, acts, pers, mats, pagos, subs, bit] = await Promise.all([
      api('GET', '/api/proyectos'),
      incActs ? api('GET', `/api/actividades?proyecto_id=${pid}`) : Promise.resolve([]),
      incPers ? api('GET', `/api/personal?proyecto_id=${pid}`) : Promise.resolve([]),
      incMats ? api('GET', `/api/materiales?proyecto_id=${pid}`) : Promise.resolve([]),
      incPags ? api('GET', `/api/pagos?proyecto_id=${pid}`) : Promise.resolve([]),
      incSubs ? api('GET', `/api/subcontratistas?proyecto_id=${pid}`) : Promise.resolve([]),
      incBit  ? api('GET', `/api/bitacora?proyecto_id=${pid}`) : Promise.resolve([]),
    ]);

    const p = proyectos.find(x=>String(x.id)===String(pid));
    const empresa = window.CONFIG.nombre_empresa || 'GestObra';
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const W = doc.internal.pageSize.getWidth();
    let y = 0;

    function checkPage(needed=20) {
      if (y + needed > 270) { doc.addPage(); y = 20; }
    }

    // Encabezado
    doc.setFillColor(15, 69, 37);
    doc.rect(0, 0, W, 38, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text(empresa, 14, 16);
    doc.setFontSize(11); doc.setFont('helvetica','normal');
    doc.text('Informe de Proyecto', 14, 24);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})}`, 14, 31);
    doc.text(`Divisa: ${window.CONFIG.moneda}`, W-40, 31);

    doc.setTextColor(30,41,59);
    y = 50;

    // Datos del proyecto
    doc.setFontSize(15); doc.setFont('helvetica','bold');
    doc.text(p.nombre, 14, y); y+=8;
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    if(p.ubicacion) { doc.text(`📍 ${p.ubicacion}`, 14, y); y+=5; }
    if(p.fecha_inicio) { doc.text(`📅 ${fmtFecha(p.fecha_inicio)} → ${fmtFecha(p.fecha_fin)}`, 14, y); y+=5; }
    doc.text(`💰 Presupuesto: ${fmt(p.presupuesto)}   Estado: ${p.estado}`, 14, y); y+=5;
    if(p.cliente_nombre) { doc.text(`👤 Cliente: ${p.cliente_nombre}`, 14, y); y+=5; }

    doc.setTextColor(30,41,59);
    y += 5;

    // Avance global
    const avance = acts.length
      ? Math.round(acts.reduce((s,a)=>s+(a.cantidad_planificada>0?a.cantidad_ejecutada/a.cantidad_planificada:0),0)/acts.length*100)
      : 0;
    doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(`Avance global de actividades: ${avance}%`, 14, y); y+=6;
    doc.setFillColor(226,232,240); doc.rect(14, y, W-28, 5, 'F');
    doc.setFillColor(22,163,74);   doc.rect(14, y, (W-28)*avance/100, 5, 'F');
    y += 12;

    function sectionTitle(title) {
      checkPage(14);
      doc.setFillColor(240,244,248); doc.rect(14, y-4, W-28, 8, 'F');
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
      doc.text(title, 16, y+1); y+=8;
    }

    // Actividades
    if (incActs && acts.length) {
      sectionTitle('ACTIVIDADES');
      doc.autoTable({
        startY: y,
        head:[['Actividad','Unidad','Plan.','Ejec.','Avance','Costo Unit.','Estado']],
        body: acts.map(a=>{
          const pct=a.cantidad_planificada>0?Math.round(a.cantidad_ejecutada/a.cantidad_planificada*100):0;
          return [a.nombre,a.unidad,fmtNum(a.cantidad_planificada),fmtNum(a.cantidad_ejecutada),pct+'%',fmt(a.costo_unitario),a.estado];
        }),
        styles:{fontSize:8,cellPadding:2},
        headStyles:{fillColor:[15,69,37],textColor:255,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:[248,250,252]},
        margin:{left:14,right:14},
        didDrawPage:(d)=>{ y=d.cursor.y+6; }
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Personal
    if (incPers && pers.length) {
      checkPage(30);
      sectionTitle('PERSONAL');
      doc.autoTable({
        startY: y,
        head:[['Nombre','Cargo','Teléfono','Salario/Día']],
        body: pers.map(p=>[p.nombre,p.cargo||'-',p.telefono||'-',fmt(p.salario_diario)]),
        styles:{fontSize:8,cellPadding:2},
        headStyles:{fillColor:[15,69,37],textColor:255,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:[248,250,252]},
        margin:{left:14,right:14},
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Materiales
    if (incMats && mats.length) {
      checkPage(30);
      sectionTitle('MATERIALES');
      doc.autoTable({
        startY: y,
        head:[['Material','Unidad','Pedido','Recibido','Usado','Disponible','Costo Unit.']],
        body: mats.map(m=>[m.nombre,m.unidad,fmtNum(m.cantidad_pedida),fmtNum(m.cantidad_recibida),fmtNum(m.cantidad_usada),fmtNum(m.cantidad_recibida-m.cantidad_usada),fmt(m.costo_unitario)]),
        styles:{fontSize:8,cellPadding:2},
        headStyles:{fillColor:[15,69,37],textColor:255,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:[248,250,252]},
        margin:{left:14,right:14},
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Pagos
    if (incPags && pagos.length) {
      checkPage(30);
      sectionTitle('PAGOS');
      doc.autoTable({
        startY: y,
        head:[['Concepto','Beneficiario','Monto','Vencimiento','Estado']],
        body: pagos.map(pg=>[pg.concepto,pg.beneficiario||'-',fmt(pg.monto),fmtFecha(pg.fecha_vencimiento),pg.estado]),
        styles:{fontSize:8,cellPadding:2},
        headStyles:{fillColor:[15,69,37],textColor:255,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:[248,250,252]},
        margin:{left:14,right:14},
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Subcontratistas
    if (incSubs && subs.length) {
      checkPage(30);
      sectionTitle('SUBCONTRATISTAS');
      doc.autoTable({
        startY: y,
        head:[['Nombre','Especialidad','Contrato','Avance','Pagado','Saldo']],
        body: subs.map(s=>[s.nombre+(s.empresa?' / '+s.empresa:''),s.especialidad||'-',fmt(s.monto_contrato),s.avance_certificado+'%',fmt(s.pagado),fmt(s.avance_certificado/100*s.monto_contrato-s.pagado)]),
        styles:{fontSize:8,cellPadding:2},
        headStyles:{fillColor:[15,69,37],textColor:255,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:[248,250,252]},
        margin:{left:14,right:14},
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Bitácora
    if (incBit && bit.length) {
      checkPage(30);
      sectionTitle('BITÁCORA (últimas entradas)');
      doc.autoTable({
        startY: y,
        head:[['Fecha','Personal','Clima','Actividades','Incidentes']],
        body: bit.slice(0,10).map(b=>[fmtFecha(b.fecha),b.personal_presente,b.clima||'-',(b.actividades_dia||'').slice(0,60),(b.incidentes||'').slice(0,60)]),
        styles:{fontSize:7.5,cellPadding:2},
        headStyles:{fillColor:[15,69,37],textColor:255,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:[248,250,252]},
        margin:{left:14,right:14},
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Pie de página en todas las páginas
    const total = doc.internal.getNumberOfPages();
    for (let i=1;i<=total;i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`${empresa} · Informe generado con GestObra`, 14, 290);
      doc.text(`Página ${i} de ${total}`, W-30, 290);
    }

    doc.save(`Informe_${p.nombre.replace(/[^a-zA-Z0-9]/g,'_')}_${hoy()}.pdf`);
    toast('PDF generado y descargado', 'success');
  };
}
