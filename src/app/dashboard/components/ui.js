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
  nmOut: "var(--nm-out)", nmSm: "var(--nm-sm)", nmIn: "var(--nm-in)",
  accGrad: "var(--acc-grad)", accGlow: "var(--acc-glow)",
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

export function Btn({children,gold,danger,small,style,...p}){ return <button {...p} className="ui-btn" style={{padding:small?"6px 14px":"8px 20px",borderRadius:small?10:12,border:"none",cursor:"pointer",fontSize:small?12:13,fontWeight:600,background:danger?T.danger:gold?T.accGrad:T.goldBg,color:danger?"#fff":gold?"#fff":T.gold,boxShadow:gold?T.accGlow:"none",...style}}>{children}</button>; }
export function Badge({children,color=T.gold}){ return <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:`color-mix(in srgb, ${color} 11%, transparent)`,color}}>{children}</span>; }
export function Card({children,style,...p}){ return <div {...p} className="ui-card" style={{background:T.card,borderRadius:18,border:`1px solid ${T.border}`,boxShadow:T.nmSm,padding:"1.25rem",...style}}>{children}</div>; }
// `emb` gives the field the pressed-in look of the auth page — used on every
// first-run screen so signup, onboarding and the dashboard read as one product.
export function Inp({label,textarea,emb,style,inputStyle,...p}){
  const base={width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:emb?14:8,padding:emb?"13px 16px":"10px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",...(emb?{boxShadow:T.nmIn,border:`1px solid ${T.border}`}:{})};
  return <div style={{marginBottom:16,...style}}>{label&&<label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{label}</label>}{textarea?<textarea {...p} className="ui-inp" style={{...base,resize:"vertical",minHeight:100,...inputStyle}}/>:<input {...p} className="ui-inp" style={{...base,...inputStyle}}/>}</div>;
}

