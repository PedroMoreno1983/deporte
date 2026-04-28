// ============================================================
// DEPORTE FC — Injuries Page
// ============================================================

const INJURIES = [
  {id:1, player:"Carlos Mendoza",  pos:"Delantero",      posKey:"atk", type:"Distensión isquiotibial izq.", date:"18 Abr 2025", severity:"critical", recovery:21, status:"injured"},
  {id:2, player:"Manuel Torres",   pos:"Def. Central",   posKey:"def", type:"Esguince tobillo derecho",    date:"10 Abr 2025", severity:"high",     recovery:14, status:"injured"},
  {id:3, player:"Diego Herrera",   pos:"Ext. Izq.",      posKey:"atk", type:"Sobrecarga muscular cuádriceps",date:"2 Abr 2025", severity:"medium",   recovery:7,  status:"recovering"},
  {id:4, player:"Ricardo Soto",    pos:"Lat. Der.",      posKey:"def", type:"Contusión rodilla izquierda",  date:"28 Mar 2025", severity:"medium",   recovery:5,  status:"recovering"},
  {id:5, player:"Pedro García",    pos:"Portero",        posKey:"gk",  type:"Lesión de muñeca (alta)",      date:"15 Mar 2025", severity:"low",      recovery:0,  status:"available"},
];

const SEV_CFG = {
  low:      { color:"#00ff87", label:"Bajo" },
  medium:   { color:"#f59e0b", label:"Moderado" },
  high:     { color:"#f97316", label:"Alto" },
  critical: { color:"#ff3b30", label:"Crítico" },
};

const POS_COLORS_INJ = { gk:"#f59e0b", def:"#0ea5e9", mid:"#00ff87", atk:"#ff3b30" };

function InjuryRow({ inj }) {
  const sev = SEV_CFG[inj.severity];
  const posC = POS_COLORS_INJ[inj.posKey];
  return (
    <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr",gap:12,padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)",alignItems:"center",transition:"background 0.15s",cursor:"default"}}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.025)"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      {/* Player */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:10,background:"rgba(8,15,32,0.85)",border:`1px solid ${posC}66`,color:posC,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:900,flexShrink:0}}>
          {inj.player.split(" ").map(w=>w[0]).join("").slice(0,2)}
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:"#f1f5f9"}}>{inj.player}</div>
          <div style={{fontSize:11,color:"rgba(148,163,184,0.6)"}}>{inj.pos}</div>
        </div>
      </div>
      {/* Injury type */}
      <div style={{fontSize:12,color:"rgba(241,245,249,0.75)"}}>{inj.type}</div>
      {/* Date */}
      <div style={{fontSize:11,color:"rgba(100,116,139,0.8)",fontFamily:"'JetBrains Mono',monospace"}}>{inj.date}</div>
      {/* Recovery */}
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color: inj.recovery===0?"#00ff87":sev.color}}>
        {inj.recovery === 0 ? "Alta" : `${inj.recovery}d`}
      </div>
      {/* Severity */}
      <span style={{fontSize:9,fontWeight:700,padding:"3px 10px",borderRadius:999,color:sev.color,background:`${sev.color}20`,border:`1px solid ${sev.color}40`,display:"inline-flex",alignItems:"center",gap:4,letterSpacing:"0.05em"}}>
        ● {sev.label}
      </span>
    </div>
  );
}

function InjuriesPage() {
  const active = INJURIES.filter(i => i.status !== "available");
  const recovered = INJURIES.filter(i => i.status === "available");

  return (
    <div style={{padding:"28px"}}>
      <PageHeader
        title="Lesiones"
        description="Seguimiento de lesiones y recuperación del plantel"
        badge={`${active.length} activas`}
        icon={<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}
      />

      {/* Stats */}
      <div style={{display:"flex",gap:12,marginBottom:20}}>
        <KPICard label="Lesiones Activas" value={active.length} color="#ff3b30" sub="En tratamiento"/>
        <KPICard label="En Recuperación" value={INJURIES.filter(i=>i.status==="recovering").length} color="#f59e0b" sub="Protocolo activo"/>
        <KPICard label="Días Prom. Recuperación" value="14d" color="#0ea5e9" sub="Temporada actual"/>
        <KPICard label="Dados de Alta" value={recovered.length} color="#00ff87" sub="Este mes"/>
      </div>

      {/* Table */}
      <GlowCard style={{overflow:"hidden"}}>
        {/* Table header */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr",gap:12,padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.10)",background:"rgba(255,255,255,0.02)"}}>
          {["Jugador","Lesión","Fecha","Recuperación","Severidad"].map(h=>(
            <div key={h} style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(100,116,139,0.7)"}}>{h}</div>
          ))}
        </div>
        {active.map(inj => <InjuryRow key={inj.id} inj={inj}/>)}
        {recovered.length > 0 && (
          <>
            <div style={{padding:"8px 16px",background:"rgba(0,255,135,0.05)",borderTop:"1px solid rgba(0,255,135,0.15)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(0,255,135,0.7)"}}>✓ Dados de Alta</span>
            </div>
            {recovered.map(inj => <InjuryRow key={inj.id} inj={inj}/>)}
          </>
        )}
      </GlowCard>
    </div>
  );
}

Object.assign(window, { InjuriesPage });
