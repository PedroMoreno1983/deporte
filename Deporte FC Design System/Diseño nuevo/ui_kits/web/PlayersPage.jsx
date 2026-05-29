// ============================================================
// DEPORTE FC — Players Page
// ============================================================

const POSITION_GROUPS = {
  goalkeeper:"gk", center_back:"def", left_back:"def", right_back:"def",
  defensive_mid:"mid", central_mid:"mid", attacking_mid:"mid",
  left_wing:"atk", right_wing:"atk", center_forward:"atk",
};
const POS_CFG = {
  gk:  { color:"#f59e0b", label:"POR" },
  def: { color:"#0ea5e9", label:"DEF" },
  mid: { color:"#00ff87", label:"MED" },
  atk: { color:"#ff3b30", label:"DEL" },
};
const STATUS_CFG = {
  available:  { label:"● Disponible",  color:"#00ff87" },
  injured:    { label:"● Lesionado",   color:"#ff3b30" },
  recovering: { label:"● Recuperando", color:"#f97316" },
  suspended:  { label:"● Suspendido",  color:"#f59e0b" },
  inactive:   { label:"● Inactivo",    color:"#64748b" },
};
const POS_LABELS = {
  goalkeeper:"Portero", center_back:"Def. Central", left_back:"Lat. Izq.",
  right_back:"Lat. Der.", defensive_mid:"MC Def.", central_mid:"MC",
  attacking_mid:"MC Of.", left_wing:"Ext. Izq.", right_wing:"Ext. Der.", center_forward:"Delantero",
};

const PLAYERS = [
  {id:1,first:"Pedro",   last:"García",   num:1, pos:"goalkeeper",    status:"available"},
  {id:2,first:"Jorge",   last:"Ramírez",  num:4, pos:"center_back",   status:"available"},
  {id:3,first:"Manuel",  last:"Torres",   num:5, pos:"center_back",   status:"injured"},
  {id:4,first:"Luis",    last:"Vargas",   num:3, pos:"left_back",     status:"available"},
  {id:5,first:"Ricardo", last:"Soto",     num:2, pos:"right_back",    status:"recovering"},
  {id:6,first:"Andrés",  last:"Rojas",    num:6, pos:"defensive_mid", status:"available"},
  {id:7,first:"Marcos",  last:"León",     num:7, pos:"central_mid",   status:"available"},
  {id:8,first:"Carlos",  last:"Andrés",   num:8, pos:"attacking_mid", status:"available"},
  {id:9,first:"Felipe",  last:"Castro",   num:11,pos:"left_wing",     status:"suspended"},
  {id:10,first:"Diego",  last:"Herrera",  num:10,pos:"right_wing",    status:"available"},
  {id:11,first:"Luis",   last:"Mendoza",  num:9, pos:"center_forward",status:"injured"},
  {id:12,first:"Pablo",  last:"Núñez",    num:14,pos:"central_mid",   status:"available"},
];

