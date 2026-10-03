"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Inp, Badge, PLAN_META, PLAN_LIST, taka, shortDate } from "./ui.js";
import { api } from "./session.js";
import { quotePlan, quoteTopUp, addonPrice, planPrice, hasByokPrice, MAX_ADDON_QTY } from "@/lib/pricing.js";
import UsageMeters from "./UsageMeters.js";

// The Billing tab (owner, 2026-10-03). A purchase is a basket:
//   · a package, as Standard (our AI) or Own AI key (BYOK — every AI call runs
//     on the customer's own Google Gemini / OpenAI key, so it costs less),
//   · monthly or yearly (ten months),
//   · optional add-ons — more replies, AI Assistant questions, products (shops)
//     or documents (services) — each with a count.
// Add-ons can also be bought on their own in the middle of a running package;
// they cost only the days that are left, and renew with the package after that.
//
// The screen totals the basket with lib/pricing.js — the same code the server
// charges with (lib/billing-basket.js) — and never sends an amount.

// Bangla-free on purpose: the dashboard is English by default (dashboard rule).
const KIND_ICON = { replies: "ti-message-dots", assistant: "ti-sparkles", products: "ti-package", docs: "ti-file-text" };

function Stepper({ value, onChange, max = MAX_ADDON_QTY }) {
  const b = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, cursor: "pointer", fontSize: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 };
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <button type="button" aria-label="One fewer" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} style={{ ...b, opacity: value <= 0 ? .4 : 1 }}>−</button>
    <span style={{ minWidth: 18, textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    <button type="button" aria-label="One more" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} style={{ ...b, opacity: value >= max ? .4 : 1 }}>+</button>
  </div>;
}

// The add-on list with a count each. `unit(a)` is the price shown per add-on.
function AddonPicker({ addons, picks, setPicks, unit, per }) {
  if (!addons?.length) return null;
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {addons.map((a) => {
      const q = Number(picks[a.id] || 0);
      return <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: T.bgAlt, border: `1px solid ${q ? T.gold : T.border}` }}>
        <i className={`ti ${KIND_ICON[a.kind] || "ti-plus"}`} style={{ fontSize: 18, color: T.textMuted, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.name}</div>
          <div style={{ fontSize: 11.5, color: T.textMuted }}>{taka(unit(a))} {per}</div>
        </div>
        <Stepper value={q} onChange={(n) => setPicks({ ...picks, [a.id]: n })} />
      </div>;
    })}
  </div>;
}

// The lines of a quote, then the total.
function Summary({ lines, total, note }) {
  return <div style={{ background: T.bgAlt, border: `0.5px solid ${T.border}`, borderRadius: 11, padding: "12px 14px", marginBottom: 16 }}>
    {lines.map((l, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "3px 0", color: l.type === "plan" ? T.text : T.textMuted }}>
      <span>{l.name}{l.qty > 1 ? ` × ${l.qty}` : ""}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{taka(l.amount)}</span>
    </div>)}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: `1px solid ${T.border}`, marginTop: 8, paddingTop: 8 }}>
      <span style={{ fontSize: 13, color: T.textMuted }}>Total</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: T.gold, fontVariantNumeric: "tabular-nums" }}>{taka(total)}</span>
    </div>
    {note && <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 6, lineHeight: 1.6 }}>{note}</div>}
  </div>;
}