// The first-run frame: one soft slab in the middle of the page, a red icon
// tile, a title, and the step pills. Auth, onboarding and connect all sit in
// it, so a new owner sees the same product from the first screen on.
export function Steps({step,of}){
  return <div style={{display:"flex",gap:6,justifyContent:"center",margin:"14px 0 2px"}} aria-label={`Step ${step} of ${of}`}>
    {Array.from({length:of}).map((_,i)=><span key={i} style={{width:i+1===step?26:9,height:6,borderRadius:3,
      background:i<step?T.accGrad:T.inset,boxShadow:i+1===step?T.accGlow:"none",transition:"width .25s cubic-bezier(.16,1,.3,1)"}}/>)}
  </div>;
}
export function OnboardFrame({icon,title,sub,step,of,width=460,scroll,children}){
  return <div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:T.bg}}>
    <div className="ui-page" style={{width:"100%",maxWidth:width,background:T.card,borderRadius:26,border:`1px solid ${T.border}`,
      boxShadow:T.nmOut,padding:"clamp(22px, 4vw, 34px) clamp(18px, 4vw, 32px)",...(scroll?{maxHeight:"94dvh",overflowY:"auto"}:{})}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:T.text,marginBottom:18}}>
        <span style={{width:26,height:26,borderRadius:8,background:T.accGrad,boxShadow:T.accGlow,color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:14}}><i className="ti ti-bolt"/></span>
        Autologic
      </div>
      <div style={{textAlign:"center",marginBottom:22}}>
        <div style={{width:56,height:56,borderRadius:18,background:T.card,boxShadow:T.nmSm,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
          <i className={`ti ${icon}`} style={{fontSize:26,color:T.gold}}/>
        </div>
        <div style={{fontSize:20,fontWeight:700,letterSpacing:"-.02em",color:T.text}}>{title}</div>
        {sub&&<div style={{fontSize:13,color:T.textMuted,marginTop:5,lineHeight:1.55}}>{sub}</div>}
        {step&&<Steps step={step} of={of}/>}
      </div>
      {children}
    </div>
  </div>;
}

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
export function StatCard({icon,label,value,sub,color=T.gold}){ return <Card style={{flex:1,minWidth:140}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:36,height:36,borderRadius:12,background:`color-mix(in srgb, ${color} 10%, transparent)`,display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`ti ${icon}`} style={{fontSize:18,color}}/></div><span style={{fontSize:12,color:T.textMuted,textTransform:"uppercase",letterSpacing:.8}}>{label}</span></div><div style={{fontSize:28,fontWeight:600,color:T.text}}>{value}</div>{sub&&<div style={{fontSize:12,color:T.textMuted,marginTop:4}}>{sub}</div>}</Card>; }

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
      <div style={{width:30,height:30,borderRadius:10,background:`color-mix(in srgb, ${color} 10%, transparent)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
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
      /* Hover only where a pointer exists. On iOS a tapped element keeps its
         hover style until you tap elsewhere, which looks like a stuck button —
         this one media query is the difference between "polished" and "buggy"
         on an iPhone. */
      @media (hover: hover) and (pointer: fine) {
        .ui-btn:hover:not(:disabled) { filter: brightness(.97) }
        .ui-card:hover { box-shadow: 0 6px 20px color-mix(in srgb, ${T.text} 8%, transparent) }
        .ui-row:hover { background: ${T.bgAlt} }
        .ui-opt:hover { background: ${T.inset} !important }
        .ui-btn:hover .ti, .ui-nav:hover .ti { transform: scale(1.12) }
        .ui-btn:hover .ti-refresh, .ui-btn:hover .ti-reload { transform: rotate(90deg) }
        .ui-btn:hover .ti-trash { transform: rotate(-9deg) scale(1.1) }
        .ui-btn:hover .ti-plus { transform: rotate(90deg) }
        .ui-btn:hover .ti-arrow-left { transform: translateX(-2px) }
        .ui-btn:hover .ti-arrow-right, .ui-btn:hover .ti-send { transform: translateX(2px) }
        .ui-btn:hover .ti-download, .ui-btn:hover .ti-upload { transform: translateY(2px) }
        .ui-btn:hover .ti-copy { transform: translate(1px,-1px) }
        /* First-run rows and chips answer the pointer the way the sidebar does. */
        .ob-row:hover { border-color: ${T.gold} !important; box-shadow: var(--nm-out) !important; transform: translateY(-1px) }
        .ob-chip:hover { color: ${T.gold} !important; border-color: ${T.gold} !important }
      }

      /* Every icon shares one curve, so the whole app moves the same way. */
      .ti { transition: transform .2s cubic-bezier(.16,1,.3,1), color .18s ease-out;
            display: inline-block; will-change: transform }
      .ui-btn:active:not(:disabled) .ti { transform: scale(.88) }

      .ui-btn { transition: filter .15s ease-out, transform .12s ease-out, border-color .18s ease-out, box-shadow .18s ease-out }
      .ui-btn:active:not(:disabled) { transform: scale(.97) }
      .ui-card { transition: box-shadow .2s ease-out, transform .2s ease-out, border-color .2s ease-out }
      .ui-inp { transition: border-color .16s ease-out, box-shadow .16s ease-out }
      .ui-inp:focus { outline: none; border-color: ${T.gold}; box-shadow: 0 0 0 3px color-mix(in srgb, ${T.gold} 22%, transparent) }

      /* Anything busy says so in the same language. */
      @keyframes ui-spin { to { transform: rotate(360deg) } }
      .ti-loader, .ti-loader-2, .is-busy .ti-refresh { animation: ui-spin .9s linear infinite }
      @keyframes ui-pop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
      .ti-check, .ti-circle-check { animation: ui-pop .32s cubic-bezier(.16,1,.3,1) both }

      @keyframes ui-menu { from { opacity: 0; transform: translateY(-6px) scale(.98) } to { opacity: 1; transform: none } }
      .ui-menu { animation: ui-menu .18s cubic-bezier(.16,1,.3,1) both; transform-origin: top }
      @keyframes ui-opt { from { opacity: 0; transform: translateY(-3px) } to { opacity: 1; transform: none } }
      .ui-opt { animation: ui-opt .16s ease-out both }

      @keyframes ui-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
      .ui-page { animation: ui-in .28s cubic-bezier(.16,1,.3,1) both }

      .ui-row { transition: background .14s ease-out }
      .ui-nav { transition: background .15s ease-out, color .15s ease-out }

      @keyframes ui-pulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, ${T.live} 40%, transparent) }
                            50% { box-shadow: 0 0 0 5px color-mix(in srgb, ${T.live} 0%, transparent) } }
      .ui-live { animation: ui-pulse 2.6s ease-in-out infinite }

      /* Touch rules that apply on every phone, both platforms. */
      button, a, [role="button"], select, .ui-opt { -webkit-tap-highlight-color: transparent;
        touch-action: manipulation }
      @media (pointer: coarse) {
        /* .cal-cell is excluded on purpose: its size must come from the 7-column
           grid (see the calendar rules), and a 44px floor would overflow it. */
        button:not(.cal-cell), a[role="button"], .ui-opt { min-height: 44px }
        .ui-menu { max-height: min(60vh, 420px) }
      }
      /* iOS zooms the page when a field under 16px takes focus. */
      @supports (-webkit-touch-callout: none) {
        input, textarea, select { font-size: max(16px, 1em) }
      }

      /* The active pill is the one filled red in the whole surface — exactly the
         reference sidebar: red capsule, white text, soft red glow. */
      .seg-pill { background: var(--acc-grad); box-shadow: var(--acc-glow) }
      /* Glass only where something colourful sits behind it — over a flat panel
         a blur has nothing to blur and just looks grey. */
      .seg-glass { background: rgba(255,255,255,.14); backdrop-filter: blur(14px) saturate(150%);
        -webkit-backdrop-filter: blur(14px) saturate(150%);
        border: 1px solid rgba(255,255,255,.30);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 6px 22px rgba(0,0,0,.18) }
      .seg-item:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 2px }
      @media (hover: hover) and (pointer: fine) { .seg-item:hover { color: ${T.text} } }

      /* Premium square button — the reference header's 48px rounded tile that
         lifts off the surface and floods red on hover. */
      .pbtn { position: relative; width: 42px; height: 42px; border-radius: 14px; border: none;
        cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
        background: ${T.card}; color: ${T.textMuted}; box-shadow: var(--nm-sm); flex-shrink: 0;
        transition: background .3s ease, color .3s ease, box-shadow .3s ease, transform .15s ease }
      .pbtn:active { transform: scale(.94) }
      @media (hover: hover) and (pointer: fine) {
        .pbtn:hover { background: var(--acc-grad); color: #fff; box-shadow: var(--acc-glow) }
      }
      .pbtn .ti { font-size: 19px }
      /* Very narrow phones (≤360px): drop the on-screen back button — the
         phone's own back does the same — so the page title keeps its room. */
      @media (max-width: 360px) { .hide-xs { display: none !important } }
      .pbadge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px;
        padding: 0 5px; border-radius: 9px; background: var(--acc-grad); color: #fff;
        font-size: 10px; font-weight: 700; display: flex; align-items: center;
        justify-content: center; border: 2px solid ${T.card}; box-sizing: content-box }
      /* Calendar. A month grid is a navigator; the day list is where the work
         happens — so on a wide screen they sit side by side instead of the grid
         hugging one corner, and on a phone the grid stays a compact header above
         the list. Cells are sized from the container, never a fixed pixel width. */
      .cal-wrap { display: grid; gap: 20px; align-items: start; min-width: 0 }
      .cal-wrap > * { min-width: 0 }
      @media (min-width: 760px) { .cal-wrap { grid-template-columns: minmax(300px, 380px) minmax(0, 1fr) } }
      /* Seven columns that can each shrink to zero — a bare 1fr has a min-content
         floor, so on a 360px phone the Saturday column was pushed past the card
         edge and clipped. */
      .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; width: 100%; min-width: 0 }
      /* Height comes from the column width (aspect-ratio) — never the other way
         round: a min-height combined with aspect-ratio put a 44px floor on the
         cell's WIDTH too, and 7×44 + gaps does not fit a 320px phone, so the
         Saturday column spilled past the card. Width is always the grid's. */
      .cal-cell { aspect-ratio: 1; height: auto; min-width: 0; width: 100%; border-radius: 10px; cursor: pointer; padding: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        font-family: inherit; font-size: clamp(12px, 1.6vw, 14px); border: 1px solid transparent;
        background: transparent; transition: background .18s ease-out, color .18s ease-out, transform .12s ease-out }
      .cal-cell:active { transform: scale(.92) }
      /* Touch target: on a phone the cell is ~38–46px square from the grid
         alone; the tap area is padded out to 44px without changing layout. */
      @media (pointer: coarse) { .cal-cell { min-height: 0; position: relative }
        .cal-cell::after { content: ""; position: absolute; inset: -3px } }
      @media (max-width: 400px) { .cal-grid { gap: 2px } .cal-cell { border-radius: 8px; font-size: 12px } }
      .cal-dow { text-align: center; font-size: 10.5px; font-weight: 600; padding: 2px 0 }
      .cal-day { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid ${T.border} }
      .cal-day:first-of-type { border-top: none }
      /* Swiping the grid changes month, which every phone user expects. */
      .cal-swipe { touch-action: pan-y }

      @media (prefers-reduced-motion: reduce) {
        .seg-pill { transition: none !important }
        .ti, .ui-btn, .ui-card, .ui-inp, .ui-menu, .ui-opt, .ui-page, .ui-row, .ui-nav, .ui-live,
        .ti-check, .ti-loader, .ti-loader-2 {
          animation: none !important; transition: none !important; transform: none !important }
      }
    `}</style>
  );
}