function PlayerCardUI({ p, onClick, selected }) {
  const grp = POSITION_GROUPS[p.pos] || "mid";
  const pos = POS_CFG[grp];
  const st  = STATUS_CFG[p.status] || STATUS_CFG.inactive;
  const init = `${p.first[0]}${p.last[0]}`;
  return (
    <div onClick={() => onClick(p)}
      style={{position:"relative",borderRadius:16,overflow:"hidden",cursor:"pointer",padding:"16px 14px 14px",background:"rgba(8,15,32,0.85)",border:`1px solid ${selected?"rgba(0,255,135,0.5)":pos.color+"52"}`,transition:"transform 0.2s, box-shadow 0.2s",boxShadow: selected?"0 0 0 2px #00ff87,0 8px 32px rgba(0,0,0,0.5)":"0 4px 16px rgba(0,0,0,0.4)"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px) scale(1.02)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0) scale(1)";}}>
      {/* top edge */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent 5%,${pos.color} 30%,${pos.color} 70%,transparent 95%)`,boxShadow:`0 0 12px ${pos.color}80`}}/>
      {/* watermark jersey */}
      <div style={{position:"absolute",right:-8,bottom:-12,fontFamily:"'JetBrains Mono',monospace",fontWeight:900,fontSize:80,lineHeight:1,letterSpacing:"-0.06em",color:pos.color,opacity:0.10,pointerEvents:"none",userSelect:"none"}}>{p.num}</div>
      {/* status badge */}
      <div style={{position:"absolute",top:10,right:10}}>
        <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:999,color:st.color,background:`${st.color}24`,border:`1px solid ${st.color}4d`}}>{st.label}</span>
      </div>
      {/* pos badge */}
      <span style={{fontSize:9,fontWeight:900,letterSpacing:"0.1em",padding:"2px 7px",borderRadius:5,color:pos.color,background:`${pos.color}30`,border:`1px solid ${pos.color}66`,display:"inline-block",marginBottom:10}}>{pos.label}</span>
      {/* avatar */}
      <div style={{width:48,height:48,borderRadius:12,background:"rgba(8,15,32,0.85)",border:`2px solid ${pos.color}bb`,color:pos.color,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:900,marginBottom:10,boxShadow:`0 0 20px ${pos.color}4d`}}>
        {init}
      </div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:pos.color,opacity:0.6,marginBottom:2}}>#{p.num}</div>
      <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.95)",lineHeight:1.2}}>{p.first}</div>
      <div style={{fontSize:13,fontWeight:900,color:"#fff",lineHeight:1.2,letterSpacing:"-0.01em"}}>{p.last}</div>
      <div style={{fontSize:11,color:"rgba(148,163,184,0.7)",marginTop:5}}>{POS_LABELS[p.pos]}</div>
    </div>
  );
}

function PlayerDetail({ p, onClose }) {
  if (!p) return null;
  const grp = POSITION_GROUPS[p.pos] || "mid";
  const pos = POS_CFG[grp];
  const st  = STATUS_CFG[p.status] || STATUS_CFG.inactive;
  return (
    <div style={{padding:20,borderRadius:12,background:"rgba(8,15,32,0.95)",border:"1px solid rgba(255,255,255,0.12)",boxShadow:"0 8px 40px rgba(0,0,0,0.6)",minWidth:280}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"rgba(100,116,139,0.8)"}}>Detalle Jugador</span>
        <div onClick={onClose} style={{cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:18,lineHeight:1}} onMouseEnter={e=>e.target.style.color="#ff3b30"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.3)"}>✕</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
        <div style={{width:56,height:56,borderRadius:14,background:"rgba(8,15,32,0.85)",border:`2px solid ${pos.color}cc`,color:pos.color,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:900}}>{p.first[0]}{p.last[0]}</div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:"#f1f5f9"}}>{p.first} {p.last}</div>
          <div style={{fontSize:12,color:"rgba(148,163,184,0.7)",marginTop:2}}>{POS_LABELS[p.pos]}</div>
          <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:999,color:st.color,background:`${st.color}24`,border:`1px solid ${st.color}4d`,marginTop:6,display:"inline-block"}}>{st.label}</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[["Dorsal","#"+p.num],["Posición",pos.label],["Estado",p.status],["Equipo","Deporte FC"]].map(([k,v])=>(
          <div key={k} style={{padding:"10px 12px",borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(100,116,139,0.7)",marginBottom:3}}>{k}</div>
            <div style={{fontSize:13,fontWeight:600,color:"#f1f5f9",fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayersPage() {
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState(null);

  const statuses = ["all","available","injured","recovering","suspended"];
  const statusLabels = { all:"Todos", available:"Disponible", injured:"Lesionado", recovering:"Recuperando", suspended:"Suspendido" };

  const filtered = PLAYERS.filter(p => {
    const matchStatus = filter === "all" || p.status === filter;
    const matchSearch = search === "" || `${p.first} ${p.last}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div style={{padding:"28px"}}>
      <PageHeader
        title="Jugadores"
        description="Gestión del plantel — 26 jugadores registrados"
        badge={`${PLAYERS.filter(p=>p.status==="available").length} disponibles`}
        icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}
      />
      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        {statuses.map(s => (
          <div key={s} onClick={() => setFilter(s)}
            style={{padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:"1px solid",transition:"all 0.15s",
              background: filter===s?"#00ff87":"rgba(255,255,255,0.04)",
              color: filter===s?"#000":"rgba(255,255,255,0.55)",
              borderColor: filter===s?"#00ff87":"rgba(255,255,255,0.10)"}}>
            {statusLabels[s]}
          </div>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar jugadores…"
          style={{marginLeft:"auto",padding:"7px 13px",borderRadius:10,background:"rgba(22,32,50,0.8)",border:"1px solid rgba(255,255,255,0.10)",color:"#f1f5f9",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none",width:200}}
          onFocus={e=>{e.target.style.borderColor="rgba(0,255,135,0.4)";e.target.style.boxShadow="0 0 0 3px rgba(0,255,135,0.10)";}}
          onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.10)";e.target.style.boxShadow="none";}}/>
      </div>
      {/* Layout */}
      <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,flex:1}}>
          {filtered.map(p => (
            <PlayerCardUI key={p.id} p={p} onClick={setSelected} selected={selected?.id===p.id}/>
          ))}
        </div>
        {selected && (
          <div style={{width:300,flexShrink:0}}>
            <PlayerDetail p={selected} onClose={()=>setSelected(null)}/>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { PlayersPage });
