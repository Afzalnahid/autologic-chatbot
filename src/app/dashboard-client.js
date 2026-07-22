"use client";
import { createClient as createSb } from "@/utils/supabase/client";
import { useState, useEffect, useRef, useCallback } from "react";

let _sbi=null;
let AUTH_TOKEN="";
let _sessionPromise=null;
function getSb(){ if(!_sbi) _sbi=createSb(); return _sbi; }

function getSessionOnce(){
  if(!_sessionPromise){
    _sessionPromise=getSb().auth.getSession().finally(()=>{ _sessionPromise=null; });
  }
  return _sessionPromise;
}

async function api(url,opts={}){
  try{
    const {data:{session}}=await getSessionOnce();
    if(session) AUTH_TOKEN=session.access_token;
  }catch{}
  let res=await fetch(url,{...opts,cache:"no-store",headers:{...(opts.headers||{}),"Cache-Control":"no-cache","Authorization":"Bearer "+AUTH_TOKEN}});
  if(res.status===401){
    try{
      const {data:{session}}=await getSb().auth.refreshSession();
      if(session){
        AUTH_TOKEN=session.access_token;
        res=await fetch(url,{...opts,cache:"no-store",headers:{...(opts.headers||{}),"Cache-Control":"no-cache","Authorization":"Bearer "+AUTH_TOKEN}});
      }
    }catch{}
  }
  return res;
}

const T = {
  bg: "#05080f", bgAlt: "#080e1a", card: "#0d1529",
  gold: "#f0c040", goldDim: "#c4982e", goldBg: "rgba(240,192,64,0.08)",
  text: "#e8e8ec", textMuted: "#8b9cbd", textDim: "#94a3b8",
  border: "#1a2744", danger: "#dc2626", success: "#22c55e", info: "#3b82f6", warn: "#f59e0b", purple: "#8b5cf6",
};
const PAGES = ["analytics","conversations","inventory","orders","channels","billing","settings","profile","demo"];
const ICONS = ["ti-chart-bar","ti-messages","ti-package","ti-shopping-cart","ti-plug","ti-credit-card","ti-settings","ti-user","ti-robot"];
const LABELS = ["Analytics","Conversations","Inventory","Orders","Channels","Billing","Settings","Profile","Demo"];
const ITEM_WORDS = { ecommerce:{item:"Product",inv:"Inventory",order:"Orders"}, agency:{item:"Service",inv:"Services",order:"Inquiries"}, other:{item:"Item",inv:"Catalog",order:"Requests"} };
function words(bt){ return ITEM_WORDS[bt] || ITEM_WORDS.other; }

function useIsMobile(){
  const [m,setM]=useState(false);
  useEffect(()=>{
    const check=()=>setM(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);
  return m;
}

function Btn({children,gold,danger,small,style,...p}){ return <button {...p} style={{padding:small?"6px 14px":"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:small?12:13,fontWeight:500,background:danger?T.danger:gold?T.gold:"rgba(240,192,64,0.12)",color:danger?"#fff":gold?"#0a0a0a":T.gold,...style}}>{children}</button>; }
function Badge({children,color=T.gold}){ return <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,background:`${color}18`,color}}>{children}</span>; }
function Card({children,style,...p}){ return <div {...p} style={{background:T.card,borderRadius:12,border:`0.5px solid ${T.border}`,padding:"1.25rem",...style}}>{children}</div>; }
function Inp({label,textarea,style,inputStyle,...p}){ return <div style={{marginBottom:16,...style}}>{label&&<label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{label}</label>}{textarea?<textarea {...p} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,resize:"vertical",minHeight:100,outline:"none",fontFamily:"inherit",boxSizing:"border-box",...inputStyle}}/>:<input {...p} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",...inputStyle}}/>}</div>; }
function StatCard({icon,label,value,sub,color=T.gold}){ return <Card style={{flex:1,minWidth:140}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:36,height:36,borderRadius:10,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`ti ${icon}`} style={{fontSize:18,color}}/></div><span style={{fontSize:12,color:T.textMuted,textTransform:"uppercase",letterSpacing:.8}}>{label}</span></div><div style={{fontSize:28,fontWeight:600,color:T.text}}>{value}</div>{sub&&<div style={{fontSize:12,color:T.textMuted,marginTop:4}}>{sub}</div>}</Card>; }
const PLAN_META={
  trial:{name:"Free Trial",color:T.info},
  starter:{name:"Starter",color:T.success},
  pro:{name:"Pro",color:T.gold},
  agency:{name:"Agency",color:T.purple},
  none:{name:"No plan",color:T.textDim},
};
const PLAN_LIST=[
  {id:"starter",name:"Starter",monthly:1500,yearly:15000,tagline:"For small shops getting started",
   features:["3,000 messages / month","1 channel","AI replies in Bangla & English","Product catalogue & orders","Analytics dashboard"]},
  {id:"pro",name:"Pro",monthly:3500,yearly:35000,highlight:true,tagline:"For growing businesses",
   features:["15,000 messages / month","All 3 channels","Photo product matching","Knowledge Base upload","Voice messages","Everything in Starter"]},
  {id:"agency",name:"Agency",monthly:6000,yearly:60000,tagline:"For service providers & agencies",
   features:["Unlimited messages","Google Calendar booking","Automatic Meet links","Priority support","Everything in Pro"]},
];
const taka=n=>"\u09F3"+Number(n||0).toLocaleString("en-IN");
const shortDate=d=>d?new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"—";

function Billing({initialPlan,initialCycle}) {
  const [d,setD]=useState(null);
  const [loading,setLoading]=useState(true);
  const [step,setStep]=useState(initialPlan?"pay":"plans");
  const [sel,setSel]=useState(initialPlan||null);
  const [cycle,setCycle]=useState(initialCycle==="yearly"?"yearly":"monthly");
  const [method,setMethod]=useState("");
  const [senderNo,setSenderNo]=useState("");
  const [txn,setTxn]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [copied,setCopied]=useState("");

  const load=useCallback(async()=>{
    try{
      const r=await api(`/api/billing?t=${Date.now()}`,{cache:"no-store"});
      const j=await r.json();
      if(!j.error){setD(j); if(j.methods?.length&&!method) setMethod(j.methods[0].id);}
    }catch{}
    setLoading(false);
  },[method]);
  useEffect(()=>{load();},[]);

  const submit=async()=>{
    if(busy) return;
    if(!txn.trim()){setErr("Enter the transaction ID from your payment receipt");return;}
    setBusy(true);setErr("");
    try{
      const r=await api("/api/billing",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({plan:sel,cycle,method,sender_number:senderNo,txn_id:txn})});
      const j=await r.json();
      if(j.error){setErr(j.error);}
      else{setTxn("");setSenderNo("");setStep("plans");await load();}
    }catch{setErr("Could not submit. Please try again.");}
    setBusy(false);
  };

  const copy=async(t,id)=>{
    try{await navigator.clipboard.writeText(t);setCopied(id);setTimeout(()=>setCopied(""),1500);}catch{}
  };

  if(loading) return <div style={{padding:40,textAlign:"center",color:T.textMuted,fontSize:13}}>Loading billing...</div>;
  if(!d) return <Card style={{textAlign:"center",color:T.textDim,padding:40}}>Could not load billing information.</Card>;

  const meta=PLAN_META[d.plan]||PLAN_META.none;
  const u=d.usage;
  const limit=u.daily_limit||u.monthly_limit;
  const usedNow=u.daily_limit?u.today:u.month;
  const expiry=d.plan==="trial"?d.trial_end:d.plan_expires_at;
  const daysLeft=expiry?Math.ceil((new Date(expiry)-new Date())/86400000):null;
  const selPlan=PLAN_LIST.find(p=>p.id===sel);
  const amount=selPlan?(cycle==="yearly"?selPlan.yearly:selPlan.monthly):0;

  return <div style={{maxWidth:900}}>
    {/* Current plan */}
    <Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:11.5,color:T.textMuted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Current plan</div>
          <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
            <span style={{fontSize:22,fontWeight:700}}>{d.plan_name}</span>
            <Badge color={d.suspended?T.danger:d.active?T.success:T.danger}>{d.suspended?"Suspended":d.active?"Active":"Expired"}</Badge>
          </div>
          {expiry&&<div style={{fontSize:12.5,color:daysLeft!==null&&daysLeft<=3?T.warn:T.textMuted,marginTop:6}}>
            {d.active?`Valid until ${shortDate(expiry)}${daysLeft!==null?` · ${daysLeft} day${daysLeft===1?"":"s"} left`:""}`:`Expired on ${shortDate(expiry)}`}
          </div>}
        </div>
        {step!=="pay"&&<Btn gold onClick={()=>{setSel("pro");setStep("pay");}}>
          <i className="ti ti-arrow-up-circle" style={{marginRight:6}}/>{d.plan==="none"||!d.active?"Choose a plan":"Upgrade"}
        </Btn>}
      </div>

      {limit&&<div style={{marginTop:18}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:6}}>
          <span style={{color:T.textMuted}}>{u.daily_limit?"Messages today":"Messages this month"}</span>
          <span><strong>{usedNow}</strong> <span style={{color:T.textDim}}>/ {limit.toLocaleString("en-IN")}</span></span>
        </div>
        <div style={{height:6,background:T.bgAlt,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(100,u.pct||0)}%`,background:(u.pct||0)>90?T.danger:(u.pct||0)>70?T.warn:T.success,borderRadius:3}}/>
        </div>
        {(u.pct||0)>=90&&<div style={{fontSize:11.5,color:T.warn,marginTop:8}}>
          <i className="ti ti-alert-triangle" style={{marginRight:5}}/>You are close to your limit. Upgrade to keep the bot replying.
        </div>}
      </div>}
      {!limit&&d.active&&<div style={{fontSize:12.5,color:T.success,marginTop:14}}><i className="ti ti-infinity" style={{marginRight:5}}/>Unlimited messages on this plan</div>}
    </Card>

    {/* Pending review */}
    {d.pending_request&&<Card style={{marginBottom:16,border:`1px solid ${T.warn}44`}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        <i className="ti ti-clock-hour-4" style={{fontSize:20,color:T.warn,marginTop:2}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Payment under review</div>
          <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7}}>
            We received your {taka(d.pending_request.amount)} payment for the <strong style={{color:T.text}}>{PLAN_META[d.pending_request.plan]?.name||d.pending_request.plan}</strong> plan
            (transaction <strong style={{color:T.text}}>{d.pending_request.txn_id}</strong>).
            We usually verify within a few hours and your plan activates automatically.
          </div>
        </div>
      </div>
    </Card>}

    {/* Payment step */}
    {step==="pay"&&<Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:10}}>
        <div style={{fontSize:15,fontWeight:600}}>Upgrade your plan</div>
        <button onClick={()=>{setStep("plans");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:18}}><i className="ti ti-x"/></button>
      </div>

      {/* plan picker */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:16}}>
        {PLAN_LIST.map(p=><div key={p.id} onClick={()=>setSel(p.id)} style={{
          cursor:"pointer",padding:"14px 14px",borderRadius:11,background:T.bgAlt,
          border:`1px solid ${sel===p.id?T.gold:T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:14,fontWeight:600}}>{p.name}</span>
            {p.highlight&&<Badge>Popular</Badge>}
          </div>
          <div style={{fontSize:19,fontWeight:700,marginTop:6}}>{taka(cycle==="yearly"?p.yearly:p.monthly)}
            <span style={{fontSize:11.5,color:T.textMuted,fontWeight:400}}>/{cycle==="yearly"?"yr":"mo"}</span></div>
          <div style={{fontSize:11.5,color:T.textMuted,marginTop:3}}>{p.tagline}</div>
        </div>)}
      </div>

      <div style={{display:"inline-flex",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:9,padding:3,gap:3,marginBottom:18}}>
        {[["monthly","Monthly"],["yearly","Yearly · 2 months free"]].map(([id,l])=>
          <button key={id} onClick={()=>setCycle(id)} style={{padding:"7px 14px",borderRadius:7,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:600,
            background:cycle===id?T.gold:"transparent",color:cycle===id?"#0a0a0a":T.textMuted}}>{l}</button>)}
      </div>

      {/* how to pay */}
      {d.methods.length===0
        ? <div style={{fontSize:13,color:T.warn,background:`${T.warn}12`,border:`1px solid ${T.warn}33`,borderRadius:10,padding:"14px 16px"}}>
            <i className="ti ti-alert-circle" style={{marginRight:6}}/>Payment numbers are not configured yet. Please contact support at nahidafzal97@gmail.com to complete your upgrade.
          </div>
        : <>
          <div style={{background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:11,padding:"16px 16px",marginBottom:16}}>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:4}}>Send exactly</div>
            <div style={{fontSize:28,fontWeight:800,color:T.gold,marginBottom:14}}>{taka(amount)}</div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:9}}>to any of these numbers (Send Money)</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>
              {d.methods.map(m=><div key={m.id} onClick={()=>setMethod(m.id)} style={{
                cursor:"pointer",padding:"11px 13px",borderRadius:9,background:T.card,
                border:`1px solid ${method===m.id?T.gold:T.border}`,display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,color:T.textMuted}}>{m.label} · {m.type}</div>
                  <div style={{fontSize:15,fontWeight:600,letterSpacing:.3}}>{m.number}</div>
                </div>
                <button onClick={e=>{e.stopPropagation();copy(m.number,m.id);}} title="Copy number"
                  style={{background:"none",border:"none",cursor:"pointer",color:copied===m.id?T.success:T.textMuted,fontSize:16,flexShrink:0}}>
                  <i className={`ti ${copied===m.id?"ti-check":"ti-copy"}`}/>
                </button>
              </div>)}
            </div>
          </div>

          <div style={{fontSize:12.5,color:T.textMuted,marginBottom:14,lineHeight:1.7}}>
            After sending the money, enter the transaction ID from your payment app below. We verify it and activate your plan — usually within a few hours.
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
            <Inp label="Your number (optional)" value={senderNo} onChange={e=>setSenderNo(e.target.value)} placeholder="01XXXXXXXXX"/>
            <Inp label="Transaction ID *" value={txn} onChange={e=>setTxn(e.target.value)} placeholder="e.g. 9A7B2C1D5E"/>
          </div>
          {err&&<div style={{fontSize:12.5,color:T.danger,marginBottom:10}}>{err}</div>}
          <Btn gold onClick={submit} disabled={busy} style={{width:"100%"}}>
            {busy?"Submitting...":`Submit payment · ${taka(amount)}`}
          </Btn>
        </>}
    </Card>}

    {/* Plan cards */}
    {step==="plans"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14,marginBottom:16}}>
      {PLAN_LIST.map(p=><Card key={p.id} style={{border:p.highlight?`1px solid ${T.gold}55`:undefined,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:16,fontWeight:600}}>{p.name}</span>
          {d.plan===p.id?<Badge color={T.success}>Current</Badge>:p.highlight?<Badge>Popular</Badge>:null}
        </div>
        <div style={{fontSize:24,fontWeight:700,margin:"10px 0 2px"}}>{taka(p.monthly)}<span style={{fontSize:12,color:T.textMuted,fontWeight:400}}>/month</span></div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:12}}>or {taka(p.yearly)}/year</div>
        <ul style={{listStyle:"none",padding:0,margin:"0 0 16px",display:"flex",flexDirection:"column",gap:7,flex:1}}>
          {p.features.map((f,i)=><li key={i} style={{fontSize:12.3,color:T.textMuted,display:"flex",gap:7,lineHeight:1.5}}>
            <span style={{color:T.success,flexShrink:0}}>✓</span><span>{f}</span></li>)}
        </ul>
        <Btn gold={p.highlight} onClick={()=>{setSel(p.id);setStep("pay");}} style={{width:"100%"}} disabled={!!d.pending_request}>
          {d.plan===p.id?"Renew":"Choose "+p.name}
        </Btn>
      </Card>)}
    </div>}

    {/* History */}
    {d.requests.length>0&&<Card>
      <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>Payment history</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",minWidth:460,borderCollapse:"collapse",fontSize:12.5}}>
          <thead><tr style={{color:T.textMuted,fontSize:11,textTransform:"uppercase",letterSpacing:.6}}>
            <th style={{textAlign:"left",padding:"0 0 9px"}}>Date</th>
            <th style={{textAlign:"left",padding:"0 0 9px"}}>Plan</th>
            <th style={{textAlign:"left",padding:"0 0 9px"}}>Amount</th>
            <th style={{textAlign:"left",padding:"0 0 9px"}}>Transaction</th>
            <th style={{textAlign:"right",padding:"0 0 9px"}}>Status</th>
          </tr></thead>
          <tbody>{d.requests.map(r=><tr key={r.id} style={{borderTop:`0.5px solid ${T.border}`}}>
            <td style={{padding:"10px 0",color:T.textMuted}}>{shortDate(r.created_at)}</td>
            <td style={{padding:"10px 0"}}>{PLAN_META[r.plan]?.name||r.plan}<span style={{color:T.textDim,fontSize:11}}> · {r.billing_cycle}</span></td>
            <td style={{padding:"10px 0"}}>{taka(r.amount)}</td>
            <td style={{padding:"10px 0",color:T.textMuted,fontFamily:"monospace",fontSize:11.5}}>{r.txn_id}</td>
            <td style={{padding:"10px 0",textAlign:"right"}}>
              <Badge color={r.status==="approved"?T.success:r.status==="rejected"?T.danger:T.warn}>{r.status}</Badge>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {d.requests.some(r=>r.status==="rejected"&&r.admin_note)&&
        <div style={{fontSize:12,color:T.textMuted,marginTop:12,paddingTop:12,borderTop:`0.5px solid ${T.border}`}}>
          <i className="ti ti-info-circle" style={{marginRight:5}}/>
          {d.requests.find(r=>r.status==="rejected"&&r.admin_note)?.admin_note}
        </div>}
    </Card>}
  </div>;
}

const fmtNum=n=>{const v=Number(n)||0;if(Math.abs(v)>=1e6)return (v/1e6).toFixed(v%1e6===0?0:1)+"M";if(Math.abs(v)>=1000)return (v/1000).toFixed(v%1000===0?0:1)+"K";return String(v);};
const fmtMoney=n=>"\u09F3"+(Number(n)||0).toLocaleString("en-IN");

function Trend({value,unit="%",invert}) {
  if(value===null||value===undefined) return <span style={{fontSize:11,color:T.textDim}}>new</span>;
  const up=value>0, flat=value===0;
  const good=invert?!up:up;
  const color=flat?T.textDim:good?T.success:T.danger;
  return <span style={{fontSize:11,color,fontWeight:600,display:"inline-flex",alignItems:"center",gap:2}}>
    {!flat&&<i className={`ti ti-${up?"arrow-up-right":"arrow-down-right"}`} style={{fontSize:12}}/>}
    {flat?"0":`${Math.abs(value)}`}{unit}
  </span>;
}

function KStat({icon,label,value,sub,color=T.gold,trend,trendUnit,invert}) {
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

function Spark({data,keys,colors,height=120,labels}) {
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

function BarList({items,color=T.gold,empty,money}) {
  if(!items?.length) return <div style={{fontSize:12.5,color:T.textDim}}>{empty}</div>;
  const max=Math.max(1,...items.map(i=>i.count));
  return items.map((it,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
    <span style={{fontSize:12.5,width:112,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={it.name||it.term}>{it.name||it.term}</span>
    <div style={{flex:1,height:5,background:T.bgAlt,borderRadius:3}}><div style={{height:"100%",width:`${(it.count/max)*100}%`,background:color,borderRadius:3}}/></div>
    <span style={{fontSize:12,fontWeight:500,minWidth:22,textAlign:"right",color:T.textMuted}}>{money?fmtMoney(it.count):it.count}</span>
  </div>);
}

function Analytics({isAgency}) {
  const [days,setDays]=useState(30);
  const [d,setD]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");

  const load=useCallback(async(silent)=>{
    if(!silent) setLoading(true);
    try{
      const res=await api(`/api/analytics?days=${days}&t=${Date.now()}`,{cache:"no-store"});
      const j=await res.json();
      if(j.error) setErr(j.error); else {setD(j);setErr("");}
    }catch{setErr("Could not load analytics");}
    setLoading(false);
  },[days]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{const t=setInterval(()=>load(true),60000);return()=>clearInterval(t);},[load]);

  if(loading&&!d) return <div style={{padding:40,textAlign:"center",color:T.textMuted,fontSize:13}}>Loading analytics...</div>;
  if(err&&!d) return <Card style={{textAlign:"center",color:T.textDim,padding:40}}>{err}</Card>;
  if(!d) return null;

  const k=d.kpi, g=d.growth, c=d.conversations;
  const fmtDay=s=>{const p=String(s).split("-");return `${p[2]}/${p[1]}`;};
  const first=d.daily[0]?.date, last=d.daily[d.daily.length-1]?.date;
  const noData=k.total_messages===0;
  const PICON={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp"};
  const PNAME={facebook:"Facebook",instagram:"Instagram",whatsapp:"WhatsApp"};
  const PCOLOR={facebook:"#3b82f6",instagram:"#e1306c",whatsapp:"#25d366"};
  const maxCh=Math.max(1,...d.channels.map(x=>x.total));
  const maxHr=Math.max(1,...d.hours.map(h=>h.count));
  const hourLabel=h=>{const a=h<12?"AM":"PM";const hh=h%12===0?12:h%12;return `${hh}${a}`;};
  const totalCust=k.unique_contacts||0;
  const newPct=totalCust?Math.round((k.new_contacts/totalCust)*100):0;
  const SCOLOR={Pending:T.warn,Shipped:T.info,Delivered:T.success,Cancelled:T.danger,confirmed:T.success};

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
      {[7,30,90].map(n=><button key={n} onClick={()=>setDays(n)} style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:500,background:days===n?T.gold:T.card,color:days===n?"#0a0a0a":T.textMuted}}>{n} days</button>)}
      <span style={{fontSize:11,color:T.textDim,marginLeft:"auto"}}>vs previous {days} days · updated {new Date(d.generated_at).toLocaleTimeString()}</span>
    </div>

    {noData&&<Card style={{marginBottom:18,textAlign:"center",padding:"28px 20px"}}>
      <i className="ti ti-chart-line" style={{fontSize:30,color:T.textDim}}/>
      <div style={{fontSize:14,fontWeight:500,marginTop:10}}>No activity in this period</div>
      <div style={{fontSize:12.5,color:T.textMuted,marginTop:5}}>Connect a channel and start receiving customer messages — your analytics will appear here.</div>
    </Card>}

    {/* KPI row */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(158px,1fr))",gap:12,marginBottom:16}}>
      <KStat icon="ti-messages" label="Messages" value={fmtNum(k.total_messages)} sub={`${k.messages_today} today`} color={T.info} trend={g.messages}/>
      <KStat icon="ti-users" label="Customers" value={fmtNum(k.unique_contacts)} sub={`${k.new_contacts} new · ${k.returning_contacts} returning`} color={T.success} trend={g.contacts}/>
      <KStat icon="ti-message-2" label="Conversations" value={fmtNum(c.total)} sub={`${c.avg_messages} msgs each`} color={T.purple} trend={g.conversations}/>
      <KStat icon="ti-robot" label="Bot resolved" value={c.bot_resolved_pct===null?"—":`${c.bot_resolved_pct}%`} sub={`${c.handoff} needed a human`} color={T.gold} trend={g.bot_handled_points} trendUnit="pp"/>
      {isAgency
        ? <KStat icon="ti-calendar-event" label="Bookings" value={fmtNum(k.bookings)} sub={k.conversion_pct===null?"no data":`${k.conversion_pct}% of customers`} color={T.gold} trend={g.conversions}/>
        : <KStat icon="ti-cash" label="Revenue" value={fmtMoney(k.revenue)} sub={`${k.orders} orders · avg ${fmtMoney(k.avg_order_value)}`} color={T.gold} trend={g.revenue}/>}
    </div>

    {/* Volume */}
    <Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:500}}>Message volume</div>
        <div style={{display:"flex",gap:14,fontSize:11.5,color:T.textMuted}}>
          <span><span style={{display:"inline-block",width:9,height:2.5,background:T.gold,marginRight:5,verticalAlign:"middle"}}/>Customers ({fmtNum(k.customer_messages)})</span>
          <span><span style={{display:"inline-block",width:9,height:2.5,background:T.info,marginRight:5,verticalAlign:"middle"}}/>Bot ({fmtNum(k.bot_messages)})</span>
        </div>
      </div>
      <Spark data={d.daily} keys={["customer","bot"]} colors={[T.gold,T.info]} labels={[fmtDay(first),fmtDay(last)]}/>
    </Card>

    {/* Conversation health + customer mix */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Conversation health</div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:16}}>How well the bot is handling customers on its own</div>
        {[
          {label:"Handled by bot alone",value:c.bot_resolved,color:T.success},
          {label:"Needed a human agent",value:c.handoff,color:T.warn},
          {label:"Never answered",value:c.unanswered,color:T.danger},
        ].map((r,i)=>{const pct=c.total?Math.round((r.value/c.total)*100):0;return <div key={i} style={{marginBottom:13}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:5}}>
            <span style={{color:T.textMuted}}>{r.label}</span>
            <span><strong style={{color:T.text}}>{r.value}</strong> <span style={{color:T.textDim,fontSize:11}}>({pct}%)</span></span>
          </div>
          <div style={{height:5,background:T.bgAlt,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:r.color,borderRadius:3}}/></div>
        </div>;})}
        {c.unanswered>0&&<div style={{fontSize:11.5,color:T.warn,marginTop:12,display:"flex",gap:6,alignItems:"flex-start"}}>
          <i className="ti ti-alert-triangle" style={{fontSize:13,marginTop:1}}/>
          <span>{c.unanswered} conversation{c.unanswered>1?"s":""} got no reply — check that your channel is connected and the bot is not paused.</span>
        </div>}
      </Card>

      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Customer mix</div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:16}}>New people vs people who came back</div>
        <div style={{display:"flex",height:9,borderRadius:5,overflow:"hidden",background:T.bgAlt,marginBottom:14}}>
          <div style={{width:`${newPct}%`,background:T.gold}}/>
          <div style={{width:`${100-newPct}%`,background:T.info}}/>
        </div>
        <div style={{display:"flex",gap:16}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11.5,color:T.textMuted,marginBottom:3}}><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:T.gold,marginRight:6}}/>New</div>
            <div style={{fontSize:20,fontWeight:600}}>{k.new_contacts}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11.5,color:T.textMuted,marginBottom:3}}><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:T.info,marginRight:6}}/>Returning</div>
            <div style={{fontSize:20,fontWeight:600}}>{k.returning_contacts}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:16,paddingTop:14,borderTop:`0.5px solid ${T.border}`}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}><i className="ti ti-photo" style={{marginRight:4}}/>Photos received</div>
            <div style={{fontSize:16,fontWeight:600}}>{k.image_messages}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}><i className="ti ti-microphone" style={{marginRight:4}}/>Voice messages</div>
            <div style={{fontSize:16,fontWeight:600}}>{k.voice_messages}</div>
          </div>
        </div>
      </Card>
    </div>

    {/* Channels + hours */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>Channels</div>
        {d.channels.length?d.channels.map(ch=><div key={ch.platform} style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <i className={`ti ${PICON[ch.platform]||"ti-message"}`} style={{fontSize:15,color:PCOLOR[ch.platform]||T.textMuted}}/>
            <span style={{fontSize:13,flex:1}}>{PNAME[ch.platform]||ch.platform}</span>
            <span style={{fontSize:11.5,color:T.textMuted}}>{ch.contacts||0} customers</span>
            <span style={{fontSize:13,fontWeight:600,minWidth:30,textAlign:"right"}}>{fmtNum(ch.total)}</span>
          </div>
          <div style={{height:5,background:T.bgAlt,borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${(ch.total/maxCh)*100}%`,background:PCOLOR[ch.platform]||T.gold,borderRadius:3}}/>
          </div>
        </div>):<div style={{fontSize:12.5,color:T.textDim}}>No channel activity yet</div>}
      </Card>

      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4,gap:8}}>
          <div style={{fontSize:14,fontWeight:500}}>When customers message</div>
          {k.peak_hour!==null&&<span style={{fontSize:11.5,color:T.gold}}>peak {hourLabel(k.peak_hour)}</span>}
        </div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:14}}>Bangladesh time — plan your team around this</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:2,height:88}}>
          {d.hours.map(h=><div key={h.hour} title={`${hourLabel(h.hour)} — ${h.count}`} style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",height:"100%"}}>
            <div style={{height:`${Math.max(h.count?8:2,(h.count/maxHr)*100)}%`,background:h.hour===k.peak_hour?T.gold:T.info,opacity:h.count?1:0.25,borderRadius:2}}/>
          </div>)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.textDim,marginTop:6}}>
          <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
        </div>
      </Card>
    </div>

    {/* Queries + business-specific */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>What customers ask about</div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:14}}>Most frequent words in customer messages</div>
        <BarList items={d.top_queries} empty="Not enough customer messages yet"/>
      </Card>

      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>{isAgency?"Most requested services":"Best selling products"}</div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:14}}>{isAgency?"From confirmed bookings":"From confirmed orders"}</div>
        <BarList items={isAgency?d.top_services:d.top_products} color={T.success}
          empty={isAgency?"No bookings in this period":"No orders in this period"}/>
      </Card>
    </div>

    {/* Conversions over time + status */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14,gap:8}}>
          <div style={{fontSize:14,fontWeight:500}}>{isAgency?"Bookings":"Orders"} over time</div>
          {k.conversion_pct!==null&&<span style={{fontSize:11.5,color:T.textMuted}}>{k.conversion_pct}% conversion</span>}
        </div>
        <Spark data={d.conversions_daily} keys={[isAgency?"bookings":"orders"]} colors={[T.success]} height={92} labels={[fmtDay(first),fmtDay(last)]}/>
      </Card>

      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>{isAgency?"Booking summary":"Order status"}</div>
        {isAgency
          ? <div style={{display:"flex",gap:16}}>
              <div style={{flex:1}}><div style={{fontSize:11.5,color:T.textMuted,marginBottom:4}}>Total bookings</div><div style={{fontSize:22,fontWeight:600}}>{k.bookings}</div></div>
              <div style={{flex:1}}><div style={{fontSize:11.5,color:T.textMuted,marginBottom:4}}>Previous period</div><div style={{fontSize:22,fontWeight:600,color:T.textMuted}}>{g.previous.conversions}</div></div>
            </div>
          : d.order_status.length
            ? d.order_status.map(s=><div key={s.status} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <Badge color={SCOLOR[s.status]||T.textMuted}>{s.status}</Badge>
                <div style={{flex:1,height:5,background:T.bgAlt,borderRadius:3}}><div style={{height:"100%",width:`${(s.count/Math.max(1,k.orders))*100}%`,background:SCOLOR[s.status]||T.textMuted,borderRadius:3}}/></div>
                <span style={{fontSize:13,fontWeight:600,minWidth:22,textAlign:"right"}}>{s.count}</span>
              </div>)
            : <div style={{fontSize:12.5,color:T.textDim}}>No orders in this period</div>}
      </Card>
    </div>
  </div>;
}

function Conversations({convos:allConvos,refresh,onChatOpen,channels=[]}) {
  const [chFilter,setChFilter]=useState("all");
  const convos=chFilter==="all"?allConvos:allConvos.filter(c=>(c.platform||"facebook")===chFilter);
  const PICON={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp"};
  const avail=[...new Set([...channels.map(c=>c.platform),...allConvos.map(c=>c.platform||"facebook")].filter(Boolean))];
  const isMobile=useIsMobile();
  const [sel,setSel]=useState(-1);
  useEffect(()=>{onChatOpen&&onChatOpen(isMobile&&sel>=0);},[sel,isMobile]);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [contacts,setContacts]=useState({});
  const [globalBot,setGlobalBot]=useState(true);
  const chatRef=useRef(null);
  const galleryRef=useRef(null);
  const cameraRef=useRef(null);
  const [showEmoji,setShowEmoji]=useState(false);
  const [recording,setRecording]=useState(false);
  const recRef=useRef(null);
  const EMOJIS=["😀","😂","❤️","👍","🙏","😍","🔥","🎉","😢","😮","💯","✅"];

  const sendMedia=async(file,kind)=>{
    if(!file) return;
    setSending(true);
    const fd=new FormData();
    fd.append("sender_id",c.id);
    fd.append("kind",kind);
    fd.append("file",file);
    const r=await api("/api/send-media",{method:"POST",body:fd}).then(r=>r.json()).catch(()=>({error:"network"}));
    setSending(false);
    if(r.error) alert("Send failed: "+r.error);
    else refresh&&refresh(true);
  };

  const toggleRec=async()=>{
    if(recording){recRef.current?.stop();return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=MediaRecorder.isTypeSupported("audio/mp4")?"audio/mp4":"audio/webm";
      const rec=new MediaRecorder(stream,{mimeType:mime});
      const chunks=[];
      rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());
        setRecording(false);
        const ext=mime.includes("mp4")?"mp4":"webm";
        sendMedia(new File(chunks,`voice.${ext}`,{type:mime}),"audio");
      };
      recRef.current=rec;
      rec.start();
      setRecording(true);
    }catch{alert("Microphone access denied");}
  };

  const deleteChat=async()=>{
    if(!confirm(`Delete chat with ${cname}?`)) return;
    await api("/api/conversations",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_id:c.id})});
    setSel(-1);
    refresh&&refresh(true);
  };

  const loadContacts=async()=>{
    try{
      const d=await api("/api/contacts").then(r=>r.json());
      if(d.contacts) setContacts(Object.fromEntries(d.contacts.map(c=>[c.sender_id,c])));
      if(typeof d.global_bot_enabled==="boolean") setGlobalBot(d.global_bot_enabled);
    }catch{}
  };
  useEffect(()=>{loadContacts();},[]);
  useEffect(()=>{
    const ch=getSb().channel("mb").on("broadcast",{event:"insert"},()=>{refresh&&refresh(true);loadContacts();}).subscribe();
    const t=setInterval(()=>{refresh&&refresh(true);loadContacts();},45000);
    return ()=>{getSb().removeChannel(ch);clearInterval(t);};
  },[refresh]);
  useEffect(()=>{chatRef.current?.scrollTo(0,chatRef.current.scrollHeight);},[convos,sel]);

  const toggle=async(sender_id,val,isGlobal)=>{
    if(isGlobal) setGlobalBot(val);
    else setContacts(p=>({...p,[sender_id]:{...p[sender_id],sender_id,bot_enabled:val}}));
    await api("/api/contacts",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(isGlobal?{global:true,bot_enabled:val}:{sender_id,bot_enabled:val})});
  };

  if(!convos.length) return <Card style={{textAlign:"center",color:T.textDim,padding:60}}>No conversations yet</Card>;
  const idx=sel<0?0:sel;
  const c=convos[idx]||convos[0];
  const ct=contacts[c.id]||{};
  const cname=ct.name||c.sender;
  const showList=!isMobile||sel<0;
  const showChat=!isMobile||sel>=0;

  const send=async()=>{
    const text=input.trim();
    if(!text||sending) return;
    setSending(true); setInput("");
    const r=await api("/api/send-message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_id:c.id,text})}).then(r=>r.json()).catch(()=>({error:"network"}));
    setSending(false);
    if(r.error) alert("Send failed: "+r.error);
    else refresh&&refresh(true);
  };

  const Toggle=({on,onClick,label})=><div onClick={onClick} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} title={label}>
    <div style={{width:32,height:18,borderRadius:10,background:on?T.success:T.textDim,position:"relative",transition:"background .2s"}}>
      <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:on?16:2,transition:"left .2s"}}/>
    </div>
    <span style={{fontSize:11,color:T.textMuted}}>{label}</span>
  </div>;

  return <div style={{display:isMobile?"block":"grid",gridTemplateColumns:"320px 1fr",gap:16,height:isMobile?(sel>=0?"100dvh":"calc(100dvh - 190px)"):"calc(100vh - 130px)"}}>
    {showList&&<Card style={{overflow:"auto",padding:0,height:"100%"}}>
      <div style={{padding:"12px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:500,color:T.textMuted}}>CHATS</span>
        <Toggle on={globalBot} onClick={()=>toggle(null,!globalBot,true)} label={globalBot?"Bot ON":"Bot OFF"}/>
      </div>
      {avail.length>1&&<div style={{display:"flex",gap:6,padding:"0 4px 10px"}}>
        {["all",...avail].map(f=><div key={f} onClick={()=>{setChFilter(f);}} style={{padding:"5px 12px",borderRadius:14,fontSize:11.5,cursor:"pointer",textTransform:"capitalize",background:chFilter===f?T.goldBg:T.bgAlt,color:chFilter===f?T.gold:T.textMuted,border:`0.5px solid ${chFilter===f?T.gold+"50":T.border}`}}>{f}</div>)}
      </div>}
      {convos.map((cv,i)=>{
        const cvt=contacts[cv.id]||{};
        return <div key={cv.id} onClick={()=>setSel(i)} style={{padding:"14px 16px",cursor:"pointer",borderBottom:`0.5px solid ${T.border}`,background:sel===i?T.goldBg:"transparent",borderLeft:sel===i?`3px solid ${T.gold}`:"3px solid transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:500}}>{cvt.name||cv.sender}</span>
            <Badge color={cvt.bot_enabled===false?T.warn:T.success}>{cvt.bot_enabled===false?"manual":"bot"}</Badge>
          </div>
          <span style={{fontSize:12,color:T.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{cv.lastMsg}</span>
        </div>;
      })}
    </Card>}
    {showChat&&<Card style={{display:"flex",flexDirection:"column",padding:0,overflow:"hidden",height:"100%"}}>
      <div style={{padding:"14px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          {isMobile&&<button onClick={()=>setSel(-1)} style={{background:"none",border:"none",cursor:"pointer",color:T.gold,fontSize:20,padding:0,flexShrink:0}}><i className="ti ti-chevron-left"/></button>}
          <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cname}</div><div style={{fontSize:12,color:T.textMuted,display:"flex",alignItems:"center",gap:4}}><i className={`ti ${PICON[c.platform]||"ti-message"}`} style={{fontSize:13}}/>{c.platform}</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Toggle on={ct.bot_enabled!==false} onClick={()=>toggle(c.id,ct.bot_enabled===false,false)} label={ct.bot_enabled===false?"Bot OFF (manual)":"Bot ON"}/>
          <button onClick={deleteChat} title="Delete chat" style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:18,padding:4}}><i className="ti ti-trash"/></button>
        </div>
      </div>
      <div ref={chatRef} style={{flex:1,overflow:"auto",padding:20,display:"flex",flexDirection:"column",gap:12}}>
        {(c.messages||[]).map((m,i)=>{
          const mine=m.role!=="customer";
          return <div key={i} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start"}}>
          <div style={{maxWidth:"70%"}}>
            {(m.attachments||[]).length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:4,alignItems:mine?"flex-end":"flex-start"}}>
              {m.attachments.map((u,j)=><img key={j} src={u} alt="" style={{maxWidth:220,borderRadius:16,display:"block"}} onError={e=>{e.target.style.display="none"}}/>)}
            </div>}
            {(!(m.attachments||[]).length||(m.text&&m.text!=="📷 Photo"))&&<div style={{padding:"9px 14px",borderRadius:18,fontSize:13.5,lineHeight:1.45,whiteSpace:"pre-wrap",color:mine?"#fff":T.text,background:mine?"#0084ff":T.bgAlt,borderBottomRightRadius:mine?6:18,borderBottomLeftRadius:mine?18:6}}>{m.text}</div>}
            {mine&&m.role==="agent"&&<div style={{fontSize:10,color:T.textDim,marginTop:2,textAlign:"right"}}>You</div>}
          </div>
        </div>;})}
      </div>
      <div style={{borderTop:`0.5px solid ${T.border}`,position:"relative"}}>
        {showEmoji&&<div style={{position:"absolute",bottom:"100%",right:12,background:T.card,border:`0.5px solid ${T.border}`,borderRadius:12,padding:8,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,zIndex:5}}>
          {EMOJIS.map(e=><span key={e} onClick={()=>{setInput(p=>p+e);setShowEmoji(false);}} style={{fontSize:20,cursor:"pointer",padding:4}}>{e}</span>)}
        </div>}
        <div style={{padding:"10px 8px",display:"flex",gap:2,alignItems:"center"}}>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e=>{sendMedia(e.target.files[0],"image");e.target.value="";}}/>
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={e=>{sendMedia(e.target.files[0],"image");e.target.value="";}}/>
          <button onClick={()=>cameraRef.current?.click()} title="Camera" style={{background:"none",border:"none",cursor:"pointer",color:"#0084ff",fontSize:19,padding:"4px 3px",flexShrink:0}}><i className="ti ti-camera"/></button>
          <button onClick={()=>galleryRef.current?.click()} title="Photo" style={{background:"none",border:"none",cursor:"pointer",color:"#0084ff",fontSize:19,padding:"4px 3px",flexShrink:0}}><i className="ti ti-photo"/></button>
          <button onClick={toggleRec} title="Voice" style={{background:"none",border:"none",cursor:"pointer",color:recording?T.danger:"#0084ff",fontSize:19,padding:"4px 3px",flexShrink:0,animation:recording?"pulse 1s infinite":"none"}}><i className={`ti ${recording?"ti-player-stop-filled":"ti-microphone"}`}/></button>
          <div style={{flex:1,display:"flex",alignItems:"center",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:20,padding:"0 4px 0 12px",minWidth:0}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message" style={{flex:1,background:"none",border:"none",padding:"10px 0",color:T.text,fontSize:13,outline:"none",minWidth:0}}/>
            <button onClick={()=>setShowEmoji(s=>!s)} title="Emoji" style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"4px 2px",flexShrink:0}}>😊</button>
          </div>
          <button onClick={send} disabled={sending} style={{width:34,height:34,borderRadius:"50%",border:"none",cursor:"pointer",background:"#0084ff",display:"flex",alignItems:"center",justifyContent:"center",opacity:sending?.6:1,flexShrink:0}}><i className="ti ti-send" style={{fontSize:16,color:"#fff"}}/></button>
        </div>
      </div>
    </Card>}
  </div>;
}

function Inventory({products,refresh}) {
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [imgFile,setImgFile]=useState(null);
  const addFileRef=useRef(null);
  const add=async()=>{
    if(!np.product_name||adding) return;
    setAdding(true);
    const fd=new FormData();
    fd.append("product_code",np.product_id||"");
    fd.append("product_name",np.product_name);
    fd.append("category",np.category||"");
    fd.append("regular_price",np.regular_price||"");
    fd.append("sale_price",np.sale_price||"");
    fd.append("description",np.description||"");
    if(imgFile) fd.append("image",imgFile);
    else if(np.image_url) fd.append("image_url",np.image_url);
    const r=await api("/api/add-product",{method:"POST",body:fd}).then(r=>r.json()).catch(()=>({error:"network"}));
    setAdding(false);
    if(r.error){setUrlMsg("Failed: "+r.error);return;}
    setNp({product_id:"",product_name:"",category:"",regular_price:"",sale_price:"",image_url:"",description:""});
    setImgFile(null); if(addFileRef.current) addFileRef.current.value="";
    setUrlMsg(r.analyzed?"Product added and image analyzed":r.image_url?("Product added but image analysis failed"+(r.analyzeError?": "+r.analyzeError:"")):"Product added");
    refresh();
  };
  const [urlInput,setUrlInput]=useState("");
  const [urlBusy,setUrlBusy]=useState(false);
  const [urlMsg,setUrlMsg]=useState("");
  const scrapeUrl=async()=>{
    if(!urlInput||urlBusy) return;
    setUrlBusy(true); setUrlMsg("Scraping product, please wait...");
    const r=await api("/api/import-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:urlInput})}).then(r=>r.json()).catch(()=>({error:"network"}));
    setUrlBusy(false);
    if(r.error){setUrlMsg("Failed: "+r.error);return;}
    setUrlMsg(`Added: ${r.name}`); setUrlInput(""); refresh();
  };
  const [showImport,setShowImport]=useState(false);
  const [imp,setImp]=useState({siteUrl:"",ck:"",cs:""});
  const [importing,setImporting]=useState(false);
  const [impMsg,setImpMsg]=useState("");
  const runImport=async()=>{
    if(!imp.siteUrl||!imp.ck||!imp.cs||importing) return;
    setImporting(true); setImpMsg("Fetching product list...");
    const r=await api("/api/import-products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(imp)}).then(r=>r.json()).catch(()=>({error:"network"}));
    if(r.error){setImpMsg("Failed: "+r.error);setImporting(false);return;}
    const list=r.products||[];
    let done=0,fail=0;
    for(const prod of list){
      setImpMsg(`Importing ${done+fail+1}/${list.length}: ${prod.product_name}`);
      const one=await api("/api/import-one",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(prod)}).then(r=>r.json()).catch(()=>({error:1}));
      if(one.error) fail++; else done++;
      await new Promise(r=>setTimeout(r,300));
    }
    setImporting(false);
    setImpMsg(`Done: ${done} imported${fail?`, ${fail} failed`:""}`);
    refresh();
  };
  const [np,setNp]=useState({product_id:"",product_name:"",category:"",sale_price:"",regular_price:"",image_url:"",description:""});
  const [adding,setAdding]=useState(false);
  const filtered = products.filter(p=>(p.product_name||p.name||"").toLowerCase().includes(search.toLowerCase())||(p.category||"").toLowerCase().includes(search.toLowerCase()));
  const del = async(id)=>{ await api("/api/products",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}); refresh(); };
  return <div style={{display:"flex",flexDirection:"column",gap:16,height:"calc(100vh - 130px)"}}>
    <div style={{display:"flex",gap:12}}>
      <div style={{position:"relative",flex:1}}><input placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",background:T.card,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"8px 12px 8px 36px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
      <Btn gold onClick={()=>{setShowAdd(!showAdd);setShowImport(false);}}><i className="ti ti-plus" style={{marginRight:6}}/>Add</Btn>
      <Btn onClick={()=>{setShowImport(!showImport);setShowAdd(false);}}><i className="ti ti-world-download" style={{marginRight:6}}/>Website</Btn>
      <Btn onClick={refresh}><i className="ti ti-refresh" style={{marginRight:6}}/>Sync</Btn>
    </div>
    {showImport&&<Card>
      <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>Import from your website (WooCommerce)</div>
      <div style={{fontSize:11.5,color:T.textMuted,marginBottom:12}}>WooCommerce &gt; Settings &gt; Advanced &gt; REST API &gt; Add key (Read) to get Consumer key and secret. All published products will be imported into your inventory.</div>
      <Inp label="Website URL" value={imp.siteUrl} onChange={e=>setImp({...imp,siteUrl:e.target.value})} placeholder="https://yourshop.com"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Inp label="Consumer key" value={imp.ck} onChange={e=>setImp({...imp,ck:e.target.value})} placeholder="ck_..."/>
        <Inp label="Consumer secret" value={imp.cs} onChange={e=>setImp({...imp,cs:e.target.value})} placeholder="cs_..."/>
      </div>
      <Btn gold onClick={runImport} disabled={importing}>{importing?"Importing...":"Import products"}</Btn>
      {impMsg&&<div style={{fontSize:12,color:T.textMuted,marginTop:10}}>{impMsg}</div>}
    </Card>}
    {showAdd&&<Card>
      <div style={{display:"flex",gap:8,marginBottom:14,paddingBottom:14,borderBottom:`0.5px solid ${T.border}`}}>
        <Inp label="Product URL (auto scrape)" value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://yourshop.com/product/..." style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"flex-end"}}>
          <Btn gold onClick={scrapeUrl} disabled={urlBusy}>{urlBusy?"Scraping...":"Fetch"}</Btn>
        </div>
      </div>
      {urlMsg&&<div style={{fontSize:12,color:T.textMuted,marginBottom:10}}>{urlMsg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Inp label="Product code" value={np.product_id} onChange={e=>setNp({...np,product_id:e.target.value})}/>
        <Inp label="Name" value={np.product_name} onChange={e=>setNp({...np,product_name:e.target.value})}/>
        <Inp label="Category" value={np.category} onChange={e=>setNp({...np,category:e.target.value})}/>
        <Inp label="Sale price" value={np.sale_price} onChange={e=>setNp({...np,sale_price:e.target.value})}/>
        <Inp label="Regular price" value={np.regular_price} onChange={e=>setNp({...np,regular_price:e.target.value})}/>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Product image</label>
        <input ref={addFileRef} type="file" accept="image/*" onChange={e=>setImgFile(e.target.files[0]||null)} style={{fontSize:13,color:T.text}}/>
        {imgFile&&<div style={{fontSize:11,color:T.textMuted,marginTop:4}}>{imgFile.name}</div>}
      </div>
      <Inp label="Description" textarea value={np.description} onChange={e=>setNp({...np,description:e.target.value})}/>
      <Btn gold onClick={add} disabled={adding}>{adding?"Saving + embedding...":"Save product"}</Btn>
    </Card>}
    <Card style={{flex:1,overflow:"auto",padding:0}}>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:560,borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:`0.5px solid ${T.border}`}}>
          {["ID","Product","Category","Price","Stock",""].map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",color:T.textMuted,fontWeight:500,fontSize:11,textTransform:"uppercase",letterSpacing:.8}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(p=><tr key={p.id} style={{borderBottom:`0.5px solid ${T.border}08`}}>
          <td style={{padding:"12px 16px",color:T.textDim,fontFamily:"monospace",fontSize:12}}>{p.product_id||p.id}</td>
          <td style={{padding:"12px 16px",fontWeight:500}}>{p.product_name||p.name||"Unnamed"}</td>
          <td style={{padding:"12px 16px"}}><Badge>{p.category||"N/A"}</Badge></td>
          <td style={{padding:"12px 16px",color:T.gold,fontWeight:500}}>{p.sale_price||p.regular_price||"-"}</td>
          <td style={{padding:"12px 16px"}}><Badge color={p.stock_status==="instock"?T.success:T.danger}>{p.stock_status||"?"}</Badge></td>
          <td style={{padding:"12px 16px"}}><button onClick={()=>del(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:16}}><i className="ti ti-trash"/></button></td>
        </tr>)}</tbody>
      </table></div>
      {filtered.length===0&&<div style={{padding:40,textAlign:"center",color:T.textDim}}>No products</div>}
    </Card>
  </div>;
}

function KnowledgeBase() {
  const [files,setFiles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [uploading,setUploading]=useState(false);
  const [msg,setMsg]=useState("");
  const fileRef=useRef(null);

  const load=async()=>{
    setLoading(true);
    const d=await api("/api/knowledge").then(r=>r.json()).catch(()=>[]);
    if(Array.isArray(d)) setFiles(d);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const upload=async(file)=>{
    if(!file) return;
    setUploading(true); setMsg("Uploading and analyzing "+file.name+"...");
    const fd=new FormData(); fd.append("file",file);
    const r=await api("/api/knowledge",{method:"POST",body:fd}).then(r=>r.json()).catch(()=>({error:"network"}));
    setUploading(false);
    if(r.error){setMsg("Failed: "+r.error);}
    else {setMsg(`Added ${file.name} — ${r.chunks} chunks indexed`); load();}
    if(fileRef.current) fileRef.current.value="";
  };

  const del=async(file_id)=>{
    await api("/api/knowledge",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({file_id})});
    load();
  };

  return <div>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv" hidden onChange={e=>{upload(e.target.files[0]);}}/>
      <Btn gold onClick={()=>fileRef.current?.click()} disabled={uploading}><i className="ti ti-upload" style={{marginRight:6}}/>{uploading?"Uploading...":"Upload document"}</Btn>
      <Btn onClick={load}><i className="ti ti-refresh" style={{marginRight:6}}/>Refresh</Btn>
    </div>
    <div style={{fontSize:11.5,color:T.textMuted,marginBottom:12}}>Upload PDF, Word (DOCX) or text files. Their content becomes your bot's knowledge base — the bot answers customer questions using only this information.</div>
    {msg&&<div style={{fontSize:12,color:msg.startsWith("Failed")?T.danger:T.success,marginBottom:12}}>{msg}</div>}
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {loading?<Card style={{textAlign:"center",color:T.textDim,padding:30}}>Loading...</Card>:files.length===0?<Card style={{textAlign:"center",color:T.textDim,padding:40}}>No documents yet. Upload your first file to build the knowledge base.</Card>:files.map(f=><Card key={f.file_id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
          <i className={`ti ${/pdf/i.test(f.file_type||"")?"ti-file-type-pdf":/word|docx?/i.test(f.file_type||f.file_name||"")?"ti-file-type-docx":"ti-file-text"}`} style={{fontSize:24,color:T.gold,flexShrink:0}}/>
          <div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.file_name}</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{f.chunks||0} chunks indexed</div></div>
        </div>
        <button onClick={()=>del(f.file_id)} title="Delete" style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:18,padding:4,flexShrink:0}}><i className="ti ti-trash"/></button>
      </Card>)}
    </div>
  </div>;
}

function Bookings() {
  const [bookings,setBookings]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("All");
  const sts=["All","Confirmed","Completed","Cancelled"];

  const load=async()=>{
    setLoading(true);
    const d=await api("/api/bookings").then(r=>r.json()).catch(()=>[]);
    if(Array.isArray(d)) setBookings(d);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  const update=async(id,status)=>{await api("/api/bookings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})}); load();};

  const filtered = filter==="All"?bookings:bookings.filter(b=>b.status===filter);
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>{sts.map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,background:filter===s?T.gold:"rgba(240,192,64,0.08)",color:filter===s?"#0a0a0a":T.textMuted}}>{s}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {loading?<Card style={{textAlign:"center",color:T.textDim,padding:30}}>Loading...</Card>:filtered.length===0?<Card style={{textAlign:"center",color:T.textDim,padding:40}}>No bookings yet</Card>:filtered.map(b=><Card key={b.id}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600}}>{b.customer_name||"—"} <span style={{fontSize:12,color:T.textMuted,fontWeight:400}}>· {b.service_want||""}</span></div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:4}}><i className="ti ti-calendar" style={{marginRight:4}}/>{b.meeting_date} {b.meeting_time}</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}><i className="ti ti-mail" style={{marginRight:4}}/>{b.email||"—"} · <i className="ti ti-phone" style={{margin:"0 4px"}}/>{b.phone||"—"}</div>
            {b.meeting_link&&<a href={b.meeting_link} target="_blank" rel="noreferrer" style={{fontSize:12,color:T.gold,marginTop:4,display:"inline-block"}}><i className="ti ti-video" style={{marginRight:4}}/>Join Meet</a>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0}}>
            <Badge color={b.status==="Confirmed"?T.success:b.status==="Completed"?T.info:T.danger}>{b.status}</Badge>
            {b.status==="Confirmed"&&<Btn small onClick={()=>update(b.id,"Completed")}>Mark done</Btn>}
          </div>
        </div>
      </Card>)}
    </div>
  </div>;
}

function Orders({orders,refresh}) {
  const [filter,setFilter]=useState("All");
  const sts=["All","Pending","Shipped","Delivered","Cancelled"];
  const filtered = filter==="All"?orders:orders.filter(o=>o.status===filter);
  const update=async(id,status)=>{await api("/api/orders",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})}); refresh();};
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:20}}>{sts.map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,background:filter===s?T.gold:"rgba(240,192,64,0.08)",color:filter===s?"#0a0a0a":T.textMuted}}>{s}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {filtered.map(o=><Card key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:14,fontWeight:600,color:T.gold,fontFamily:"monospace"}}>{o.id}</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{o.customer_name||o.customer} - {o.product_name||o.products}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Badge color={o.status==="Pending"?T.warn:o.status==="Shipped"?T.info:o.status==="Delivered"?T.success:T.danger}>{o.status}</Badge>
          {o.status==="Pending"&&<Btn small onClick={()=>update(o.id,"Shipped")}>Ship</Btn>}
          {o.status==="Shipped"&&<Btn small onClick={()=>update(o.id,"Delivered")}>Deliver</Btn>}
        </div>
      </Card>)}
      {filtered.length===0&&<Card style={{textAlign:"center",color:T.textDim,padding:40}}>No orders</Card>}
    </div>
  </div>;
}

function Profile() {
  const [p,setP]=useState(null);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({business_name:"",phone:"",address:"",website:"",business_type:"ecommerce",item_label:""});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const BIZ_LABEL={ecommerce:"E-commerce / Online shop",agency:"Agency / Service provider"};
  const AUTO_ITEM={ecommerce:"product",agency:"service"};

  const [loadErr,setLoadErr]=useState(false);
  const [logoBusy,setLogoBusy]=useState(false);
  const logoRef=useRef(null);
  const [cal,setCal]=useState({connected:false,email:""});

  const loadCal=async()=>{
    const d=await api("/api/gcal/status").then(r=>r.json()).catch(()=>null);
    if(d) setCal(d);
  };
  useEffect(()=>{loadCal();},[]);
  useEffect(()=>{
    const onMsg=(e)=>{ if(e.data==="gcal-connected") loadCal(); };
    window.addEventListener("message",onMsg);
    return ()=>window.removeEventListener("message",onMsg);
  },[]);
  const connectCal=()=>{
    const w=window.open("/api/gcal/login?client_id="+(p?.client_id||p?.id||""),"gcal","width=520,height=640");
    if(!w) window.location.href="/api/gcal/login?client_id="+(p?.client_id||p?.id||"");
    const iv=setInterval(async()=>{
      const d=await api("/api/gcal/status").then(r=>r.json()).catch(()=>null);
      if(d){ setCal(d); if(d.connected) clearInterval(iv); }
    },4000);
    setTimeout(()=>clearInterval(iv),60000);
  };
  const disconnectCal=async()=>{
    await api("/api/gcal/status",{method:"DELETE"}).catch(()=>{});
    loadCal();
  };

  const uploadLogo=async(file)=>{
    if(!file) return;
    setLogoBusy(true);
    const fd=new FormData(); fd.append("logo",file);
    const r=await api("/api/profile-logo",{method:"POST",body:fd}).then(r=>r.json()).catch(()=>({error:"network"}));
    setLogoBusy(false);
    if(r.error){setMsg("Logo failed: "+r.error);return;}
    await load();
    if(typeof window!=="undefined") window.dispatchEvent(new Event("logo-updated"));
  };
  const removeLogo=async()=>{
    setLogoBusy(true);
    await api("/api/profile-logo",{method:"DELETE"}).catch(()=>{});
    setLogoBusy(false);
    await load();
    if(typeof window!=="undefined") window.dispatchEvent(new Event("logo-updated"));
  };

  const load=async(attempt=0)=>{
    setLoadErr(false);
    const d=await api("/api/profile?t="+Date.now()).then(r=>r.json()).catch(()=>null);
    if(!d||d.error){
      if(attempt<3){ setTimeout(()=>load(attempt+1),1000*(attempt+1)); return; }
      setLoadErr(true);
      return;
    }
    setP(d);
    setForm({business_name:d.business_name||"",phone:d.phone||"",address:d.address||"",website:d.website||"",business_type:d.business_type||"ecommerce",item_label:d.item_label||""});
  };
  useEffect(()=>{load();},[]);

  const save=async()=>{
    setSaving(true); setMsg("");
    const payload={...form,item_label:AUTO_ITEM[form.business_type]||"item"};
    const r=await api("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}).then(r=>r.json()).catch(()=>({error:"network"}));
    setSaving(false);
    if(r.error){setMsg("Failed: "+r.error);return;}
    await load();
    setEditing(false);
    setMsg("");
  };

  if(loadErr) return <Card style={{color:T.textDim}}>Could not load profile.<Btn gold onClick={()=>load(0)} style={{marginLeft:10}}>Retry</Btn></Card>;
  if(!p) return <Card style={{color:T.textDim}}>Loading...</Card>;
  const planColor=p.plan==="pro"?T.success:p.plan==="trial"?T.gold:T.textDim;

  return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,alignItems:"start"}}>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,paddingBottom:16,borderBottom:`0.5px solid ${T.border}`}}>
        <div style={{width:64,height:64,borderRadius:14,overflow:"hidden",flexShrink:0,background:T.bgAlt,border:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {p.logo_url?<img src={p.logo_url} alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<i className="ti ti-building-store" style={{fontSize:26,color:T.textDim}}/>}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:6}}>Business logo <span style={{color:T.textDim,fontWeight:400}}>(optional)</span></div>
          <input ref={logoRef} type="file" accept="image/*" hidden onChange={e=>{uploadLogo(e.target.files[0]);e.target.value="";}}/>
          <div style={{display:"flex",gap:8}}>
            <Btn small gold onClick={()=>logoRef.current?.click()} disabled={logoBusy}>{logoBusy?"Uploading...":(p.logo_url?"Change":"Upload")}</Btn>
            {p.logo_url&&<Btn small onClick={removeLogo} disabled={logoBusy}>Remove</Btn>}
          </div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:600}}>Business information</div>
        {!editing&&<i onClick={()=>setEditing(true)} className="ti ti-pencil" title="Edit" style={{fontSize:17,color:T.gold,cursor:"pointer"}}/>}
      </div>

      {!editing?<>
        <Row k="Business name" v={p.business_name||"-"}/>
        <Row k="Phone" v={p.phone||"-"}/>
        <Row k="Address" v={p.address||"-"}/>
        <Row k="Website" v={p.website||"-"}/>
        <Row k="Business type" v={BIZ_LABEL[p.business_type]||p.business_type||"-"}/>
      </>:<>
        <Inp label="Business name" value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})}/>
        <Inp label="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
        <Inp label="Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
        <Inp label="Website" value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/>
        <label style={{display:"block",fontSize:12,color:T.textMuted,margin:"4px 0 6px",textTransform:"uppercase",letterSpacing:1}}>Business type</label>
        <select value={form.business_type} onChange={e=>setForm({...form,business_type:e.target.value})} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:13,marginBottom:12}}>
          {Object.entries(BIZ_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Btn gold onClick={save} disabled={saving}>{saving?"Saving...":"Save changes"}</Btn>
          <Btn onClick={()=>{setEditing(false);load();}}>Cancel</Btn>
          {msg&&<span style={{fontSize:12,color:T.textMuted}}>{msg}</span>}
        </div>
      </>}
    </Card>
    <Card>
      <div style={{fontSize:14,fontWeight:600,marginBottom:16}}>Account</div>
      <Row k="Email" v={p.email}/>
      <Row k="Plan" v={<Badge color={planColor}>{p.plan}</Badge>}/>
      {p.plan==="trial"&&p.trial_end&&<Row k="Trial ends" v={new Date(p.trial_end).toLocaleDateString()}/>}
      {p.plan==="trial"&&<Row k="Today usage" v={`${p.usage?.today??0} / 30 msgs`}/>}
      <Row k="Joined" v={p.created_at?new Date(p.created_at).toLocaleDateString():"-"}/>
      <div style={{height:12}}/>
      <div style={{fontSize:14,fontWeight:600,margin:"8px 0 12px"}}>Resources</div>
      <Row k="Products" v={p.usage?.products??0}/>
      <Row k="Orders" v={p.usage?.orders??0}/>
      <Row k="Channels" v={p.usage?.channels??0}/>
      <div style={{height:16}}/>
      <Btn danger onClick={async()=>{await getSb().auth.signOut();AUTH_TOKEN="";location.reload();}} style={{width:"100%"}}><i className="ti ti-logout" style={{marginRight:6}}/>Logout</Btn>
    </Card>
    {p.business_type==="agency"&&<Card>
      <div style={{fontSize:14,fontWeight:600,marginBottom:6}}><i className="ti ti-calendar-event" style={{marginRight:6,color:T.gold}}/>Google Calendar</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>Connect your Google Calendar so the bot can check your availability, create meetings, and send Google Meet links to customers automatically.</div>
      {cal.connected?<>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <Badge color={T.success}>Connected</Badge>
          <span style={{fontSize:13,color:T.textMuted,overflow:"hidden",textOverflow:"ellipsis"}}>{cal.email}</span>
        </div>
        <Btn onClick={disconnectCal} style={{width:"100%"}}><i className="ti ti-plug-x" style={{marginRight:6}}/>Disconnect</Btn>
      </>:<Btn gold onClick={connectCal} style={{width:"100%"}}><i className="ti ti-brand-google" style={{marginRight:6}}/>Connect Google Calendar</Btn>}
    </Card>}
  </div>;
}

function Row({k,v}) {
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`0.5px solid ${T.border}`,fontSize:13}}>
    <span style={{color:T.textMuted}}>{k}</span><span>{v}</span>
  </div>;
}

const CORE_BASE_DISPLAY = `OUTPUT: Platform JSON format only · no markdown images or lists · no links inside text · short, human replies
LANGUAGE: Always match the customer (Bangla / English / Banglish) · greet only on first message
ACCURACY: Injected data is the only source of truth · never guess facts, prices or policies`;
const CORE_ECOM_DISPLAY = `PRODUCTS: Code = exact product · text search = top 2 · one best match per sent photo · low confidence = ask clearer photo
DISPLAY: Image first, then Product / Code / Price · sale price before regular · one smart closing line
ORDERS: Full Name / Phone / Address collected and verified before confirming`;
const CORE_AGENCY_DISPLAY = `KNOWLEDGE: Answers come only from your uploaded knowledge base · unknown = "we'll connect you with the team"
SERVICES: Presented conversationally · no invented packages or prices
MEETINGS: Collects name, email, phone, service, date & time · confirms before booking · Google Meet link sent automatically`;

function Settings({settings,setSettings}) {
  const [s,setS]=useState(settings);
  const [saved,setSaved]=useState(false);
  const [gen,setGen]=useState(false);
  const [genMsg,setGenMsg]=useState("");
  const [me,setMe]=useState(null);
  useEffect(()=>{setS(settings);},[settings]);
  useEffect(()=>{api("/api/me").then(r=>r.json()).then(setMe).catch(()=>{});},[]);
  const bType=me?.client?.business_type||"ecommerce";
  const isEcom=bType==="ecommerce";
  const q=s.questionnaire||{};
  const setQ=(patch)=>setS(v=>({...v,questionnaire:{...(v.questionnaire||{}),...patch}}));
  const save=async()=>{setSettings(s); await api("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}); setSaved(true); setTimeout(()=>setSaved(false),2000);};
  const regenerate=async()=>{
    if(gen) return;
    if(!(q.description||"").trim()){setGenMsg("Please describe your business first");return;}
    setGen(true); setGenMsg("AI is writing your bot's business profile...");
    const r=await api("/api/generate-prompt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers:q})}).then(r=>r.json()).catch(()=>({error:"network"}));
    setGen(false);
    if(r.error){setGenMsg("Failed: "+r.error);return;}
    setS(v=>({...v,businessPrompt:r.prompt})); setGenMsg("Generated and saved. Review below — you can edit it.");
  };
  const selStyle={width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:13.5};
  return <div style={{maxWidth:700}}>
    <Card style={{marginBottom:16}}><div style={{fontSize:15,fontWeight:500,marginBottom:16}}>General</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Inp label="Bot name" value={s.botName||""} onChange={e=>setS({...s,botName:e.target.value})}/>
        <Inp label="Business name" value={s.businessName||""} onChange={e=>setS({...s,businessName:e.target.value})}/>
      </div>
      <Inp label="Greeting" value={s.greeting||""} onChange={e=>setS({...s,greeting:e.target.value})}/>
    </Card>

    <Card style={{marginBottom:16,border:`1px solid ${T.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <i className="ti ti-lock" style={{color:T.gold,fontSize:16}}/>
        <div style={{fontSize:15,fontWeight:500}}>Core rules (locked)</div>
      </div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:10}}>These platform rules keep every bot accurate and safe. They are always active and cannot be changed.</div>
      <pre style={{fontSize:12,color:T.textMuted,whiteSpace:"pre-wrap",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:12,margin:0,lineHeight:1.7}}>{CORE_BASE_DISPLAY+"\n"+(isEcom?CORE_ECOM_DISPLAY:CORE_AGENCY_DISPLAY)}</pre>
      <div style={{fontSize:11.5,color:T.textDim,marginTop:8}}><i className="ti ti-info-circle" style={{marginRight:4}}/>{isEcom?"E-commerce rules active — product matching, display and order flow.":"Agency rules active — knowledge-base answers and meeting booking flow."}</div>
    </Card>

    <Card style={{marginBottom:16}}>
      <div style={{fontSize:15,fontWeight:500,marginBottom:6}}><i className="ti ti-wand" style={{marginRight:6,color:T.gold}}/>Bot training</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:14}}>Answer about your business — AI writes the bot's business profile inside the fixed structure. Edit anytime and regenerate.</div>
      <Inp textarea label="Describe your business" value={q.description||""} onChange={e=>setQ({description:e.target.value})}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Bot tone</label>
          <select value={q.tone||"Friendly and helpful"} onChange={e=>setQ({tone:e.target.value})} style={selStyle}>
            {["Friendly and helpful","Professional and formal","Casual and fun"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Customer languages</label>
          <select value={q.languages||"Bangla and English"} onChange={e=>setQ({languages:e.target.value})} style={selStyle}>
            {["Bangla and English","Bangla only","English only"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      {isEcom?<>
        <Inp label="Delivery (time & charge)" value={q.delivery||""} onChange={e=>setQ({delivery:e.target.value})}/>
        <Inp label="Payment methods" value={q.payment||""} onChange={e=>setQ({payment:e.target.value})}/>
        <Inp label="Return / refund policy" value={q.returnPolicy||""} onChange={e=>setQ({returnPolicy:e.target.value})}/>
      </>:<>
        <Inp textarea label="Services you offer" value={q.services||""} onChange={e=>setQ({services:e.target.value})}/>
        <Inp label="Meeting / booking info" value={q.meetingInfo||""} onChange={e=>setQ({meetingInfo:e.target.value})}/>
      </>}
      <Inp label="Catalog / website link" value={q.catalogLink||""} onChange={e=>setQ({catalogLink:e.target.value})}/>
      <Inp label="Special brand rules" value={q.special||""} onChange={e=>setQ({special:e.target.value})}/>
      <Inp label="Working hours" value={q.hours||""} onChange={e=>setQ({hours:e.target.value})}/>
      <Inp textarea label="Common questions & answers" value={q.faq||""} onChange={e=>setQ({faq:e.target.value})}/>
      <Btn gold onClick={regenerate} disabled={gen}><i className="ti ti-sparkles" style={{marginRight:6}}/>{gen?"Generating...":"Regenerate with AI"}</Btn>
      {genMsg&&<span style={{fontSize:12,color:T.textMuted,marginLeft:10}}>{genMsg}</span>}
    </Card>

    <Card style={{marginBottom:16}}><div style={{fontSize:15,fontWeight:500,marginBottom:6}}>Business prompt (editable)</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>This is your bot's business knowledge. Edit freely — the locked core rules above are added automatically on top.</div>
      <Inp textarea value={s.businessPrompt||s.systemPrompt||""} onChange={e=>setS({...s,businessPrompt:e.target.value})} style={{marginBottom:0}}/>
    </Card>
    <Btn gold onClick={save}><i className="ti ti-check" style={{marginRight:6}}/>{saved?"Saved!":"Save settings"}</Btn>
  </div>;
}

function Demo({onBack}) {
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [showEmoji,setShowEmoji]=useState(false);
  const [img,setImg]=useState(null); // {dataUrl, base64, mime}
  const [rec,setRec]=useState(false);
  const recRef=useRef(null);
  const chunksRef=useRef([]);
  const ref=useRef(null);
  const fileRef=useRef(null);
  const EMOJIS=["😀","😂","❤️","👍","🙏","😍","🔥","🎉","😢","😮","💯","✅"];
  const DEMO_NAME="Autologic Demo Bot";
  const DEMO_GREETING="Hi! I'm the Autologic Demo Bot 🤖 — your product expert. Ask me anything about Autologic: features, pricing, setup guide, how the AI answers customers, Google Calendar booking, or anything else. You can also send an image or a voice message to try those features!";
  const clearChat=()=>setMsgs([{role:"bot",text:DEMO_GREETING}]);
  useEffect(()=>{clearChat();},[]);
  const scrollDown=()=>setTimeout(()=>ref.current?.scrollTo({top:ref.current.scrollHeight,behavior:"smooth"}),80);

  const callApi=async(payload,userBubble)=>{
    setMsgs(p=>[...p,userBubble]); setLoading(true); scrollDown();
    try {
      const history=msgs.filter((_,i)=>i>0).map(m=>({role:m.role==="bot"?"assistant":"user",content:m.text||""}));
      const res=await api("/api/demo-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...history,{role:"user",content:payload.text||""}],...payload.extra})});
      const data=await res.json();
      if(data.transcript){ setMsgs(p=>p.map((m,i)=>i===p.length-1&&m.voice?{...m,text:data.transcript}:m)); }
      setMsgs(p=>[...p,{role:"bot",text:data.reply||"Error"}]);
    } catch { setMsgs(p=>[...p,{role:"bot",text:"Connection error."}]); }
    setLoading(false); scrollDown();
  };

  const send=async()=>{
    if(loading) return;
    const text=input.trim();
    if(!text&&!img) return;
    setInput(""); setShowEmoji(false);
    const extra=img?{imageBase64:img.base64,imageMime:img.mime}:{};
    const bubble={role:"user",text,image:img?.dataUrl};
    setImg(null);
    await callApi({text,extra},bubble);
  };

  const pickImage=(e)=>{
    const file=e.target.files?.[0]; e.target.value="";
    if(!file) return;
    if(file.size>4*1024*1024){alert("Image too large (max 4MB)");return;}
    const r=new FileReader();
    r.onload=()=>{const dataUrl=r.result;setImg({dataUrl,base64:dataUrl.split(",")[1],mime:file.type||"image/jpeg"});};
    r.readAsDataURL(file);
  };

  const toggleRec=async()=>{
    if(rec){ recRef.current?.stop(); return; }
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);
      chunksRef.current=[];
      mr.ondataavailable=e=>chunksRef.current.push(e.data);
      mr.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop()); setRec(false);
        const blob=new Blob(chunksRef.current,{type:mr.mimeType||"audio/webm"});
        if(blob.size<1000) return;
        const r=new FileReader();
        r.onload=async()=>{
          const b64=r.result.split(",")[1];
          await callApi({text:"",extra:{audioBase64:b64,audioMime:blob.type}},{role:"user",voice:true,text:"🎤 Voice message..."});
        };
        r.readAsDataURL(blob);
      };
      mr.start(); recRef.current=mr; setRec(true);
    } catch { alert("Microphone access denied"); }
  };

  return <div style={{position:"fixed",inset:0,zIndex:70,background:T.bg,display:"flex",flexDirection:"column",height:"100dvh"}}>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`0.5px solid ${T.border}`,background:T.card,flexShrink:0}}>
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:T.text,fontSize:20,padding:6}}><i className="ti ti-arrow-left"/></button>
      <div style={{width:38,height:38,borderRadius:11,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${T.gold}30`,flexShrink:0}}><i className="ti ti-robot" style={{fontSize:20,color:T.gold}}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{DEMO_NAME}</div>
        <div style={{fontSize:11,color:T.success,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:T.success,display:"inline-block"}}/>Product expert · online</div>
      </div>
      <button onClick={clearChat} title="Clear chat" style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:17,padding:6}}><i className="ti ti-refresh"/></button>
    </div>

    {/* Messages */}
    <div ref={ref} style={{flex:1,overflowY:"auto",padding:"14px 12px",display:"flex",flexDirection:"column",gap:10,WebkitOverflowScrolling:"touch"}}>
      {msgs.map((m,i)=><div key={i} style={{display:"flex",justifyContent:m.role==="bot"?"flex-start":"flex-end"}}>
        <div style={{maxWidth:"82%",borderRadius:14,fontSize:13.5,lineHeight:1.65,whiteSpace:"pre-wrap",background:m.role==="bot"?T.bgAlt:T.gold,color:m.role==="bot"?T.text:"#0a0a0a",borderBottomLeftRadius:m.role==="bot"?3:14,borderBottomRightRadius:m.role==="bot"?14:3,overflow:"hidden"}}>
          {m.image&&<img src={m.image} alt="" style={{display:"block",maxWidth:"100%",maxHeight:220,objectFit:"cover"}}/>}
          {(m.text||m.voice)&&<div style={{padding:"10px 14px"}}>{m.voice&&<i className="ti ti-microphone" style={{marginRight:6,fontSize:13}}/>}{m.text}</div>}
        </div>
      </div>)}
      {loading&&<div style={{display:"flex",gap:4,padding:"10px 14px",background:T.bgAlt,borderRadius:14,width:"fit-content",borderBottomLeftRadius:3}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.textDim,animation:`dotPulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>}
    </div>

    {/* Composer */}
    <div style={{borderTop:`0.5px solid ${T.border}`,background:T.card,flexShrink:0,position:"relative",paddingBottom:"env(safe-area-inset-bottom)"}}>
      {showEmoji&&<div style={{position:"absolute",bottom:"100%",right:12,background:T.card,border:`0.5px solid ${T.border}`,borderRadius:12,padding:8,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,zIndex:5}}>
        {EMOJIS.map(e=><span key={e} onClick={()=>{setInput(p=>p+e);setShowEmoji(false);}} style={{fontSize:20,cursor:"pointer",padding:4}}>{e}</span>)}
      </div>}
      {img&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px 0"}}>
        <img src={img.dataUrl} alt="" style={{width:46,height:46,borderRadius:8,objectFit:"cover",border:`1px solid ${T.border}`}}/>
        <span style={{fontSize:12,color:T.textMuted,flex:1}}>Image attached</span>
        <button onClick={()=>setImg(null)} style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:16}}><i className="ti ti-x"/></button>
      </div>}
      {rec&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px 0",color:T.danger,fontSize:12.5}}><span style={{width:8,height:8,borderRadius:"50%",background:T.danger,animation:"pulse 1s infinite"}}/>Recording... tap mic to stop & send</div>}
      <div style={{padding:"10px 8px",display:"flex",gap:4,alignItems:"center"}}>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{display:"none"}}/>
        <button onClick={()=>fileRef.current?.click()} title="Send image" style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:19,padding:6,flexShrink:0}}><i className="ti ti-photo"/></button>
        <button onClick={toggleRec} title={rec?"Stop & send":"Voice message"} style={{background:rec?T.danger:"none",border:"none",cursor:"pointer",color:rec?"#fff":T.textMuted,fontSize:19,padding:6,borderRadius:"50%",flexShrink:0,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`ti ${rec?"ti-player-stop":"ti-microphone"}`}/></button>
        <div style={{flex:1,display:"flex",alignItems:"center",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:20,padding:"0 4px 0 12px",minWidth:0}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} onFocus={scrollDown} placeholder="Ask about Autologic..." style={{flex:1,background:"none",border:"none",padding:"11px 0",color:T.text,fontSize:14,outline:"none",minWidth:0}}/>
          <button onClick={()=>setShowEmoji(x=>!x)} title="Emoji" style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"4px 2px",flexShrink:0}}>😊</button>
        </div>
        <button onClick={send} disabled={loading} style={{width:38,height:38,borderRadius:"50%",border:"none",cursor:"pointer",background:T.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:loading?0.6:1}}><i className="ti ti-send" style={{fontSize:16,color:"#0a0a0a"}}/></button>
      </div>
    </div>
  </div>;
}

function Channels({onConnect}) {
  const [channels,setChannels]=useState([]);
  const [busyId,setBusyId]=useState(null);
  const load=()=>api("/api/channels").then(r=>r.json()).then(d=>Array.isArray(d)&&setChannels(d)).catch(()=>{});
  useEffect(()=>{load();},[]);
  const icons={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp",website:"ti-world"};

  const toggle=async(ch)=>{
    setBusyId(ch.id);
    const next=ch.status==="connected"?"paused":"connected";
    await api("/api/channels",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:ch.id,status:next})}).catch(()=>{});
    await load(); setBusyId(null);
  };
  const disconnect=async(ch)=>{
    if(!window.confirm(`Disconnect ${ch.platform}? The bot will stop replying on this channel and you'll need to reconnect to use it again.`)) return;
    setBusyId(ch.id);
    await api("/api/channels",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:ch.id})}).catch(()=>{});
    await load(); setBusyId(null);
  };

  return <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:700}}>
    <Btn gold onClick={onConnect} style={{alignSelf:"flex-start"}}><i className="ti ti-plus" style={{marginRight:6}}/>Connect new channel</Btn>
    {channels.map(ch=><Card key={ch.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:14,minWidth:0}}>
        <div style={{width:40,height:40,borderRadius:10,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><i className={`ti ${icons[ch.platform]||"ti-plug"}`} style={{fontSize:20,color:T.gold}}/></div>
        <div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:500,textTransform:"capitalize"}}>{ch.platform}</div><div style={{fontSize:12,color:T.textMuted,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis"}}>{ch.page_id||"-"}</div></div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <Badge color={ch.status==="connected"?T.success:T.textDim}>{ch.status}</Badge>
        <Btn small onClick={()=>toggle(ch)} disabled={busyId===ch.id}>
          <i className={`ti ${ch.status==="connected"?"ti-player-pause":"ti-player-play"}`} style={{marginRight:4}}/>{ch.status==="connected"?"Pause":"Resume"}
        </Btn>
        <button onClick={()=>disconnect(ch)} disabled={busyId===ch.id} title="Disconnect" style={{background:"none",border:`1px solid ${T.danger}`,borderRadius:6,cursor:"pointer",color:T.danger,fontSize:13,padding:"5px 10px",display:"flex",alignItems:"center",gap:4,opacity:busyId===ch.id?0.5:1}}>
          <i className="ti ti-plug-x"/>Disconnect
        </button>
      </div>
    </Card>)}
    {channels.length===0&&<Card style={{textAlign:"center",color:T.textDim,padding:40}}>No channels configured</Card>}
  </div>;
}


function AuthGate({onReady}) {
  // Priority: explicit ?auth=signup/signin from the landing page → then first-visit localStorage.
  const [mode,setMode]=useState("signin");
  useEffect(()=>{
    try {
      const param = new URLSearchParams(window.location.search).get("auth");
      if (param === "signup" || param === "signin") { setMode(param); return; }
      const seen = localStorage.getItem("autologic_visited");
      setMode(seen ? "signin" : "signup");
    } catch { setMode("signin"); }
  },[]);
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [showPw,setShowPw]=useState(false);
  const [biz,setBiz]=useState("");
  const [err,setErr]=useState("");
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);
  const go=async()=>{
    if(!email||!pw||busy) return;
    setBusy(true); setErr("");
    try{
      let res;
      if(mode==="signup") res=await getSb().auth.signUp({email,password:pw});
      else res=await getSb().auth.signInWithPassword({email,password:pw});
      if(res.error) throw res.error;
      const session=res.data.session;
      if(!session){setErr("Check your email to confirm, then sign in.");setBusy(false);return;}
      AUTH_TOKEN=session.access_token;
      try { localStorage.setItem("autologic_visited","1"); } catch {}
      if(mode==="signup") await api("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"register",business_name:biz||email.split("@")[0]})});
      onReady();
    }catch(e){setErr(e.message||"Failed");}
    setBusy(false);
  };
  const forgot=async()=>{
    setErr("");setMsg("");
    if(!email){setErr("Enter your email first, then tap reset.");return;}
    const {error}=await getSb().auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset`});
    if(error) setErr(error.message);
    else setMsg("Password reset link sent — check your email.");
  };
  return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <Card style={{width:340,textAlign:"center",padding:"2.5rem 2rem"}}>
      <div style={{width:56,height:56,borderRadius:16,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:`1px solid ${T.gold}30`}}><i className="ti ti-robot" style={{fontSize:26,color:T.gold}}/></div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:4}}>Chatbot Platform</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:20}}>{mode==="signin"?"Sign in to your dashboard":"Create your account"}</div>
      {mode==="signup"&&<Inp value={biz} onChange={e=>setBiz(e.target.value)} placeholder="Business name"/>}
      <Inp type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/>
      <div style={{position:"relative",marginBottom:10}}>
        <Inp type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Password" style={{marginBottom:0}} inputStyle={{paddingRight:44}}/>
        <button type="button" onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:12,padding:4}}>{showPw?"Hide":"Show"}</button>
      </div>
      {mode==="signin"&&<div style={{textAlign:"right",marginBottom:12}}><span onClick={forgot} style={{fontSize:11.5,color:T.gold,cursor:"pointer"}}>Forgot password?</span></div>}
      <Btn gold onClick={go} style={{width:"100%"}}>{busy?"Please wait...":(mode==="signin"?"Sign In":"Sign Up")}</Btn>
      {err&&<div style={{fontSize:12,color:T.danger,marginTop:10}}>{err}</div>}
      {msg&&<div style={{fontSize:12,color:T.success,marginTop:10}}>{msg}</div>}
      <div style={{fontSize:12,color:T.textMuted,marginTop:16,cursor:"pointer"}} onClick={()=>{setMode(m=>m==="signin"?"signup":"signin");setErr("");setMsg("");}}>
        {mode==="signin"?"New here? Create account":"Already have an account? Sign in"}
      </div>
    </Card>
  </div>;
}

function Onboarding({me,onTrial,onDemo}) {
  // New signups complete their business profile first, then choose trial or demo.
  const c=me?.client||{};
  const needProfile=!c.phone&&!c.address;
  const [step,setStep]=useState(needProfile?"profile":"choose");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [form,setForm]=useState({business_name:c.business_name||"",business_type:c.business_type||"ecommerce",phone:"",address:"",website:""});
  const BIZ={ecommerce:"E-commerce / Online shop",agency:"Agency / Service provider"};
  const [q,setQ]=useState({description:"",tone:"Friendly and helpful",languages:"Bangla and English",hours:"",delivery:"",payment:"",returnPolicy:"",services:"",meetingInfo:"",faq:"",catalogLink:"",special:""});
  const [showMore,setShowMore]=useState(false);
  const [preview,setPreview]=useState("");
  const isEcom=form.business_type==="ecommerce";
  const trainBot=async(skip)=>{
    if(skip){setStep("choose");return;}
    if(q.description.trim().length<25){setErr("Please describe your business in a little more detail — a few sentences is enough");return;}
    setBusy(true);setErr("");
    try{
      const res=await api("/api/generate-prompt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers:q})});
      const d=await res.json();
      if(d.error) throw new Error(d.error);
      setPreview(d.prompt||"");
      setStep("preview");
    }catch(e){setErr(e.message||"Generation failed");}
    setBusy(false);
  };

  // Keep any edits the owner made to the generated profile.
  const savePreview=async()=>{
    setBusy(true);setErr("");
    try{
      await api("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessPrompt:preview})});
      setStep("choose");
    }catch(e){setErr("Could not save. Please try again.");}
    setBusy(false);
  };

  const saveProfile=async()=>{
    if(!form.business_name.trim()){setErr("Business name is required");return;}
    if(!form.phone.trim()){setErr("Phone number is required");return;}
    setBusy(true);setErr("");
    try{
      const res=await api("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      if(!res.ok) throw new Error("Save failed");
      setStep("train");
    }catch(e){setErr(e.message||"Failed");}
    setBusy(false);
  };
  const startTrial=async()=>{
    setBusy(true);
    await api("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"start_trial"})});
    setBusy(false);
    onTrial();
  };

  if(step==="profile") return <div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <Card style={{maxWidth:440,width:"100%",padding:"2rem 1.6rem"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{width:52,height:52,borderRadius:14,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",border:`1px solid ${T.gold}30`}}><i className="ti ti-building-store" style={{fontSize:24,color:T.gold}}/></div>
        <div style={{fontSize:18,fontWeight:600}}>Set up your business profile</div>
        <div style={{fontSize:12.5,color:T.textMuted,marginTop:4}}>Step 1 of 2 — this helps your AI assistant represent your business</div>
      </div>
      <Inp label="Business name *" value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} placeholder="e.g. Autologic Agency"/>
      <div style={{marginBottom:16}}>
        <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Business type *</label>
        <select value={form.business_type} onChange={e=>setForm({...form,business_type:e.target.value})} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:13.5}}>
          {Object.entries(BIZ).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Inp label="Phone *" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="e.g. 01700000000"/>
      <Inp label="Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="City, Country"/>
      <Inp label="Website (optional)" value={form.website} onChange={e=>setForm({...form,website:e.target.value})} placeholder="example.com"/>
      {err&&<div style={{fontSize:12,color:T.danger,marginBottom:10}}>{err}</div>}
      <Btn gold onClick={saveProfile} disabled={busy} style={{width:"100%"}}>{busy?"Saving...":"Continue"}</Btn>
    </Card>
  </div>;

  const EXAMPLES = isEcom ? [
    {label:"Jewelry shop", text:"We sell imported jewelry — rings, necklaces and bracelets for both men and women. Prices are between 500 and 3000 taka. All rings are free size. We are online only, based in Savar. Delivery is 80 taka inside Dhaka (1-2 days) and 130 taka outside Dhaka (2-3 days). We take cash on delivery and bKash. Customers can check the product in front of the delivery rider."},
    {label:"Cake & food", text:"We make homemade cakes and desserts to order in Dhaka. A half kg cake starts from 800 taka. Custom cakes need at least 2 days notice. We deliver inside Dhaka only for 100 taka. Payment is bKash advance. We are closed on Fridays."},
    {label:"Clothing store", text:"We sell men's and women's clothing — shirts, panjabi, sarees and three-piece sets. Prices are 600 to 4000 taka. We have a size chart for every item, so always ask the customer for their size. Delivery all over Bangladesh: 70 taka in Dhaka, 130 taka outside. Cash on delivery is available. Exchange within 3 days if the size does not fit."},
  ] : [
    {label:"Marketing agency", text:"We are a digital marketing agency in Dhaka. We manage Facebook and Instagram ads, create content, and handle page management. Packages start from 8000 taka per month. We offer a free 30 minute consultation call before starting any work. We are open Saturday to Thursday, 10am to 7pm."},
    {label:"Clinic / chamber", text:"We are a dental clinic in Chattogram. We do check-ups, scaling, filling and braces. The consultation fee is 500 taka. Patients need an appointment — we are open Saturday to Thursday, 5pm to 9pm. For emergencies they can call us directly."},
    {label:"Coaching centre", text:"We run an IELTS coaching centre in Dhaka. New batches start every month. The course fee is 12000 taka for 3 months with classes 3 days a week. We offer one free trial class. Students can book a counselling session to learn more before enrolling."},
  ];

  if(step==="train") return <div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <Card style={{maxWidth:560,width:"100%",padding:"1.8rem 1.6rem",maxHeight:"92dvh",overflowY:"auto"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{width:52,height:52,borderRadius:14,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",border:`1px solid ${T.gold}30`}}><i className="ti ti-wand" style={{fontSize:24,color:T.gold}}/></div>
        <div style={{fontSize:18,fontWeight:600}}>Teach your bot about your business</div>
        <div style={{fontSize:12.5,color:T.textMuted,marginTop:4}}>Step 2 of 3 — write it in your own words and AI does the rest</div>
      </div>

      <Inp textarea label="Tell us about your business *" value={q.description}
        onChange={e=>setQ({...q,description:e.target.value})}
        inputStyle={{minHeight:150,lineHeight:1.65}}
        placeholder={isEcom
          ? "What do you sell? What are your prices? How do you deliver and take payment? Anything customers always ask?"
          : "What services do you offer? What do they cost? How do clients book you? Anything clients always ask?"}/>
      <div style={{fontSize:11.5,color:T.textDim,marginTop:-8,marginBottom:14,lineHeight:1.6}}>
        Write it like you are explaining to a new employee on their first day. Bangla, English or a mix — all fine.
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:11.5,color:T.textMuted,marginBottom:8}}>Not sure what to write? Start from an example and edit it:</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {EXAMPLES.map(ex=><button key={ex.label} onClick={()=>setQ({...q,description:ex.text})}
            style={{padding:"6px 13px",borderRadius:20,border:`1px solid ${T.border}`,background:T.bgAlt,color:T.textMuted,fontSize:12,cursor:"pointer"}}>
            {ex.label}
          </button>)}
        </div>
      </div>

      <div onClick={()=>setShowMore(v=>!v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"11px 13px",borderRadius:9,background:T.bgAlt,border:`0.5px solid ${T.border}`,marginBottom:showMore?16:18}}>
        <span style={{fontSize:12.5,color:T.text}}>Add more details <span style={{color:T.textDim}}>— optional, improves accuracy</span></span>
        <i className={`ti ti-chevron-${showMore?"up":"down"}`} style={{fontSize:15,color:T.textMuted}}/>
      </div>

      {showMore&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Bot tone</label>
            <select value={q.tone} onChange={e=>setQ({...q,tone:e.target.value})} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:13.5}}>
              {["Friendly and helpful","Professional and formal","Casual and fun"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Customer languages</label>
            <select value={q.languages} onChange={e=>setQ({...q,languages:e.target.value})} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:13.5}}>
              {["Bangla and English","Bangla only","English only"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <Inp label="Working hours" value={q.hours} onChange={e=>setQ({...q,hours:e.target.value})} placeholder="e.g. Everyday 10am-10pm"/>
        <Inp label="Catalog / website link" value={q.catalogLink} onChange={e=>setQ({...q,catalogLink:e.target.value})} placeholder="e.g. www.yourshop.com"/>
        <Inp label="Special brand rules" value={q.special} onChange={e=>setQ({...q,special:e.target.value})} placeholder="e.g. Address customers as আপনি, never say নমস্কার"/>
        <Inp textarea label="Common questions & answers" value={q.faq} onChange={e=>setQ({...q,faq:e.target.value})} placeholder={"Q: Do you have a physical shop?\nA: No, we are online only."}/>
      </>}

      {err&&<div style={{fontSize:12,color:T.danger,marginBottom:10}}>{err}</div>}
      <Btn gold onClick={()=>trainBot(false)} disabled={busy} style={{width:"100%",marginBottom:8}}><i className="ti ti-sparkles" style={{marginRight:6}}/>{busy?"Building your bot...":"Generate my bot"}</Btn>
      <div onClick={()=>!busy&&trainBot(true)} style={{textAlign:"center",fontSize:12.5,color:T.textMuted,cursor:"pointer"}}>Skip for now</div>
    </Card>
  </div>;

  if(step==="preview") return <div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <Card style={{maxWidth:620,width:"100%",padding:"1.8rem 1.6rem",maxHeight:"92dvh",overflowY:"auto"}}>
      <div style={{textAlign:"center",marginBottom:18}}>
        <div style={{width:52,height:52,borderRadius:14,background:`${T.success}15`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",border:`1px solid ${T.success}35`}}><i className="ti ti-check" style={{fontSize:26,color:T.success}}/></div>
        <div style={{fontSize:18,fontWeight:600}}>Your bot is trained</div>
        <div style={{fontSize:12.5,color:T.textMuted,marginTop:4}}>This is what it now knows about your business. Change anything that is not right.</div>
      </div>

      <Inp textarea value={preview} onChange={e=>setPreview(e.target.value)} inputStyle={{minHeight:260,fontSize:12.8,lineHeight:1.7}}/>

      <div style={{fontSize:11.5,color:T.textDim,marginBottom:16,lineHeight:1.6}}>
        <i className="ti ti-lock" style={{marginRight:5}}/>
        Platform rules — reply format, language matching and never guessing prices — are always applied on top of this and cannot be removed.
      </div>

      {err&&<div style={{fontSize:12,color:T.danger,marginBottom:10}}>{err}</div>}
      <Btn gold onClick={savePreview} disabled={busy} style={{width:"100%",marginBottom:10}}>{busy?"Saving...":"Looks good — continue"}</Btn>
      <div style={{display:"flex",gap:10,justifyContent:"center",fontSize:12.5}}>
        <span onClick={()=>!busy&&trainBot(false)} style={{color:T.gold,cursor:"pointer"}}>Regenerate</span>
        <span style={{color:T.textDim}}>·</span>
        <span onClick={()=>!busy&&setStep("train")} style={{color:T.textMuted,cursor:"pointer"}}>Edit my answers</span>
      </div>
    </Card>
  </div>;

  return <div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{maxWidth:640,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:20,fontWeight:600}}>Welcome, {form.business_name||c.business_name}</div>
        <div style={{fontSize:13,color:T.textMuted}}>Step 3 of 3 — choose how you want to start</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>
        <Card style={{textAlign:"center",padding:"2rem 1.5rem",cursor:"pointer"}} onClick={onDemo}>
          <i className="ti ti-message-chatbot" style={{fontSize:34,color:T.gold}}/>
          <div style={{fontSize:16,fontWeight:600,margin:"12px 0 6px"}}>Try Demo</div>
          <div style={{fontSize:12.5,color:T.textMuted}}>Chat with the Autologic Demo Bot — learn every feature instantly. No setup needed.</div>
        </Card>
        <Card style={{textAlign:"center",padding:"2rem 1.5rem",cursor:"pointer",border:`1px solid ${T.gold}50`}} onClick={startTrial}>
          <i className="ti ti-rocket" style={{fontSize:34,color:T.gold}}/>
          <div style={{fontSize:16,fontWeight:600,margin:"12px 0 6px"}}>{busy?"Starting...":"Start 3-Day Free Trial"}</div>
          <div style={{fontSize:12.5,color:T.textMuted}}>All features unlocked. 30 messages/day. Connect Facebook, Instagram or WhatsApp.</div>
        </Card>
      </div>
    </div>
  </div>;
}

function ConnectChannel({onDone,clientId}) {
  useEffect(()=>{
    const h=e=>{if(e.data==="fb_connected"||e.data==="ig_connected")onDone();};
    window.addEventListener("message",h);
    return ()=>window.removeEventListener("message",h);
  },[]);
  const openPopup=(url,name)=>{
    if(typeof window!=="undefined") window.location.href=url;
  };
  const fbConnect=()=>openPopup(`/api/fb/login?client_id=${clientId}`,"fbconnect");
  const igConnect=()=>openPopup(`/api/ig/login?client_id=${clientId}`,"igconnect");
  const [platform,setPlatform]=useState(null);
  const [pageId,setPageId]=useState("");
  const [token,setToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const opts=[
    {id:"facebook",icon:"ti-brand-facebook",label:"Facebook Page",hint:"One click connect with Facebook login"},
    {id:"instagram",icon:"ti-brand-instagram",label:"Instagram Business",hint:"One click connect with Instagram login"},
    {id:"whatsapp",icon:"ti-brand-whatsapp",label:"WhatsApp Business",hint:"Phone Number ID + WhatsApp Cloud API Token"},
  ];
  const handleClick=(id)=>{
    if(id==="facebook") fbConnect();
    else if(id==="instagram") igConnect();
    else setPlatform(id);
  };
  const connect=async()=>{
    if(!pageId||!token||busy) return;
    setBusy(true); setErr("");
    const r=await api("/api/channels",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform,page_id:pageId,access_token:token})}).then(r=>r.json()).catch(()=>({error:"network"}));
    setBusy(false);
    if(r.error) setErr(r.error);
    else onDone();
  };
  return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{maxWidth:560,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:18,fontWeight:600}}>Connect a channel</div>
        <div style={{fontSize:12.5,color:T.textMuted}}>Your bot will reply to customers on this channel</div>
      </div>
      {!platform?<div style={{display:"flex",flexDirection:"column",gap:12}}>
        {opts.map(o=><Card key={o.id} style={{display:"flex",alignItems:"center",gap:14,cursor:"pointer",padding:"1rem 1.2rem"}} onClick={()=>handleClick(o.id)}>
          <i className={`ti ${o.icon}`} style={{fontSize:26,color:T.gold}}/>
          <div><div style={{fontSize:14,fontWeight:500}}>{o.label}</div><div style={{fontSize:11.5,color:T.textMuted}}>{o.hint}</div></div>
        </Card>)}
        <div style={{textAlign:"center",fontSize:12,color:T.textMuted,cursor:"pointer",marginTop:8}} onClick={onDone}>Skip for now</div>
      </div>:<Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:12,textTransform:"capitalize"}}>{platform} connection</div>
        <Inp value={pageId} onChange={e=>setPageId(e.target.value)} placeholder={platform==="whatsapp"?"Phone Number ID":"Page / Account ID"}/>
        <Inp value={token} onChange={e=>setToken(e.target.value)} placeholder="Access Token"/>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={()=>setPlatform(null)}>Back</Btn>
          <Btn gold onClick={connect} style={{flex:1}}>{busy?"Connecting...":"Connect"}</Btn>
        </div>
        {err&&<div style={{fontSize:12,color:T.danger,marginTop:10}}>{err}</div>}
      </Card>}
    </div>
  </div>;
}

export default function Dashboard() {
  const isMobile=useIsMobile();
  const [chatOpen,setChatOpen]=useState(false);
  const [page,setPageRaw]=useState("analytics");
  const [upgradeIntent,setUpgradeIntent]=useState({plan:null,cycle:"monthly"});
  const setPage=(p)=>{
    setPageRaw(p);
    if(typeof window!=="undefined") window.history.pushState({page:p},"","#"+p);
  };
  useEffect(()=>{
    const onPop=(e)=>{ if(e.state?.page) setPageRaw(e.state.page); };
    window.addEventListener("popstate",onPop);
    const params=new URLSearchParams(window.location.search);
    const up=params.get("upgrade");
    if(up&&["starter","pro","agency"].includes(up)){
      setUpgradeIntent({plan:up,cycle:params.get("cycle")==="yearly"?"yearly":"monthly"});
      setPageRaw("billing");
      window.history.replaceState({page:"billing"},"","#billing");
      return;
    }
    const h=window.location.hash.replace("#","");
    if(h) setPageRaw(h);
    window.history.replaceState({page:window.location.hash.replace("#","")||"analytics"},"","");
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);
  const [products,setProducts]=useState([]);
  const [convos,setConvos]=useState([]);
  const [dashChannels,setDashChannels]=useState([]);
  const [orders,setOrders]=useState([]);
  const [bookingCount,setBookingCount]=useState(0);
  const [settings,setSettings]=useState({botName:"Autologic Bot",businessName:"My Business",systemPrompt:"You are a helpful sales assistant.",greeting:"Hello! How can I help?"});
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [authed,setAuthed]=useState(false);
  const [authChecked,setAuthChecked]=useState(false);
  const [me,setMe]=useState(null);
  const [stage,setStage]=useState("loading");
  const bt=me?.client?.business_type||"ecommerce";
  const isAgency=bt==="agency";
  const navLabel=(i)=>{
    const p=PAGES[i];
    if(p==="inventory") return isAgency?"Knowledge Base":words(bt).inv;
    if(p==="orders") return isAgency?"Bookings":words(bt).order;
    return LABELS[i];
  };

  const loadMe=async()=>{
    const d=await api("/api/me").then(r=>r.json()).catch(()=>null);
    setMe(d);
    if(!d||d.error){setStage("auth");return;}
    if(!d.client){
      await api("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"register",business_name:(d.email||"My Business").split("@")[0]})});
      const d2=await api("/api/me").then(r=>r.json()).catch(()=>null);
      if(!d2||!d2.client){setStage("auth");return;}
      setMe(d2);
      setStage(d2.client.plan==="none"?"onboarding":"app");
      return;
    }
    if(d.client.plan==="none") setStage("onboarding");
    else setStage("app");
  };

  useEffect(()=>{
    (async()=>{
      const { data:{ session } }=await getSb().auth.getSession();
      if(session){AUTH_TOKEN=session.access_token;setAuthed(true);await loadMe();}
      else setStage("auth");
      setAuthChecked(true);
    })();
  },[]);

  useEffect(()=>{
    const h=()=>loadMe();
    window.addEventListener("logo-updated",h);
    return ()=>window.removeEventListener("logo-updated",h);
  },[]);

  const load=async(silent)=>{
    if(!silent)setLoading(true);
    try {
      // Silent refreshes (realtime broadcast + fallback poll) only need conversations,
      // which is the only data that changes live. Avoids re-fetching products/orders/
      // settings/channels on every poll.
      if(silent){
        const cv=await api("/api/conversations").then(r=>r.json()).catch(()=>null);
        if(Array.isArray(cv)) setConvos(cv);
        return;
      }
      const [pr,cv,or,st,ch]=await Promise.all([
        api("/api/products").then(r=>r.json()).catch(()=>[]),
        api("/api/conversations").then(r=>r.json()).catch(()=>[]),
        api("/api/orders").then(r=>r.json()).catch(()=>[]),
        api("/api/settings").then(r=>r.json()).catch(()=>({})),
        api("/api/channels").then(r=>r.json()).catch(()=>[]),
      ]);
      if(Array.isArray(pr)) setProducts(pr);
      if(Array.isArray(cv)) setConvos(cv);
      if(Array.isArray(or)) setOrders(or);
      if(st&&Object.keys(st).length) setSettings(s=>({...s,...st}));
      if(Array.isArray(ch)) setDashChannels(ch);
      if(bt==="agency"){
        const bk=await api("/api/bookings").then(r=>r.json()).catch(()=>[]);
        if(Array.isArray(bk)) setBookingCount(bk.length);
      }
    } catch {}
    if(!silent)setLoading(false);
  };

  useEffect(()=>{if(authed&&stage==="app")load();},[authed,stage]);
  useEffect(()=>{
    if(!authed||stage!=="app") return;
    const t=setInterval(()=>load(true),10000);
    return ()=>clearInterval(t);
  },[authed,stage]);

  if(!authChecked||stage==="loading") return null;
  if(stage==="auth") return <AuthGate onReady={async()=>{setAuthed(true);await loadMe();}}/>;
  if(stage==="onboarding") return <Onboarding me={me} onDemo={()=>{setStage("app");setPage("demo");}} onTrial={async()=>{await loadMe();setStage("connect");}}/>;
  if(stage==="connect") return <ConnectChannel clientId={me?.client?.id} onDone={async()=>{await loadMe();setStage("app");}}/>;

  return <div style={{display:"flex",height:isMobile?"100dvh":"100vh",overflow:"hidden"}}>
    {sidebarOpen&&isMobile&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:40}}/>}
    <div style={{position:"fixed",zIndex:50,height:"100%",width:240,background:T.card,borderRight:`0.5px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,transform:sidebarOpen?"translateX(0)":"translateX(-100%)",transition:"transform 0.25s ease",left:0,top:0}}>
      <div style={{padding:"20px",display:"flex",alignItems:"center",gap:12,borderBottom:`0.5px solid ${T.border}`}}>
        <div style={{width:36,height:36,borderRadius:10,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${T.gold}30`,overflow:"hidden"}}>{me?.client?.logo_url?<img src={me.client.logo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<i className="ti ti-bolt" style={{fontSize:18,color:T.gold}}/>}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{me?.client?.business_name||"Autologic"}</div><div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:1.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{settings?.botName||"chatbot"}</div></div>
        <i onClick={()=>setSidebarOpen(false)} className="ti ti-x" style={{fontSize:18,color:T.textDim,cursor:"pointer"}}/>
      </div>
      <nav style={{flex:1,padding:"12px 8px",overflowY:"auto"}}>
        {PAGES.map((p,i)=><div key={p} onClick={()=>{setPage(p);if(isMobile)setSidebarOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:8,cursor:"pointer",marginBottom:2,background:page===p?T.goldBg:"transparent",borderLeft:page===p?`3px solid ${T.gold}`:"3px solid transparent",color:page===p?T.gold:T.textMuted}}>
          <i className={`ti ${isAgency&&p==="inventory"?"ti-database":isAgency&&p==="orders"?"ti-calendar-event":ICONS[i]}`} style={{fontSize:18,flexShrink:0}}/>
          <span style={{fontSize:13.5,fontWeight:page===p?500:400}}>{navLabel(i)}</span>
          {p==="conversations"&&convos.some(c=>c.status==="active")&&<div style={{marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:T.success,animation:"pulse 2s infinite"}}/>}
        </div>)}
      </nav>
    </div>

    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0,marginLeft:(!isMobile&&sidebarOpen)?240:0,transition:"margin-left 0.25s ease"}}>
      {!(isMobile&&chatOpen)&&<div style={{padding:isMobile?"12px 16px":"14px 24px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:14,minWidth:0}}>
          <i onClick={()=>setSidebarOpen(true)} className="ti ti-menu-2" style={{fontSize:22,color:T.text,cursor:"pointer",flexShrink:0}}/>
          <div style={{minWidth:0}}><div style={{fontSize:isMobile?16:18,fontWeight:600}}>{navLabel(PAGES.indexOf(page))}</div>{!isMobile&&<div style={{fontSize:12,color:T.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{me?.client?.business_name} - {me?.client?.plan==='trial'?`Trial: ${me?.usage?.today??0}/30 msgs today`:`${products.length} ${words(bt).item.toLowerCase()}s`}</div>}</div>
        </div>
        <Btn small onClick={()=>load(false)} disabled={loading}><i className="ti ti-refresh" style={{marginRight:4,display:"inline-block",animation:loading?"spin 0.8s linear infinite":"none"}}/>{loading?"Syncing":"Sync"}</Btn>
      </div>
      }<div style={{flex:1,overflow:"auto",padding:isMobile&&chatOpen?0:(isMobile?12:24),minHeight:0}}>
        {loading?<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60,flexDirection:"column",gap:16}}><div style={{width:32,height:32,border:`3px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontSize:13,color:T.textMuted}}>Loading from Supabase...</span></div>:(
          <>
            {page==="analytics"&&<Analytics isAgency={isAgency}/>}
            {page==="conversations"&&<Conversations convos={convos} refresh={load} onChatOpen={setChatOpen} channels={dashChannels}/>}
            {page==="inventory"&&(isAgency?<KnowledgeBase/>:<Inventory products={products} refresh={load}/>)}
            {page==="orders"&&(isAgency?<Bookings/>:<Orders orders={orders} refresh={load}/>)}
            {page==="channels"&&<Channels onConnect={()=>setStage("connect")}/>}
            {page==="billing"&&<Billing initialPlan={upgradeIntent.plan} initialCycle={upgradeIntent.cycle}/>}
            {page==="profile"&&<Profile/>}
            {page==="settings"&&<Settings settings={settings} setSettings={setSettings}/>}
            {page==="demo"&&<Demo onBack={()=>setPage("analytics")}/>}
          </>
        )}
      </div>
    </div>
  </div>;
}
