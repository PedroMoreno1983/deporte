// ============================================================
// DEPORTE FC — Shared Components
// Sidebar, PageHeader, KPICard, GlowCard, Badges, Buttons
// ============================================================

const NAV_ITEMS = [
  { id: "dashboard",   label: "Dashboard",      group: "General" },
  { id: "players",     label: "Jugadores",       group: "General" },
  { id: "injuries",    label: "Lesiones",        group: "General" },
  { id: "matches",     label: "Partidos",        group: "General" },
  { id: "training",    label: "Entrenamiento",   group: "General" },
  { id: "tactical",    label: "Pizarra",         group: "General" },
  { id: "wellness",    label: "Wellness",        group: "General" },
  { id: "analytics",   label: "Analytics",       group: "Analytics" },
  { id: "predictions", label: "Predicciones",    group: "Analytics" },
  { id: "settings",    label: "Configuración",   group: "Sistema" },
];

function NavIcon({ id }) {
  const icons = {
    dashboard:   <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,
    players:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    injuries:    <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    matches:     <><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></>,
    training:    <><path d="M6.5 6.5a6 6 0 0 0 0 11"/><path d="M17.5 6.5a6 6 0 0 1 0 11"/><path d="M6.5 12h11"/><circle cx="12" cy="12" r="1"/></>,
    tactical:    <><polygon points="3 11 22 2 13 21 11 13 3 11"/></>,
    wellness:    <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>,
    analytics:   <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    predictions: <><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></>,
    settings:    <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[id] || null}
    </svg>
  );
}