export default function Billing({initialPlan,initialCycle}) {
  const [d,setD]=useState(null);
  const [loading,setLoading]=useState(true);
  // "plans" (the cards), "pay" (buy or renew a package), "addons" (add-ons on a running package)
  const [step,setStep]=useState(initialPlan?"pay":"plans");
  const [sel,setSel]=useState(initialPlan||null);
  const [cycle,setCycle]=useState(initialCycle==="yearly"?"yearly":"monthly");
  const [byok,setByok]=useState(false);
  const [picks,setPicks]=useState({});
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
  // A renewal starts from the package as it is today: own key or not, and the
  // add-ons that renew with it.
  useEffect(()=>{ if(d){ setByok(!!d.byok_plan); } },[d?.byok_plan]);

  const copy=async(t,id)=>{
    try{await navigator.clipboard.writeText(t);setCopied(id);setTimeout(()=>setCopied(""),1500);}catch{}
  };

  if(loading) return <div style={{padding:40,textAlign:"center",color:T.textMuted,fontSize:13}}>Loading billing...</div>;
  if(!d) return <Card style={{textAlign:"center",color:T.textDim,padding:40}}>Could not load billing information.</Card>;

  const u=d.usage;
  const limit=u.daily_limit||u.monthly_limit;
  const usedNow=u.daily_limit?u.today:u.month;
  const expiry=d.plan==="trial"?d.trial_end:d.plan_expires_at;
  const daysLeft=expiry?Math.ceil((new Date(expiry)-new Date())/86400000):null;
  const addonCatalogue=d.addon_catalogue||[];
  const currentAddons=d.addons||{};
  const addonName=(id)=>addonCatalogue.find(a=>a.id===id)?.name||id;
  // Live catalogue, not the static fallback — an admin-created package must be
  // pickable and priced on this screen too. Only the packages this business may
  // buy; a package with no type (the trial, old rows) belongs to both sides.
  const buyable=d?.business_type
    ?plans.filter(p=>!p.biz||p.biz==="both"||p.biz===d.business_type)
    :plans;
  const selPlan=buyable.find(p=>p.id===sel);
  const currentPlan=plans.find(p=>p.id===d.plan);
  const paidAndActive=!!(currentPlan&&Number(currentPlan.monthly)>0&&d.active);

  // The basket being bought, priced exactly as the server will price it.
  const planQuote=selPlan?quotePlan({plan:selPlan,cycle,byok:byok&&hasByokPrice(selPlan),picks,addons:addonCatalogue}):null;
  const topUpQuote=paidAndActive?quoteTopUp({
    client:{plan:d.plan,plan_expires_at:d.plan_expires_at,byok_plan:d.byok_plan,billing_cycle:d.billing_cycle},
    plan:currentPlan,picks,addons:addonCatalogue}):null;
  const quote=step==="addons"?topUpQuote:planQuote;
  const amount=quote?.ok?quote.total:0;
  const basketBody=step==="addons"
    ?{kind:"addon",addons:picks}
    :{kind:"plan",plan:sel,cycle,byok:byok&&!!selPlan&&hasByokPrice(selPlan),addons:picks};

  const openPay=(planId)=>{
    setSel(planId);setErr("");
    // Renewing the same package keeps its add-ons ticked; a different package starts clean.
    setPicks(planId===d.plan?{...currentAddons}:{});
    setByok(!!d.byok_plan);
    setStep("pay");
  };
  const openAddons=()=>{setPicks({});setErr("");setStep("addons");};

  // Start a hosted SSLCommerz checkout and hand the browser to the gateway. On
  // success the gateway redirects back to /api/billing/callback, which verifies
  // and applies the purchase — nothing to submit here.
  const payOnline=async()=>{
    if(onlineBusy) return;
    if(!quote?.ok){setErr(quote?.error||"Choose a plan first");return;}
    setOnlineBusy(true);setErr("");
    try{
      const r=await api("/api/billing/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(basketBody)});
      const j=await r.json();
      if(j.error){setErr(j.error);setOnlineBusy(false);}
      else if(j.url){window.location.href=j.url;}
      else{setErr("Could not start the payment. Please try again.");setOnlineBusy(false);}
    }catch{setErr("Could not start the payment. Please try again.");setOnlineBusy(false);}
  };

  const submit=async()=>{
    if(busy) return;
    if(!quote?.ok){setErr(quote?.error||"Choose a plan first");return;}
    if(!txn.trim()){setErr("Enter the transaction ID from your payment receipt");return;}
    setBusy(true);setErr("");
    try{
      const r=await api("/api/billing",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...basketBody,method,sender_number:senderNo,txn_id:txn})});
      const j=await r.json();
      if(j.error){setErr(j.error);}
      else{setTxn("");setSenderNo("");setPicks({});setStep("plans");await load();}
    }catch{setErr("Could not submit. Please try again.");}
    setBusy(false);
  };

  // How to pay — the same for a package and for add-ons.
  const paySection=<>
    {/* One place for the error, whichever way they pay. */}
    {err&&<div role="alert" style={{fontSize:12.5,color:T.danger,marginBottom:12}}>{err}</div>}
    {d.online&&<>
      <Btn gold onClick={payOnline} disabled={onlineBusy||!quote?.ok} style={{width:"100%",marginBottom:12}}>
        <i className="ti ti-credit-card" style={{marginRight:6}}/>{onlineBusy?"Starting secure checkout…":`Pay online (card / mobile banking) · ${taka(amount)}`}
      </Btn>
      {d.methods.length>0&&<div style={{display:"flex",alignItems:"center",gap:10,margin:"2px 0 16px",color:T.textDim,fontSize:11.5}}>
        <div style={{flex:1,height:1,background:T.border}}/>or pay manually with bKash / Nagad<div style={{flex:1,height:1,background:T.border}}/>
      </div>}
    </>}
    {d.methods.length===0
      ? <div style={{fontSize:13,color:T.warn,background:`color-mix(in srgb, ${T.warn} 7%, transparent)`,border:`1px solid color-mix(in srgb, ${T.warn} 20%, transparent)`,borderRadius:10,padding:"14px 16px"}}>
          <i className="ti ti-alert-circle" style={{marginRight:6}}/>Payment numbers are not configured yet. Please contact support at nahidafzal97@gmail.com to complete your purchase.
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
          After sending the money, enter the transaction ID from your payment app below. We verify it and apply your purchase — usually within a few hours.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          <Inp label="Your number (optional)" value={senderNo} onChange={e=>setSenderNo(e.target.value)} placeholder="01XXXXXXXXX"/>
          <Inp label="Transaction ID *" value={txn} onChange={e=>setTxn(e.target.value)} placeholder="e.g. 9A7B2C1D5E"/>
        </div>
        <Btn gold onClick={submit} disabled={busy||!quote?.ok} style={{width:"100%"}}>
          {busy?"Submitting...":`Submit payment · ${taka(amount)}`}
        </Btn>
      </>}
  </>;

  const segBtn=(on)=>({padding:"7px 14px",borderRadius:7,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:600,background:on?T.gold:"transparent",color:on?T.onGold:T.textMuted});

  return <div style={{maxWidth:900,margin:"0 auto"}}>
    {/* Current plan */}
    <Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:11.5,color:T.textMuted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Current plan</div>
          <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
            <span style={{fontSize:22,fontWeight:700}}>{d.plan_name}</span>
            <Badge color={d.suspended?T.danger:d.active?T.success:T.danger}>{d.suspended?"Suspended":d.active?"Active":"Expired"}</Badge>
            {d.byok_plan&&<Badge color={T.textMuted}><i className="ti ti-key" style={{marginRight:4}}/>Own AI key</Badge>}
          </div>
          {expiry&&<div style={{fontSize:12.5,color:daysLeft!==null&&daysLeft<=3?T.warn:T.textMuted,marginTop:6}}>
            {d.active?`Valid until ${shortDate(expiry)}${daysLeft!==null?` · ${daysLeft} day${daysLeft===1?"":"s"} left`:""}`:`Expired on ${shortDate(expiry)}`}
          </div>}
          {Object.keys(currentAddons).length>0&&<div style={{fontSize:12,color:T.textMuted,marginTop:6}}>
            <i className="ti ti-plus" style={{marginRight:4}}/>Add-ons: {Object.entries(currentAddons).map(([id,q])=>`${addonName(id)}${q>1?` × ${q}`:""}`).join(" · ")}
          </div>}
        </div>
        {step==="plans"&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {paidAndActive&&addonCatalogue.length>0&&<Btn onClick={openAddons} disabled={!!d.pending_request}>
            <i className="ti ti-plus" style={{marginRight:6}}/>Buy add-ons
          </Btn>}
          <Btn gold onClick={()=>openPay(currentPlan&&Number(currentPlan.monthly)>0?d.plan:(buyable.find(p=>p.highlight)?.id||buyable[0]?.id||null))} disabled={!!d.pending_request}>
            <i className="ti ti-arrow-up-circle" style={{marginRight:6}}/>{d.plan==="none"||!d.active?"Choose a plan":paidAndActive?"Renew or change":"Upgrade"}
          </Btn>
        </div>}
      </div>

      {limit&&<div style={{marginTop:18}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:6}}>
          <span style={{color:T.textMuted}}>{u.daily_limit?"Bot replies today":"Bot replies this month"}</span>
          {/* null means the count could not be read. Showing 0 there would tell
              somebody at their limit that they have used nothing. */}
          <span><strong>{usedNow===null||usedNow===undefined?"—":usedNow}</strong> <span style={{color:T.textDim}}>/ {limit.toLocaleString("en-IN")}</span></span>
        </div>
        <div style={{height:6,background:T.bgAlt,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:u.pct===null||u.pct===undefined?"0%":`${Math.min(100,u.pct)}%`,background:(u.pct||0)>90?T.danger:(u.pct||0)>70?T.warn:T.success,borderRadius:3}}/>
        </div>
        {(u.pct||0)>=90&&<div style={{fontSize:11.5,color:T.warn,marginTop:8}}>
          <i className="ti ti-alert-triangle" style={{marginRight:5}}/>You are close to your limit. {paidAndActive?"Buy more replies as an add-on, or upgrade, to keep the bot replying.":"Upgrade to keep the bot replying."}
        </div>}
      </div>}
      {!limit&&d.active&&<div style={{fontSize:12.5,color:T.success,marginTop:14}}><i className="ti ti-infinity" style={{marginRight:5}}/>Unlimited messages on this plan</div>}
      {/* Everything else the package counts — products and documents added,
          AI Assistant questions, channels, broadcasts, website imports — with
          what is left, under the package it belongs to. Bot replies are shown
          above, so they are not repeated here. */}
      {d.entitlements?.meters?.length>0&&<div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
        <UsageMeters meters={d.entitlements.meters.filter(m=>m.key!=="messages")} period={d.entitlements.period}/>
      </div>}
    </Card>

    {/* An own-key package with no key saved: the bot is waiting. Neutral
        styling on purpose — mint means "bot is live" and nothing else. */}
    {d.byok_plan&&!d.own_key&&d.active&&<Card style={{marginBottom:16,border:`1px solid color-mix(in srgb, ${T.warn} 27%, transparent)`}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <i className="ti ti-key" style={{fontSize:18,color:T.warn,marginTop:2}}/>
        <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7}}>
          <strong style={{color:T.text}}>Add your AI key to start the bot.</strong> Your package runs on your own AI key, and none is saved yet, so the bot is waiting. Customers' messages are still saved in your inbox.
          {" "}<a href="#ai" style={{color:T.gold,fontWeight:600}}>Open AI Engine →</a>
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
            We received your {taka(d.pending_request.amount)} payment for {d.pending_request.kind==="addon"?"add-ons on":"the"} <strong style={{color:T.text}}>{planMeta[d.pending_request.plan]?.name||PLAN_META[d.pending_request.plan]?.name||d.pending_request.plan}</strong>{d.pending_request.kind==="addon"?"":" plan"}{d.pending_request.byok?" (own AI key)":""}
            {" "}(transaction <strong style={{color:T.text}}>{d.pending_request.txn_id}</strong>).
            We usually verify within a few hours and it applies automatically.
          </div>
        </div>
      </div>
    </Card>}

    {/* Buy or renew a package */}
    {step==="pay"&&<Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:10}}>
        <div style={{fontSize:15,fontWeight:600}}>{sel===d.plan&&paidAndActive?"Renew or change your plan":"Choose your plan"}</div>
        <button onClick={()=>{setStep("plans");setErr("");}} aria-label="Close" style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:18}}><i className="ti ti-x"/></button>
      </div>

      {/* 1. package */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:16}}>
        {buyable.map(p=>{
          const on=byok&&hasByokPrice(p);
          const price=planPrice(p,{cycle,byok:on});
          const std=planPrice(p,{cycle});
          return <div key={p.id} onClick={()=>{setSel(p.id);setPicks(p.id===d.plan?{...currentAddons}:{});}} style={{
            cursor:"pointer",padding:"14px 14px",borderRadius:11,background:T.bgAlt,
            border:`1px solid ${sel===p.id?T.gold:T.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
              <span style={{fontSize:14,fontWeight:600}}>{p.name}</span>
              {d.plan===p.id?<Badge color={T.success}>Current</Badge>:p.highlight&&<Badge>Popular</Badge>}
            </div>
            <div style={{fontSize:19,fontWeight:700,marginTop:6}}>{taka(price)}
              <span style={{fontSize:11.5,color:T.textMuted,fontWeight:400}}>/{cycle==="yearly"?"yr":"mo"}</span>
              {on&&price!==std&&<span style={{fontSize:11.5,color:T.textDim,fontWeight:400,textDecoration:"line-through",marginLeft:6}}>{taka(std)}</span>}</div>
            <div style={{fontSize:11.5,color:T.textMuted,marginTop:3}}>{p.tagline}</div>
          </div>;
        })}
      </div>

      {/* 2. Standard or own key, and the cycle */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:8}}>
        <div role="group" aria-label="AI" style={{display:"inline-flex",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:9,padding:3,gap:3}}>
          <button onClick={()=>setByok(false)} style={segBtn(!byok)}>Standard (our AI)</button>
          <button onClick={()=>setByok(true)} disabled={!!selPlan&&!hasByokPrice(selPlan)} style={{...segBtn(byok),opacity:selPlan&&!hasByokPrice(selPlan)?.4:1}}><i className="ti ti-key" style={{marginRight:5}}/>Own AI key</button>
        </div>
        <div role="group" aria-label="Billing cycle" style={{display:"inline-flex",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:9,padding:3,gap:3}}>
          {[["monthly","Monthly"],["yearly","Yearly · 2 months free"]].map(([id,l])=>
            <button key={id} onClick={()=>setCycle(id)} style={segBtn(cycle===id)}>{l}</button>)}
        </div>
      </div>
      <div style={{fontSize:12,color:T.textMuted,lineHeight:1.65,marginBottom:16}}>
        {byok
          ?<>With your own AI key, every AI reply runs on your own <strong style={{color:T.text}}>Google Gemini or OpenAI</strong> key and you pay the AI provider directly, so the package costs less. After payment, AI Engine opens: paste your key and choose a model. The bot starts as soon as the key is saved.</>
          :<>Standard includes the AI: nothing else to set up or pay for.{d.byok_plan?" Switching to Standard closes AI Engine and removes your saved key.":""}</>}
      </div>

      {/* 3. add-ons */}
      {addonCatalogue.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Add more <span style={{fontWeight:400,color:T.textMuted,fontSize:12}}>· optional, renews with your plan</span></div>
        <AddonPicker addons={addonCatalogue} picks={picks} setPicks={setPicks}
          unit={(a)=>addonPrice(a,{cycle,byok:byok&&!!selPlan&&hasByokPrice(selPlan)})} per={cycle==="yearly"?"a year":"a month"}/>
      </div>}

      {/* 4. what it comes to */}
      {quote?.ok
        ?<Summary lines={quote.lines} total={quote.total}/>
        :selPlan&&<div style={{fontSize:12.5,color:T.danger,marginBottom:12}}>{quote?.error}</div>}

      {paySection}
    </Card>}

    {/* Add-ons on a running package */}
    {step==="addons"&&<Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:10}}>
        <div style={{fontSize:15,fontWeight:600}}>Buy add-ons</div>
        <button onClick={()=>{setStep("plans");setErr("");}} aria-label="Close" style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:18}}><i className="ti ti-x"/></button>
      </div>
      <div style={{fontSize:12,color:T.textMuted,lineHeight:1.65,marginBottom:14}}>
        Added to your {d.plan_name}{d.byok_plan?" (own AI key)":""} right after payment. You pay only for the {daysLeft} day{daysLeft===1?"":"s"} left this {d.billing_cycle==="yearly"?"year":"period"}; from your next renewal they renew with your plan.
      </div>
      <div style={{marginBottom:16}}>
        <AddonPicker addons={addonCatalogue} picks={picks} setPicks={setPicks}
          unit={(a)=>addonPrice(a,{cycle:d.billing_cycle||"monthly",byok:!!d.byok_plan})} per={d.billing_cycle==="yearly"?"a year · full price":"a month · full price"}/>
      </div>
      {topUpQuote?.ok
        ?<Summary lines={topUpQuote.lines} total={topUpQuote.total} note={`For the ${topUpQuote.daysLeft} day${topUpQuote.daysLeft===1?"":"s"} left on your plan.`}/>
        :Object.values(picks).some(n=>n>0)&&<div style={{fontSize:12.5,color:T.danger,marginBottom:12}}>{topUpQuote?.error}</div>}
      {topUpQuote?.ok&&paySection}
    </Card>}

    {/* Plan cards */}
    {step==="plans"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14,marginBottom:16}}>
      {buyable.map(p=><Card key={p.id} style={{border:p.highlight?`1px solid color-mix(in srgb, ${T.gold} 33%, transparent)`:undefined,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:16,fontWeight:600}}>{p.name}</span>
          {d.plan===p.id?<Badge color={T.success}>Current</Badge>:p.highlight?<Badge>Popular</Badge>:null}
        </div>
        <div style={{fontSize:24,fontWeight:700,margin:"10px 0 2px"}}>{taka(planPrice(p,{cycle:"monthly"}))}<span style={{fontSize:12,color:T.textMuted,fontWeight:400}}>/month</span></div>
        <div style={{fontSize:11.5,color:T.textDim}}>or {taka(planPrice(p,{cycle:"yearly"}))}/year</div>
        {/* The own-key price, on every card (owner, 2026-10-03). */}
        {hasByokPrice(p)&&<div style={{fontSize:12,color:T.textMuted,margin:"6px 0 12px"}}><i className="ti ti-key" style={{marginRight:4}}/>{taka(planPrice(p,{byok:true}))}/month with your own AI key</div>}
        {!hasByokPrice(p)&&<div style={{marginBottom:12}}/>}
        <ul style={{listStyle:"none",padding:0,margin:"0 0 16px",display:"flex",flexDirection:"column",gap:7,flex:1}}>
          {(p.features||[]).map((f,i)=><li key={i} style={{fontSize:12.3,color:T.textMuted,display:"flex",gap:7,lineHeight:1.5}}>
            <span style={{color:T.success,flexShrink:0}}>✓</span><span>{f}</span></li>)}
        </ul>
        <Btn gold={p.highlight} onClick={()=>openPay(p.id)} style={{width:"100%"}} disabled={!!d.pending_request}>
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
            <td style={{padding:"10px 0"}}>{r.kind==="addon"?"Add-ons · ":""}{planMeta[r.plan]?.name||PLAN_META[r.plan]?.name||r.plan}{r.byok?" (own key)":""}<span style={{color:T.textDim,fontSize:11}}> · {r.billing_cycle}</span></td>
            <td style={{padding:"10px 0"}}>{taka(r.amount)}</td>
            <td style={{padding:"10px 0",color:T.textMuted,fontFamily:"monospace",fontSize:11.5}}>{r.txn_id}</td>
            <td style={{padding:"10px 0",textAlign:"right"}}>
              {/* "expired" = an online checkout that was cancelled or never finished (billing-rules.js) */}
              <Badge color={r.status==="approved"?T.success:r.status==="rejected"?T.danger:r.status==="expired"?T.textDim:T.warn}>{r.status==="expired"?"not completed":r.status}</Badge>
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