// The 2026-08 redesign: crimson on soft white, neumorphic depth. `gold` still
// names the primary accent (every component reads it), it just holds red now.
// Mint stays reserved for "the bot is live" and nothing else.
export const PALETTE = {
  light: {
    bg: "#EEF0F5", bgAlt: "#E7EAF1", card: "#F5F6FA", cardAlt: "#FBFCFE", inset: "#E3E7EF",
    rail: "#F5F6FA", railHover: "#E9ECF3", railText: "#697083", railTextOn: "#FFFFFF",
    gold: "#D92632", goldDim: "#B01824", goldBg: "rgba(217,38,50,0.08)",
    text: "#191C24", textMuted: "#4C5364", textDim: "#8A91A3",
    border: "#DFE3EC", borderStrong: "#C9CFDD",
    danger: "#C9273A", success: "#0A7C5C", warn: "#8A5A07", purple: "#6D3FD9",
    live: "#0FA97C", liveBg: "rgba(15,169,124,0.11)", warnBg: "rgba(154,100,8,0.10)", dangerBg: "rgba(201,39,58,0.09)",
    shDark: "rgba(166,173,192,0.5)", shLight: "rgba(255,255,255,0.95)",
  },
  dark: {
    bg: "#111318", bgAlt: "#15181F", card: "#191C24", cardAlt: "#1F232D", inset: "#242936",
    rail: "#191C24", railHover: "#232833", railText: "#8B93A6", railTextOn: "#FFFFFF",
    gold: "#FF4D59", goldDim: "#E23440", goldBg: "rgba(255,77,89,0.12)",
    text: "#EAECF2", textMuted: "#A9B0C0", textDim: "#7C8496",
    border: "#252A35", borderStrong: "#333A49",
    danger: "#FF7A82", success: "#3FE0B4", warn: "#F5C25A", purple: "#A78BFA",
    live: "#2ED3A7", liveBg: "rgba(46,211,167,0.13)", warnBg: "rgba(245,194,90,0.12)", dangerBg: "rgba(255,122,130,0.11)",
    shDark: "rgba(0,0,0,0.55)", shLight: "rgba(255,255,255,0.05)",
  },
};

