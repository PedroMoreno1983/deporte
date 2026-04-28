// ============================================================
// DEPORTE FC — Dashboard Page
// ============================================================

function MiniBar({ pct, color }) {
  return (
    <div style={{width:"100%",height:4,borderRadius:4,background:"rgba(255,255,255,0.07)",overflow:"hidden"}}>
      <div style={{width:`${pct}%`,height:"100%",borderRadius:4,background:color,boxShadow:`0 0 8px ${color}80`}}/>
    </div>
  );
}

function RiskRow({ name, pos, score, level }) {
  const cols = { low:"#00ff87", medium:"#f59e0b", high:"#f97316", critical:"#ff3b30" };
  const labels = { low:"Bajo", medium:"Moderado", high:"Alto", critical:"Crítico" };
  const c = cols[level];
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
      <div style={{width:40,height:40,borderRadius:10,background:"rgba(8,15,32,0.85)",border:`1px solid ${c}50`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:c,flexShrink:0}}>{score}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:"#f1f5f9",marginBottom:2}}>{name}</div>
        <div style={{fontSize:11,color:"rgba(148,163,184,0.6)"}}>{pos}</div>
      </div>
      <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:999,color:c,background:`${c}20`,border:`1px solid ${c}40`}}>{labels[level]}</span>
    </div>
  );
}

function ActivityRow({ text, time, dot }) {
  return (
    <div style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
      <div style={{width:6,height:6,borderRadius:99,background:dot,flexShrink:0,marginTop:5,boxShadow:`0 0 6px ${dot}`}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:12,color:"rgba(241,245,249,0.85)"}}>{text}</div>
        <div style={{fontSize:10,color:"rgba(100,116,139,0.8)",marginTop:2}}>{time}</div>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <div style={{padding:"28px 28px"}}>
      <PageHeader
        title="Dashboard"
        description="Resumen del equipo — temporada 2025/26"
        badge="En vivo"
        icon={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>}
      />

      {/* KPI strip */}
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <KPICard label="Jugadores" value="26" sub="Total plantel" color="#00ff87"/>
        <KPICard label="Disponibles" value="21" sub="+2 esta semana" color="#00ff87"/>
        <KPICard label="Lesionados" value="4" sub="Baja temporal" color="#ff3b30"/>
        <KPICard label="Disponibilidad" value="87%" sub="Objetivo: 90%" color="#0ea5e9"/>
        <KPICard label="Riesgo Alto" value="3" sub="Requieren atención" color="#f59e0b"/>
      </div>

      {/* Main grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>

        {/* Injury risk */}
        <GlowCard style={{padding:20}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(100,116,139,0.8)",marginBottom:14}}>Alerta de Riesgo</div>
          <RiskRow name="Carlos Mendoza"  pos="Delantero"    score={91} level="critical"/>
          <RiskRow name="Diego Herrera"   pos="Ext. Izq."    score={74} level="high"/>
          <RiskRow name="Andrés Rojas"    pos="MC Def."      score={68} level="high"/>
          <RiskRow name="Marcos León"     pos="Lat. Der."    score={47} level="medium"/>
          <RiskRow name="Felipe Castro"   pos="Def. Central" score={22} level="low"/>
        </GlowCard>

        {/* Actividad reciente */}
        <GlowCard style={{padding:20}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(100,116,139,0.8)",marginBottom:14}}>Actividad Reciente</div>
          <ActivityRow text="Carlos Mendoza — nueva lesión registrada (isquiotibial izq.)" time="Hace 20 min" dot="#ff3b30"/>
          <ActivityRow text="Sesión de entrenamiento completada — 18 jugadores" time="Hace 1h" dot="#00ff87"/>
          <ActivityRow text="Diego Herrera — wellness bajo (6/10)" time="Hace 2h" dot="#f59e0b"/>
          <ActivityRow text="Partido vs. Olimpia — resultado 2-1" time="Ayer, 21:00" dot="#0ea5e9"/>
          <ActivityRow text="Pedro García — alta médica, disponible" time="Ayer, 10:30" dot="#00ff87"/>
        </GlowCard>

        {/* Disponibilidad por posición */}
        <GlowCard style={{padding:20}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(100,116,139,0.8)",marginBottom:14}}>Disponibilidad por Posición</div>
          {[{pos:"Porteros",avail:2,total:2,c:"#f59e0b"},{pos:"Defensas",avail:6,total:8,c:"#0ea5e9"},{pos:"Mediocampistas",avail:8,total:10,c:"#00ff87"},{pos:"Delanteros",avail:5,total:6,c:"#ff3b30"}].map(p=>(
            <div key={p.pos} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:12,color:"rgba(241,245,249,0.8)"}}>{p.pos}</span>
                <span style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:p.c,fontWeight:700}}>{p.avail}/{p.total}</span>
              </div>
              <MiniBar pct={(p.avail/p.total)*100} color={p.c}/>
            </div>
          ))}
        </GlowCard>

        {/* Próximos partidos */}
        <GlowCard style={{padding:20}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(100,116,139,0.8)",marginBottom:14}}>Próximos Partidos</div>
          {[
            {local:"Deporte FC",visit:"Olimpia",date:"Sáb 26 Abr",comp:"Liga Nacional",home:true},
            {local:"Nacional",visit:"Deporte FC",date:"Mar 29 Abr",comp:"Copa",home:false},
            {local:"Deporte FC",visit:"Cerro",date:"Sáb 3 May",comp:"Liga Nacional",home:true},
          ].map((m,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              <div style={{width:36,height:36,borderRadius:8,background:m.home?"rgba(0,255,135,0.12)":"rgba(14,165,233,0.12)",border:`1px solid ${m.home?"rgba(0,255,135,0.3)":"rgba(14,165,233,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:m.home?"#00ff87":"#0ea5e9",flexShrink:0}}>{m.home?"LOC":"VIS"}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:"#f1f5f9"}}>{m.local} <span style={{color:"rgba(148,163,184,0.5)"}}>vs</span> {m.visit}</div>
                <div style={{fontSize:10,color:"rgba(100,116,139,0.8)",marginTop:1}}>{m.date} · {m.comp}</div>
              </div>
            </div>
          ))}
        </GlowCard>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage });
