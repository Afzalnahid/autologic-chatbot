"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Inp, Badge, PLAN_META, PLAN_LIST, taka, shortDate } from "./ui.js";
import { api } from "./session.js";
import { priceForClient } from "@/lib/plans.js";

// The Billing tab, moved out of dashboard-client.js unchanged.

export default function Billing({initialPlan,initialCycle}) {
  const [d,setD]=useState(null);
  const [loading,setLoading]=useState(true);
  const [step,setStep]=useState(initialPlan?"pay":"plans");
  const [sel,setSel]=useState(initialPlan||null);
  const [cycle,setCycle]=useState(initialCycle==="yearly"?"yearly":"monthly");
  const [method,setMethod]=useState("");
  const [senderNo,setSenderNo]=useState("");
  const [txn,setTxn]=useState("");
  const [busy,setBusy]=useState(false);
  const [onlineBusy,setOnlineBusy]=useState(false);
  const [err,setErr]=useState("");
  const [copied,setCopied]=useState("");

  // Packages come live from the admin panel (/api/plans), so a new or re-priced
  // plan shows up to upgrade without a deploy. PLAN_LIST is the fallback.
  const [plans,setPlans]=useState(PLAN_LIST);
  const [planMeta,setPlanMeta]=useState(PLAN_META);
  const load=useCallback(async()=>{
    try{
      const r=await api(`/api/billing?t=${Date.now()}`,{cache:"no-store"});
      const j=await r.json();
      if(!j.error){setD(j); if(j.methods?.length&&!method) setMethod(j.methods[0].id);}
    }catch{}
    setLoading(false);
  },[method]);
  useEffect(()=>{load();},[]);
  useEffect(()=>{
    api("/api/plans").then(r=>r.json()).then(d=>{
      if(Array.isArray(d?.plans)&&d.plans.length) setPlans(d.plans.filter(p=>Number(p.monthly)>0));
      // The plan list arrives before the account does, so the business type is
      // applied where the list is READ rather than here — see `buyable` below.
      if(d?.meta) setPlanMeta({...PLAN_META,...d.meta});
    }).catch(()=>{});
  },[]);

  // Start a hosted SSLCommerz checkout and hand the browser to the gateway. On
  // success the gateway redirects back to /api/billing/callback, which verifies
  // and activates the plan — nothing to submit here.
  const payOnline=async()=>{
    if(onlineBusy) return;
    if(!sel){setErr("Choose a plan first");return;}
    setOnlineBusy(true);setErr("");
    try{
      const r=await api("/api/billing/checkout",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({plan:sel,cycle})});
      const j=await r.json();
      if(j.error){setErr(j.error);setOnlineBusy(false);}
      else if(j.url){window.location.href=j.url;}
      else{setErr("Could not start the payment. Please try again.");setOnlineBusy(false);}
    }catch{setErr("Could not start the payment. Please try again.");setOnlineBusy(false);}
  };

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
  // A client on their own AI key pays the lower BYOK price wherever a package
  // sets one. priceOf is the effective price (shared with the server via
  // priceForClient, so the screen and the charge agree); stdOf is the standard
  // price, shown struck through when it differs so the saving is visible.
  const ownKey=!!d.own_key;
  const priceOf=(p,c=cycle)=>priceForClient(p,c,ownKey);
  const stdOf=(p,c=cycle)=>c==="yearly"?Number(p.yearly||0):Number(p.monthly||0);
  const u=d.usage;
  const limit=u.daily_limit||u.monthly_limit;
  const usedNow=u.daily_limit?u.today:u.month;
  const expiry=d.plan==="trial"?d.trial_end:d.plan_expires_at;
  const daysLeft=expiry?Math.ceil((new Date(expiry)-new Date())/86400000):null;
  // Live catalogue, not the static fallback — an admin-created package must be
  // pickable and priced on this screen too.
  // Only the packages this business may buy. A package with no type — the
  // trial, and any row written before the biz column — belongs to both sides,
  // because showing one to everybody beats hiding it from the people it was
  // written for. The account may not have loaded yet, and until it does every
  // package is shown rather than none.
  const buyable=d?.business_type
    ?plans.filter(p=>!p.biz||p.biz==="both"||p.biz===d.business_type)
    :plans;
  const selPlan=buyable.find(p=>p.id===sel);
  const amount=selPlan?priceOf(selPlan):0;

  return <div style={{maxWidth:900,margin:"0 auto"}}>
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
        {step!=="pay"&&<Btn gold onClick={()=>{setSel(buyable.find(p=>p.highlight)?.id||buyable[0]?.id||null);setStep("pay");}}>
          <i className="ti ti-arrow-up-circle" style={{marginRight:6}}/>{d.plan==="none"||!d.active?"Choose a plan":"Upgrade"}
        </Btn>}
      </div>

      {limit&&<div style={{marginTop:18}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:6}}>
          <span style={{color:T.textMuted}}>{u.daily_limit?"Messages today":"Messages this month"}</span>
          {/* null means the count could not be read. Showing 0 there would tell
              somebody at their limit that they have used nothing. */}
          <span><strong>{usedNow===null||usedNow===undefined?"—":usedNow}</strong> <span style={{color:T.textDim}}>/ {limit.toLocaleString("en-IN")}</span></span>
        </div>
        <div style={{height:6,background:T.bgAlt,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:u.pct===null||u.pct===undefined?"0%":`${Math.min(100,u.pct)}%`,background:(u.pct||0)>90?T.danger:(u.pct||0)>70?T.warn:T.success,borderRadius:3}}/>
        </div>
        {(u.pct||0)>=90&&<div style={{fontSize:11.5,color:T.warn,marginTop:8}}>
          <i className="ti ti-alert-triangle" style={{marginRight:5}}/>You are close to your limit. Upgrade to keep the bot replying.
        </div>}
      </div>}
      {!limit&&d.active&&<div style={{fontSize:12.5,color:T.success,marginTop:14}}><i className="ti ti-infinity" style={{marginRight:5}}/>Unlimited messages on this plan</div>}
    </Card>

    {/* On their own AI key → the reduced price list. Neutral styling on purpose:
        mint means "bot is live" and nothing else, and gold is retired. */}
    {ownKey&&<Card style={{marginBottom:16}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <i className="ti ti-key" style={{fontSize:18,color:T.text,marginTop:2}}/>
        <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7}}>
          You're using your own AI key, so you pay the lower <strong style={{color:T.text}}>own-key price</strong> on every plan below — you cover the AI usage directly.
        </div>
      </div>
    </Card>}

    {/* Pending review */}
    {d.pending_request&&<Card style={{marginBottom:16,border:`1px solid color-mix(in srgb, ${T.warn} 27%, transparent)`}}>
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
        {buyable.map(p=><div key={p.id} onClick={()=>setSel(p.id)} style={{
          cursor:"pointer",padding:"14px 14px",borderRadius:11,background:T.bgAlt,
          border:`1px solid ${sel===p.id?T.gold:T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:14,fontWeight:600}}>{p.name}</span>
            {p.highlight&&<Badge>Popular</Badge>}
          </div>
          <div style={{fontSize:19,fontWeight:700,marginTop:6}}>{taka(priceOf(p))}
            <span style={{fontSize:11.5,color:T.textMuted,fontWeight:400}}>/{cycle==="yearly"?"yr":"mo"}</span>
            {ownKey&&priceOf(p)!==stdOf(p)&&<span style={{fontSize:11.5,color:T.textDim,fontWeight:400,textDecoration:"line-through",marginLeft:6}}>{taka(stdOf(p))}</span>}</div>
          <div style={{fontSize:11.5,color:T.textMuted,marginTop:3}}>{p.tagline}</div>
        </div>)}
      </div>

      <div style={{display:"inline-flex",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:9,padding:3,gap:3,marginBottom:18}}>
        {[["monthly","Monthly"],["yearly","Yearly · 2 months free"]].map(([id,l])=>
          <button key={id} onClick={()=>setCycle(id)} style={{padding:"7px 14px",borderRadius:7,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:600,
            background:cycle===id?T.gold:"transparent",color:cycle===id?"#fff":T.textMuted}}>{l}</button>)}
      </div>

      {/* Online checkout — shown only when the gateway is configured. */}
      {d.online&&<>
        <Btn gold onClick={payOnline} disabled={onlineBusy||!sel} style={{width:"100%",marginBottom:12}}>
          <i className="ti ti-credit-card" style={{marginRight:6}}/>{onlineBusy?"Starting secure checkout…":`Pay online (card / mobile banking) · ${taka(amount)}`}
        </Btn>
        {d.methods.length>0&&<div style={{display:"flex",alignItems:"center",gap:10,margin:"2px 0 16px",color:T.textDim,fontSize:11.5}}>
          <div style={{flex:1,height:1,background:T.border}}/>or pay manually with bKash / Nagad<div style={{flex:1,height:1,background:T.border}}/>
        </div>}
      </>}

      {/* how to pay */}
      {d.methods.length===0
        ? <div style={{fontSize:13,color:T.warn,background:`color-mix(in srgb, ${T.warn} 7%, transparent)`,border:`1px solid color-mix(in srgb, ${T.warn} 20%, transparent)`,borderRadius:10,padding:"14px 16px"}}>
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
      {buyable.map(p=><Card key={p.id} style={{border:p.highlight?`1px solid color-mix(in srgb, ${T.gold} 33%, transparent)`:undefined,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:16,fontWeight:600}}>{p.name}</span>
          {d.plan===p.id?<Badge color={T.success}>Current</Badge>:p.highlight?<Badge>Popular</Badge>:null}
        </div>
        <div style={{fontSize:24,fontWeight:700,margin:"10px 0 2px"}}>{taka(priceOf(p,"monthly"))}<span style={{fontSize:12,color:T.textMuted,fontWeight:400}}>/month</span>
          {ownKey&&priceOf(p,"monthly")!==stdOf(p,"monthly")&&<span style={{fontSize:13,color:T.textDim,fontWeight:400,textDecoration:"line-through",marginLeft:7}}>{taka(stdOf(p,"monthly"))}</span>}</div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:12}}>or {taka(priceOf(p,"yearly"))}/year</div>
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
            <td style={{padding:"10px 0"}}>{planMeta[r.plan]?.name||PLAN_META[r.plan]?.name||r.plan}<span style={{color:T.textDim,fontSize:11}}> · {r.billing_cycle}</span></td>
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
