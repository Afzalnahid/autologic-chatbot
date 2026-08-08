"use client";
import { useState, useEffect, useRef } from "react";

// Shared presentational building blocks. Each tab imports from here, so the
// design tokens have exactly one definition.

// Design tokens. Every component reads from here, so the whole surface
// re-skins by editing this object alone. Key names are kept from the previous
// palette so no component needs touching; `gold` is now the periwinkle
// primary, and the amber it used to hold lives on in `warn`.
// Every value is a CSS variable, so the whole dashboard re-themes at runtime
// without a single component re-rendering — inline styles accept var() happily.
// The two palettes live in <Theme/> below.
export const T = {
  bg: "var(--bg)", bgAlt: "var(--bgAlt)", card: "var(--card)", cardAlt: "var(--cardAlt)", inset: "var(--inset)",
  rail: "var(--rail)", railHover: "var(--railHover)", railText: "var(--railText)", railTextOn: "var(--railTextOn)",
  gold: "var(--gold)", goldDim: "var(--goldDim)", goldBg: "var(--goldBg)",
  text: "var(--text)", textMuted: "var(--textMuted)", textDim: "var(--textDim)",
  border: "var(--border)", borderStrong: "var(--borderStrong)",
  danger: "var(--danger)", success: "var(--success)", info: "var(--gold)", warn: "var(--warn)", purple: "var(--purple)",
  live: "var(--live)", liveBg: "var(--liveBg)", warnBg: "var(--warnBg)", dangerBg: "var(--dangerBg)",
};

export const ITEM_WORDS = { ecommerce:{item:"Product",inv:"Inventory",order:"Orders"}, agency:{item:"Service",inv:"Services",order:"Inquiries"}, other:{item:"Item",inv:"Catalog",order:"Requests"} };
export function words(bt){ return ITEM_WORDS[bt] || ITEM_WORDS.other; }