const vars = (p) => Object.entries(p).map(([k, v]) => `--${k}:${v}`).join(";");

export function Theme() {
  return (
    <style>{`
      :root, [data-theme="light"] { ${vars(PALETTE.light)}; color-scheme: light }
      [data-theme="dark"] { ${vars(PALETTE.dark)}; color-scheme: dark }
      /* Neumorphic depth, derived from the palette's shadow pair so both themes
         carve the same shapes. --acc-grad is the one red every filled control uses. */
      :root, [data-theme="light"], [data-theme="dark"] {
        --nm-out: 9px 9px 20px var(--shDark), -9px -9px 20px var(--shLight);
        --nm-sm: 4px 4px 10px var(--shDark), -4px -4px 10px var(--shLight);
        --nm-in: inset 4px 4px 9px var(--shDark), inset -4px -4px 9px var(--shLight);
        --acc-grad: linear-gradient(135deg, var(--gold), var(--goldDim));
        --acc-glow: 0 10px 22px color-mix(in srgb, var(--gold) 32%, transparent);
      }
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

export function ThemeToggle({ mode, toggle, style }) {
  return (
    <button onClick={toggle} className="pbtn" title={mode === "dark" ? "Switch to light" : "Switch to dark"}
      aria-label="Switch theme" style={style}>
      <i className={`ti ti-${mode === "dark" ? "sun" : "moon"}`} />
    </button>
  );
}


// A folding section. Height is animated from a measured value rather than to
// `auto`, which browsers refuse to animate — the alternative, a fixed max-height,
// either clips long content or makes short content open slowly.
export function Accordion({ icon, title, subtitle, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const inner = useRef(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!inner.current) return;
    const measure = () => setH(inner.current ? inner.current.scrollHeight : 0);
    measure();
    // Content can grow after it opens — a list loading, a textarea resizing.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(inner.current);
    return () => ro && ro.disconnect();
  }, [children, open]);

  return (
    <div className="ui-card" style={{ background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 2px rgba(19,23,34,.04)" }}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "14px 16px",
          background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: T.text,
          fontFamily: "inherit" }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: T.goldBg, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`ti ${icon}`} style={{ fontSize: 19, color: T.gold }} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{title}</span>
          {subtitle && <span style={{ display: "block", fontSize: 12, color: T.textMuted, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>}
        </span>
        {badge}
        <i className="ti ti-chevron-down" style={{ fontSize: 18, color: T.textDim, flexShrink: 0,
          transform: open ? "rotate(180deg)" : "none", transition: "transform .24s cubic-bezier(.16,1,.3,1)" }} />
      </button>

      <div style={{ height: open ? h : 0, overflow: "hidden",
        transition: "height .28s cubic-bezier(.16,1,.3,1)" }}>
        <div ref={inner} style={{ padding: "0 16px 16px" }}>{children}</div>
      </div>
    </div>
  );
}


// A segmented control whose highlight slides between items instead of blinking
// on and off. The pill is measured from the active child, so it fits whatever is
// inside — an icon, a long label, a count — without anything being hard-coded.
// Works vertically for the sidebar and horizontally for filter rows.
export function Segmented({ items, value, onChange, vertical = false, glass = false, style, size = "md" }) {
  const wrap = useRef(null);
  const [box, setBox] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const place = () => {
      const root = wrap.current;
      if (!root) return;
      const el = root.querySelector(`[data-seg="${String(value).replace(/"/g, "")}"]`);
      if (!el) { setBox(null); return; }
      const p = root.getBoundingClientRect(), r = el.getBoundingClientRect();
      setBox({ x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height });
    };
    place();
    // The row can wrap or the sidebar can scroll; keep the pill on its item.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    if (ro && wrap.current) ro.observe(wrap.current);
    window.addEventListener("resize", place);
    const t = setTimeout(() => setReady(true), 60);
    return () => { ro && ro.disconnect(); window.removeEventListener("resize", place); clearTimeout(t); };
  }, [value, items, vertical]);

  const pad = size === "sm" ? "7px 12px" : "9px 14px";
  const font = size === "sm" ? 12.5 : 13.5;

  return (
    <div ref={wrap} style={{ position: "relative", display: "flex", flexWrap: vertical ? "nowrap" : "wrap",
      flexDirection: vertical ? "column" : "row", gap: vertical ? 2 : 6, ...style }}>
      {box && (
        <span aria-hidden className={glass ? "seg-pill seg-glass" : "seg-pill"}
          style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h,
            borderRadius: 10, pointerEvents: "none",
            transition: ready ? "left .34s cubic-bezier(.34,1.4,.5,1), top .34s cubic-bezier(.34,1.4,.5,1), width .3s cubic-bezier(.34,1.4,.5,1), height .3s ease-out" : "none" }} />
      )}
      {items.map((it) => {
        const k = it.value ?? it;
        const on = k === value;
        return (
          <button key={k} type="button" data-seg={String(k)} onClick={() => onChange && onChange(k)}
            className="seg-item" aria-current={on ? "true" : undefined}
            style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 9,
              padding: pad, borderRadius: 10, border: "1px solid transparent", cursor: "pointer",
              background: "transparent", fontFamily: "inherit", fontSize: font,
              fontWeight: on ? 600 : 500, color: on ? (glass ? "#fff" : T.railTextOn) : T.railText,
              whiteSpace: "nowrap", justifyContent: vertical ? "flex-start" : "center",
              width: vertical ? "100%" : "auto", transition: "color .2s ease-out" }}>
            {it.icon && <i className={`ti ${it.icon}`} style={{ fontSize: 17, flexShrink: 0,
              color: "inherit", transition: "color .2s ease-out" }} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{it.label ?? it}</span>
            {it.badge != null && (
              <span style={{ marginLeft: "auto", background: on ? "rgba(255,255,255,.25)" : T.accGrad,
                color: "#fff", fontSize: 10.5, fontWeight: 700, minWidth: 18, height: 18,
                borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "0 5px" }}>{it.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