function Sidebar({ current, onNav }) {
  const groups = ["General", "Analytics", "Sistema"];
  return (
    <div style={{
      width: 230, height: "100%", flexShrink: 0, background: "var(--surface-1)",
      borderRight: "1px solid rgba(255,255,255,0.08)", boxShadow: "4px 0 40px rgba(0,0,0,0.7)",
      display: "flex", flexDirection: "column", position: "relative", overflowY: "auto",
    }}>
      {/* neon top line */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(0,255,135,0.6),transparent)"}}/>

      {/* Logo */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 14px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,rgba(0,255,135,0.2),rgba(0,255,135,0.08))",border:"1px solid rgba(0,255,135,0.4)",boxShadow:"0 0 16px rgba(0,255,135,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:900,letterSpacing:"-0.02em"}}><span style={{color:"#fff"}}>DEPORTE</span><span style={{color:"#00ff87"}}> FC</span></div>
          <div style={{fontSize:8,fontWeight:600,letterSpacing:"0.15em",color:"rgba(0,255,135,0.55)",textTransform:"uppercase"}}>Sports Platform</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{flex:1,padding:"10px 8px",display:"flex",flexDirection:"column",gap:2}}>
        {groups.map((grp, gi) => {
          const items = NAV_ITEMS.filter(i => i.group === grp);
          if (!items.length) return null;
          return (
            <div key={grp} style={gi > 0 ? {paddingTop:12} : {}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(100,116,139,0.8)",padding:"4px 8px 6px"}}>{grp}</div>
              {items.map(item => {
                const active = item.id === current;
                return (
                  <div key={item.id} onClick={() => onNav(item.id)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:10,fontSize:13,fontWeight:active?700:500,cursor:"pointer",marginBottom:2,
                      background: active ? "#00ff87" : "transparent",
                      color: active ? "#000" : "rgba(255,255,255,0.4)",
                      boxShadow: active ? "0 0 24px rgba(0,255,135,0.55),0 0 60px rgba(0,255,135,0.18)" : "none",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => { if(!active){ e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="rgba(255,255,255,0.8)"; }}}
                    onMouseLeave={e => { if(!active){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="rgba(255,255,255,0.4)"; }}}
                  >
                    <NavIcon id={item.id} />
                    {item.label}
                  </div>
                );
              })}
              {gi < groups.length-1 && <div style={{height:1,background:"rgba(255,255,255,0.07)",margin:"6px 4px"}}/>}
            </div>
          );
        })}
      </nav>

      {/* User card */}
      <div style={{padding:"8px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.03)"}}>
          <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,rgba(0,255,135,0.2),rgba(0,255,135,0.08))",border:"1px solid rgba(0,255,135,0.35)",color:"#00ff87",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:900,flexShrink:0}}>EC</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Entrenador Carlos</div>
            <div style={{fontSize:9,fontWeight:600,color:"rgba(0,255,135,0.75)"}}>Entrenador</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, color = "#00ff87" }) {
  return (
    <div style={{padding:"18px 20px",borderRadius:12,background:"rgba(8,15,32,0.75)",border:"1px solid rgba(255,255,255,0.10)",boxShadow:"0 4px 24px rgba(0,0,0,0.45)",flex:1,minWidth:140,position:"relative",overflow:"hidden",transition:"transform 0.2s, box-shadow 0.2s"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 40px rgba(0,0,0,0.5),0 0 0 1px ${color}26,0 0 20px ${color}14`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 24px rgba(0,0,0,0.45)";}}>
      <div style={{position:"absolute",top:0,left:"10%",right:"10%",height:1,background:`linear-gradient(90deg,transparent,${color},transparent)`,opacity:0.7}}/>
      <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(100,116,139,0.8)",marginBottom:8}}>{label}</div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:32,fontWeight:700,letterSpacing:"-0.04em",lineHeight:1,color}}>{value}</div>
      {sub && <div style={{fontSize:11,color:"rgba(100,116,139,0.8)",marginTop:5}}>{sub}</div>}
    </div>
  );
}

function GlowCard({ children, style }) {
  const ref = React.useRef(null);
  const handleMove = e => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${((e.clientX-r.left)/r.width)*100}%`);
    ref.current.style.setProperty("--my", `${((e.clientY-r.top)/r.height)*100}%`);
    ref.current.querySelector(".spotlight").style.opacity = 1;
  };
  const handleLeave = e => {
    if (!ref.current) return;
    ref.current.querySelector(".spotlight").style.opacity = 0;
  };
  return (
    <div ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave}
      style={{position:"relative",overflow:"hidden",background:"rgba(8,15,32,0.75)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:12,boxShadow:"0 4px 24px rgba(0,0,0,0.45)",transition:"border-color 0.25s,box-shadow 0.25s,transform 0.2s",...style}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(0,255,135,0.28)";e.currentTarget.style.transform="translateY(-2px)";}}
      onMouseLeave2={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.10)";e.currentTarget.style.transform="translateY(0)";}}>
      <div className="spotlight" style={{position:"absolute",inset:0,borderRadius:"inherit",background:"radial-gradient(600px circle at var(--mx,50%) var(--my,50%),rgba(0,255,135,0.08),transparent 65%)",opacity:0,transition:"opacity 0.3s",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1}}>{children}</div>
    </div>
  );
}

function Badge({ children, color = "#00ff87" }) {
  return (
    <span style={{display:"inline-flex",alignItems:"center",fontSize:9,fontWeight:700,padding:"3px 9px",borderRadius:999,color,background:`${color}20`,border:`1px solid ${color}4d`,letterSpacing:"0.05em"}}>
      {children}
    </span>
  );
}

function PageHeader({ icon, title, description, badge }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{padding:10,borderRadius:10,background:"rgba(0,255,135,0.10)",border:"1px solid rgba(0,255,135,0.20)"}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
        </div>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <h1 style={{margin:0,fontSize:22,fontWeight:700,letterSpacing:"-0.025em",color:"#f1f5f9"}}>{title}</h1>
            {badge && <Badge>{badge}</Badge>}
          </div>
          {description && <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.40)",marginTop:2}}>{description}</p>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, KPICard, GlowCard, Badge, PageHeader, NavIcon, NAV_ITEMS });