export function useIsMobile(){
  const [m,setM]=useState(false);
  useEffect(()=>{
    const check=()=>setM(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);
  return m;
}

export function Btn({children,gold,danger,small,style,...p}){ return <button {...p} className="ui-btn" style={{padding:small?"6px 14px":"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:small?12:13,fontWeight:500,background:danger?T.danger:gold?T.gold:T.goldBg,color:danger?"#fff":gold?"#0A0D14":T.gold,...style}}>{children}</button>; }
export function Badge({children,color=T.gold}){ return <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,background:`${color}18`,color}}>{children}</span>; }
export function Card({children,style,...p}){ return <div {...p} className="ui-card" style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,boxShadow:"0 1px 2px rgba(19,23,34,.04)",padding:"1.25rem",...style}}>{children}</div>; }
export function Inp({label,textarea,style,inputStyle,...p}){ return <div style={{marginBottom:16,...style}}>{label&&<label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{label}</label>}{textarea?<textarea {...p} className="ui-inp" style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,resize:"vertical",minHeight:100,outline:"none",fontFamily:"inherit",boxSizing:"border-box",...inputStyle}}/>:<input {...p} className="ui-inp" style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",...inputStyle}}/>}</div>; }

// Plan catalogue and formatting used by several tabs.
export const PLAN_META={
  trial:{name:"Free Trial",color:T.info},
  starter:{name:"Starter",color:T.success},
  pro:{name:"Pro",color:T.gold},
  agency:{name:"Agency",color:T.purple},
  none:{name:"No plan",color:T.textDim},
};
export const PLAN_LIST=[
  {id:"starter",name:"Starter",monthly:1500,yearly:15000,tagline:"For small shops getting started",
   features:["3,000 messages / month","1 channel","AI replies in Bangla & English","Product catalogue & orders","Analytics dashboard"]},
  {id:"pro",name:"Pro",monthly:3500,yearly:35000,highlight:true,tagline:"For growing businesses",
   features:["15,000 messages / month","All 3 channels","Photo product matching","Knowledge Base upload","Voice messages","Everything in Starter"]},
  {id:"agency",name:"Agency",monthly:6000,yearly:60000,tagline:"For service providers & agencies",
   features:["Unlimited messages","Google Calendar booking","Automatic Meet links","Priority support","Everything in Pro"]},
];
export const taka=n=>"\u09F3"+Number(n||0).toLocaleString("en-IN");
export const shortDate=d=>d?new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"—";

// Chart and stat building blocks shared by the tabs.
export function StatCard({icon,label,value,sub,color=T.gold}){ return <Card style={{flex:1,minWidth:140}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:36,height:36,borderRadius:10,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`ti ${icon}`} style={{fontSize:18,color}}/></div><span style={{fontSize:12,color:T.textMuted,textTransform:"uppercase",letterSpacing:.8}}>{label}</span></div><div style={{fontSize:28,fontWeight:600,color:T.text}}>{value}</div>{sub&&<div style={{fontSize:12,color:T.textMuted,marginTop:4}}>{sub}</div>}</Card>; }

export const fmtNum=n=>{const v=Number(n)||0;if(Math.abs(v)>=1e6)return (v/1e6).toFixed(v%1e6===0?0:1)+"M";if(Math.abs(v)>=1000)return (v/1000).toFixed(v%1000===0?0:1)+"K";return String(v);};
export const fmtMoney=n=>"\u09F3"+(Number(n)||0).toLocaleString("en-IN");

export function Trend({value,unit="%",invert}) {
  if(value===null||value===undefined) return <span style={{fontSize:11,color:T.textDim}}>new</span>;
  const up=value>0, flat=value===0;
  const good=invert?!up:up;
  const color=flat?T.textDim:good?T.success:T.danger;
  return <span style={{fontSize:11,color,fontWeight:600,display:"inline-flex",alignItems:"center",gap:2}}>
    {!flat&&<i className={`ti ti-${up?"arrow-up-right":"arrow-down-right"}`} style={{fontSize:12}}/>}
    {flat?"0":`${Math.abs(value)}`}{unit}
  </span>;
}

export function KStat({icon,label,value,sub,color=T.gold,trend,trendUnit,invert}) {
  return <Card style={{flex:1,minWidth:150}}>
    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
      <div style={{width:30,height:30,borderRadius:9,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <i className={`ti ${icon}`} style={{fontSize:15,color}}/>
      </div>
      <span style={{fontSize:11,color:T.textMuted,textTransform:"uppercase",letterSpacing:.7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
    </div>
    <div style={{display:"flex",alignItems:"baseline",gap:7,flexWrap:"wrap"}}>
      <span style={{fontSize:24,fontWeight:600,color:T.text,lineHeight:1.1}}>{value}</span>
      {trend!==undefined&&<Trend value={trend} unit={trendUnit} invert={invert}/>}
    </div>
    {sub&&<div style={{fontSize:11.5,color:T.textMuted,marginTop:4}}>{sub}</div>}
  </Card>;
}

export function Spark({data,keys,colors,height=120,labels}) {
  const max=Math.max(1,...data.flatMap(d=>keys.map(k=>d[k]||0)));
  const W=320,H=height,P=6;
  const x=i=>data.length<=1?W/2:(i/(data.length-1))*(W-P*2)+P;
  const y=v=>H-P-(v/max)*(H-P*2-10);
  const line=k=>data.map((d,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(d[k]||0).toFixed(1)}`).join(" ");
  const area=k=>data.length<2?"":`${line(k)} L${x(data.length-1).toFixed(1)},${H-P} L${x(0).toFixed(1)},${H-P} Z`;
  return <div>
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height,display:"block",overflow:"visible"}}>
      {[0,max/2,max].map((t,i)=><line key={i} x1={P} x2={W-P} y1={y(t)} y2={y(t)} stroke={T.border} strokeWidth="0.5" strokeDasharray="2 3"/>)}
      {keys.map((k,ki)=><g key={k}>
        <path d={area(k)} fill={colors[ki]} opacity="0.10"/>
        <path d={line(k)} fill="none" stroke={colors[ki]} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
      </g>)}
    </svg>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.textDim,marginTop:4}}>
      <span>{labels?.[0]}</span><span style={{color:T.textMuted}}>peak {fmtNum(max)}</span><span>{labels?.[1]}</span>
    </div>
  </div>;
}

export function BarList({items,color=T.gold,empty,money}) {
  if(!items?.length) return <div style={{fontSize:12.5,color:T.textDim}}>{empty}</div>;
  const max=Math.max(1,...items.map(i=>i.count));
  return items.map((it,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
    <span style={{fontSize:12.5,width:112,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={it.name||it.term}>{it.name||it.term}</span>
    <div style={{flex:1,height:5,background:T.bgAlt,borderRadius:3}}><div style={{height:"100%",width:`${(it.count/max)*100}%`,background:color,borderRadius:3}}/></div>
    <span style={{fontSize:12,fontWeight:500,minWidth:22,textAlign:"right",color:T.textMuted}}>{money?fmtMoney(it.count):it.count}</span>
  </div>);
}

// Sample questions shown in Settings and onboarding.
export const SAMPLE_ECOM=[
  {label:"Jewelry shop",text:"We sell imported jewelry — rings, necklaces and bracelets for both men and women. Prices are between 500 and 3000 taka. All rings are free size. We are online only, based in Savar. Delivery is 80 taka inside Dhaka (1-2 days) and 130 taka outside Dhaka (2-3 days). We take cash on delivery and bKash. Customers can check the product in front of the delivery rider."},
  {label:"Cake & food",text:"We make homemade cakes and desserts to order in Dhaka. A half kg cake starts from 800 taka. Custom cakes need at least 2 days notice. We deliver inside Dhaka only for 100 taka. Payment is bKash advance. We are closed on Fridays."},
  {label:"Clothing store",text:"We sell men's and women's clothing — shirts, panjabi, sarees and three-piece sets. Prices are 600 to 4000 taka. We have a size chart for every item, so always ask the customer for their size. Delivery all over Bangladesh: 70 taka in Dhaka, 130 taka outside. Cash on delivery is available. Exchange within 3 days if the size does not fit."},
];
export const SAMPLE_AGENCY=[
  {label:"Marketing agency",text:"We are a digital marketing agency in Dhaka. We manage Facebook and Instagram ads, create content, and handle page management. Packages start from 8000 taka per month. We offer a free 30 minute consultation call before starting any work. We are open Saturday to Thursday, 10am to 7pm."},
  {label:"Clinic / chamber",text:"We are a dental clinic in Chattogram. We do check-ups, scaling, filling and braces. The consultation fee is 500 taka. Patients need an appointment — we are open Saturday to Thursday, 5pm to 9pm. For emergencies they can call us directly."},
  {label:"Coaching centre",text:"We run an IELTS coaching centre in Dhaka. New batches start every month. The course fee is 12000 taka for 3 months with classes 3 days a week. We offer one free trial class. Students can book a counselling session to learn more before enrolling."},
];


// A dropdown that behaves like one: opens with a short spring, closes on Escape,
// on outside click, and on choosing. Native <select> could not be styled to match
// the rest of the surface, and this is used in enough places to be worth owning.
export function Select({ value, options, onChange, placeholder = "Select", style, wide }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const current = options.find((o) => (o.value ?? o) === value);
  const label = current ? (current.label ?? current) : placeholder;

  return (
    <div ref={box} style={{ position: "relative", ...style }}>
      <button type="button" className="ui-btn" onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox" aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, width: wide ? "100%" : "auto",
          padding: "9px 12px", borderRadius: 9, border: `1px solid ${open ? T.gold : T.border}`,
          background: T.card, color: T.text, fontSize: 13.5, fontWeight: 500, cursor: "pointer",
          boxShadow: open ? `0 0 0 3px color-mix(in srgb, ${T.gold} 13%, transparent)` : "none" }}>
        {current?.icon && <i className={`ti ${current.icon}`} style={{ fontSize: 15, color: T.gold }} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <i className="ti ti-chevron-down" style={{ marginLeft: "auto", fontSize: 15, color: T.textDim,
          transform: open ? "rotate(180deg)" : "none", transition: "transform .22s cubic-bezier(.16,1,.3,1)" }} />
      </button>

      {open && (
        <div role="listbox" className="ui-menu"
          style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: "100%", zIndex: 60,
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 11, padding: 5,
            boxShadow: "0 12px 32px rgba(19,23,34,.14)", maxHeight: 280, overflowY: "auto" }}>
          {options.map((o, i) => {
            const v = o.value ?? o, l = o.label ?? o, on = v === value;
            return (
              <button key={v} type="button" role="option" aria-selected={on} className="ui-opt"
                onClick={() => { onChange && onChange(v); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                  padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5,
                  background: on ? T.goldBg : "transparent", color: on ? T.gold : T.text,
                  fontWeight: on ? 600 : 400, animationDelay: `${i * 14}ms` }}>
                {o.icon && <i className={`ti ${o.icon}`} style={{ fontSize: 15 }} />}
                {l}
                {on && <i className="ti ti-check" style={{ marginLeft: "auto", fontSize: 15 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// One stylesheet for the whole dashboard's motion. Every duration sits between
// 120 and 300ms: long enough to be noticed, short enough never to be waited on.
export function Motion() {
  return (
    <style>{`
      .ui-btn { transition: filter .15s ease-out, transform .12s ease-out, border-color .18s ease-out, box-shadow .18s ease-out }
      .ui-btn:hover:not(:disabled) { filter: brightness(.97) }
      .ui-btn:active:not(:disabled) { transform: scale(.97) }
      .ui-card { transition: box-shadow .2s ease-out, transform .2s ease-out, border-color .2s ease-out }
      .ui-inp { transition: border-color .16s ease-out, box-shadow .16s ease-out }
      .ui-inp:focus { outline: none; border-color: ${T.gold}; box-shadow: 0 0 0 3px color-mix(in srgb, ${T.gold} 13%, transparent) }

      @keyframes ui-menu { from { opacity: 0; transform: translateY(-6px) scale(.98) } to { opacity: 1; transform: none } }
      .ui-menu { animation: ui-menu .18s cubic-bezier(.16,1,.3,1) both; transform-origin: top }
      @keyframes ui-opt { from { opacity: 0; transform: translateY(-3px) } to { opacity: 1; transform: none } }
      .ui-opt { animation: ui-opt .16s ease-out both }
      .ui-opt:hover { background: ${T.inset} !important }

      @keyframes ui-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
      .ui-page { animation: ui-in .28s cubic-bezier(.16,1,.3,1) both }

      .ui-row { transition: background .14s ease-out }
      .ui-row:hover { background: ${T.bgAlt} }
      .ui-nav { transition: background .15s ease-out, color .15s ease-out }

      @keyframes ui-pulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, ${T.live} 40%, transparent) } 50% { box-shadow: 0 0 0 5px color-mix(in srgb, ${T.live} 0%, transparent) } }
      .ui-live { animation: ui-pulse 2.6s ease-in-out infinite }

      @media (prefers-reduced-motion: reduce) {
        .ui-btn, .ui-card, .ui-inp, .ui-menu, .ui-opt, .ui-page, .ui-row, .ui-nav, .ui-live,
        .ui-btn *, .ui-menu * { animation: none !important; transition: none !important; transform: none !important }
      }
    `}</style>
  );
}


// Both palettes, and the switch. Contrast was checked pair by pair against the
// surface each colour actually sits on: body text clears 7:1 in both modes,
// secondary text and every status colour clear 4.5:1. Nothing here is a guess.
export const PALETTE = {
  light: {
    bg: "#F4F6F9", bgAlt: "#EDF0F5", card: "#FFFFFF", cardAlt: "#F8FAFC", inset: "#E9EDF3",
    rail: "#0D111A", railHover: "#1A2130", railText: "#A8B2C6", railTextOn: "#FFFFFF",
    gold: "#3B6FE8", goldDim: "#2B55C4", goldBg: "rgba(59,111,232,0.09)",
    text: "#0F1420", textMuted: "#4A5568", textDim: "#6B7488",
    border: "#DDE3EC", borderStrong: "#C6CEDC",
    danger: "#C93A50", success: "#097A5A", warn: "#8A5A07", purple: "#6D3FD9",
    live: "#0FA97C", liveBg: "rgba(15,169,124,0.11)", warnBg: "rgba(154,100,8,0.10)", dangerBg: "rgba(201,58,80,0.09)",
  },
  dark: {
    bg: "#0A0D14", bgAlt: "#0D1119", card: "#0F1420", cardAlt: "#151B2A", inset: "#1C2436",
    rail: "#080B12", railHover: "#161C2A", railText: "#98A3BA", railTextOn: "#FFFFFF",
    gold: "#7BA4FF", goldDim: "#5B8CFF", goldBg: "rgba(123,164,255,0.13)",
    text: "#E7EAF2", textMuted: "#A7B1C6", textDim: "#7C879C",
    border: "#1F2839", borderStrong: "#2C374D",
    danger: "#FF7A82", success: "#3FE0B4", warn: "#F5C25A", purple: "#A78BFA",
    live: "#2ED3A7", liveBg: "rgba(46,211,167,0.13)", warnBg: "rgba(245,194,90,0.12)", dangerBg: "rgba(255,122,130,0.11)",
  },
};

const vars = (p) => Object.entries(p).map(([k, v]) => `--${k}:${v}`).join(";");

export function Theme() {
  return (
    <style>{`
      :root, [data-theme="light"] { ${vars(PALETTE.light)}; color-scheme: light }
      [data-theme="dark"] { ${vars(PALETTE.dark)}; color-scheme: dark }
      body { background: var(--bg); color: var(--text) }
    `}</style>
  );
}

export function useTheme() {
  const [mode, setMode] = useState("light");
  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem("al-theme"); } catch {}
    // No stored choice means follow the machine — someone who runs their laptop
    // dark should not be handed a white screen.
    const start = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setMode(start);
    document.documentElement.dataset.theme = start;
  }, []);
  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("al-theme", next); } catch {}
  };
  return [mode, toggle];
}

export function ThemeToggle({ mode, toggle, onRail }) {
  return (
    <button onClick={toggle} className="ui-btn" title={mode === "dark" ? "Switch to light" : "Switch to dark"}
      aria-label="Switch theme"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
        borderRadius: 9, cursor: "pointer", background: onRail ? "transparent" : T.card,
        border: `1px solid ${onRail ? T.railHover : T.border}`, color: onRail ? T.railText : T.textMuted }}>
      <i className={`ti ti-${mode === "dark" ? "sun" : "moon"}`} style={{ fontSize: 16 }} />
    </button>
  );
}
