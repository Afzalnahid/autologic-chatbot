"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Inp, Badge, Accordion, Select, Switch, useIsMobile, SAMPLE_ECOM, SAMPLE_AGENCY } from "./ui.js";
import { api, apiJson } from "./session.js";
import { useT, useLang } from "./i18n.js";
import { TRAINING_KEYS_ECOM, TRAINING_KEYS_AGENCY } from "@/lib/assistant-actions.js";
import { useBackClose } from "./back.js";

// The Bot Training tab (page key "settings"). Four sub-tabs — Train (what the
// bot knows about the business), Offers (deals the bot quotes exactly),
// Bargaining (how far it may go on price) and Behavior (identity, automation,
// guardrails).
//
// This is a MANUAL tab. The Train sub-tab used to offer two views of the same
// fields — a form, and a chat that asked the same questions one at a time — and
// the chat is gone. Not because it was bad, but because the dashboard now has
// ONE place where you talk to it, and a chat here meant the owner had to
// remember which of two conversations knew what. Everything the chat could
// reach is on the form, and the AI Assistant tab can fill any of it in by
// conversation and show the change for confirmation before it lands.
//
// Every visible string comes from i18n so the dashboard's language switch
// covers this tab in both English and Bangla; nothing is hardcoded in one
// language. A shop and an agency are asked different questions and manage
// different things (products vs services), so the two flows are kept distinct
// rather than one flow with a shop bias.
//
// Stored shape: the original settings keys plus `offers` (array) and `bargain`
// (object) — both read live by bot.js.

const CORE_BASE_DISPLAY = `IDENTITY: Acts as a real human team member · never reveals it is automated · stays focused on your business only
OUTPUT: Platform message format only · no markdown, lists or links inside text · short, natural, human replies
LANGUAGE: Always matches the customer (Bangla / English / Banglish) · greets only on the first message
ACCURACY: Your data is the only source of truth · never guesses facts, prices or policies · confirms with the team when unsure
HANDOFF: Angry customers or complaints are reassured that a team member will help`;
const CORE_ECOM_DISPLAY = `PRODUCTS: Code = exact product · text search = top 2 · one best match per sent photo · low confidence = asks for a clearer photo
CATALOGUE: "Show everything" shares your catalogue link when provided
DISPLAY: Image first, then Product / Code / Price · sale price before regular · out-of-stock suggests an alternative
ORDERS: Full Name / Phone / Address collected one by one · full order read back with total before confirming
CLOSING: One short smart closing line, never repeated`;
const CORE_AGENCY_DISPLAY = `KNOWLEDGE: Answers come only from your uploaded knowledge base · unknown = "we'll connect you with the team"
SERVICES: Presented conversationally · no invented packages or prices · asks a clarifying question when vague
MEETINGS: Collects name, email, phone, service, date & time · confirms before booking · Google Meet link sent automatically
LEADS: Not-ready customers are nurtured, never pushed`;

// Which questions are asked, per business type. They live in
// `assistant-actions.js` because the AI Assistant tab needs the same list — it
// can fill one of these in by conversation, so it has to know which ones this
// business has. Two copies of a list like that drift, and the drift is
// invisible until a question exists in one place and not the other.
const STEP_KEYS_ECOM = TRAINING_KEYS_ECOM;
const STEP_KEYS_AGENCY = TRAINING_KEYS_AGENCY;
const LONG = new Set(["description", "products", "services", "pricing", "process", "clients",
  "stock", "faq", "objections", "complaints", "special"]);

export default function Settings({settings,setSettings}) {
  const t=useT();
  const lang=useLang();
  const [s,setS]=useState(settings);
  const [saved,setSaved]=useState(false);
  const [gen,setGen]=useState(false);
  const [genMsg,setGenMsg]=useState("");
  const [me,setMe]=useState(null);
  // Another tab (Inventory's "Offers" button) can request a sub-tab.
  const [tab,setTab]=useState(()=>{try{const v=sessionStorage.getItem("al-bt-tab");if(v){sessionStorage.removeItem("al-bt-tab");return v;}}catch{}return "train";});
  const isMobile=useIsMobile();
  useEffect(()=>{setS(settings);},[settings]);
  useEffect(()=>{api("/api/me").then(r=>r.json()).then(setMe).catch(()=>{});},[]);
  const bType=me?.client?.business_type||"ecommerce";
  const isEcom=bType==="ecommerce";
  const bk=isEcom?"ecom":"agency";              // key prefix for translated questions
  const q=s.questionnaire||{};
  const setQ=(patch)=>setS(v=>({...v,questionnaire:{...(v.questionnaire||{}),...patch}}));
  const dirty=JSON.stringify(s)!==JSON.stringify(settings);
  const save=async()=>{setSettings(s); await api("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}); setSaved(true); setTimeout(()=>setSaved(false),2000);};
  const regenerate=async()=>{
    if(gen) return;
    const answers=s.questionnaire||{};
    if(!(answers.description||"").trim()){setGenMsg(t("bt.train.genNeedDesc"));return;}
    setGen(true); setGenMsg(t("bt.train.generating"));
    const r=await apiJson("/api/generate-prompt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers})});
    setGen(false);
    if(r.error){setGenMsg(t("bt.train.genFail"));return;}
    setS(v=>({...v,businessPrompt:r.prompt})); setGenMsg(t("bt.train.genOk"));
  };

  // Which questions this kind of business is asked. The chat that asked them
  // one at a time has moved to the AI Assistant tab; the same keys still drive
  // the form below, so nothing that was answerable stopped being answerable.
  const stepKeys=isEcom?STEP_KEYS_ECOM:STEP_KEYS_AGENCY;
  const answered=stepKeys.filter(k=>String(q[k]||"").trim()).length;

  // ---------- ongoing training ("teach it more") ----------
  // The interview covers the basics once; a real business keeps learning. Each
  // note is appended to questionnaire.notes and reaches the bot as its own
  // block, so the owner can correct or add anything without redoing the setup.
  const notes=Array.isArray(q.notes)?q.notes:[];
  const [noteDraft,setNoteDraft]=useState("");
  const [noteMsg,setNoteMsg]=useState("");
  const addNote=()=>{
    const text=noteDraft.trim(); if(!text) return;
    setQ({notes:[...notes,{id:String(Date.now()),text}]});
    setNoteDraft(""); setNoteMsg(t("bt.more.saveHint"));
  };
  const delNote=(id)=>setQ({notes:notes.filter(n=>n.id!==id)});

  // ---------- prompt editor ----------
  const [promptFull,setPromptFull]=useState(false);
  // The full-screen prompt editor answers the back press before the tab does.
  useBackClose(promptFull,()=>setPromptFull(false));
  const promptText=s.businessPrompt||s.systemPrompt||"";

  // ---------- offers ----------
  const offers=Array.isArray(s.offers)?s.offers:[];
  const setOffers=(list)=>setS(v=>({...v,offers:list}));
  const addOffer=()=>setOffers([...offers,{id:String(Date.now()),title:"",details:"",valid_until:"",active:true,products:[]}]);
  const patchOffer=(id,patch)=>setOffers(offers.map(o=>o.id===id?{...o,...patch}:o));
  const delOffer=(id)=>setOffers(offers.filter(o=>o.id!==id));
  const activeOffers=offers.filter(o=>o.active!==false&&String(o.title||o.details||"").trim()).length;

  // A shop picks real inventory items; an agency types service names, since
  // services live as text, not as catalogue rows.
  const [prodList,setProdList]=useState(null);
  const [prodQ,setProdQ]=useState("");
  const [pickerFor,setPickerFor]=useState(null);
  const [svcDraft,setSvcDraft]=useState({});
  const [orgBusy,setOrgBusy]=useState(null);
  useEffect(()=>{ if(tab==="offers"&&isEcom&&prodList===null){ api("/api/products").then(r=>r.json()).then(d=>setProdList(Array.isArray(d)?d:[])).catch(()=>setProdList([])); } },[tab,isEcom]); // eslint-disable-line
  const itemsOf=(o)=>Array.isArray(o.products)?o.products:[];
  const toggleProd=(oid,p)=>{
    const o=offers.find(x=>x.id===oid); if(!o) return;
    const cur=itemsOf(o); const has=cur.some(x=>x.id===p.id);
    patchOffer(oid,{products:has?cur.filter(x=>x.id!==p.id):[...cur,{id:p.id,name:p.product_name||"",code:p.product_code||"",price:p.sale_price||p.regular_price||""}]});
  };
  const addService=(oid)=>{
    const name=(svcDraft[oid]||"").trim(); if(!name) return;
    const o=offers.find(x=>x.id===oid); if(!o) return;
    patchOffer(oid,{products:[...itemsOf(o),{id:"svc_"+Date.now(),name}]});
    setSvcDraft(d=>({...d,[oid]:""}));
  };
  const removeItem=(oid,id)=>{
    const o=offers.find(x=>x.id===oid); if(!o) return;
    patchOffer(oid,{products:itemsOf(o).filter(x=>x.id!==id)});
  };
  const organise=async(o)=>{
    if(orgBusy) return;
    setOrgBusy(o.id);
    const r=await apiJson("/api/offer-rewrite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:o.title||"",details:o.details||"",products:itemsOf(o)})});
    setOrgBusy(null);
    if(r.error){alert(r.error);return;}
    patchOffer(o.id,{title:r.title,details:r.details});
  };

  // ---------- bargaining ----------
  // Stored as {enabled, mode, max_discount_pct, custom} — the shape bot.js
  // reads. The UI presents it as one clear choice of three, because "a
  // checkbox plus a dropdown" left owners unsure what the bot would do.
  const b=s.bargain||{};
  const barMode=!("enabled" in b)?null:(!b.enabled?"fixed":(b.mode==="custom"?"custom":"limited"));
  const pickBar=(m)=>setS(v=>({...v,bargain:{
    max_discount_pct:5,custom:"",...(v.bargain||{}),
    enabled:m!=="fixed", mode:m==="custom"?"custom":"limited",
  }}));
  const setB=(patch)=>setS(v=>({...v,bargain:{enabled:true,mode:"limited",max_discount_pct:5,custom:"",...(v.bargain||{}),...patch}}));
  const pct=Math.min(50,Math.max(1,Number(b.max_discount_pct)||5));
  const fmt=(n)=>n.toLocaleString(lang==="bn"?"bn-BD":"en-IN");

  const checks=[
    { key:"bt.chk.identity", done:!!(s.botName&&s.greeting) },
    { key:"bt.chk.business", done:!!(q.description||"").trim() },
    { key:isEcom?"bt.chk.policies":"bt.chk.services", done:isEcom?!!(q.delivery&&q.payment):!!(q.services||"").trim() },
    { key:"bt.chk.qa",       done:!!(q.faq||"").trim() },
    { key:"bt.chk.offers",   done:activeOffers>0 },
    { key:"bt.chk.bargain",  done:barMode!==null },
  ];
  const doneCount=checks.filter(c=>c.done).length;

  const TABS=[
    {id:"train",   icon:"ti-messages",        label:t("bt.tab.train")},
    {id:"offers",  icon:"ti-discount-2",      label:activeOffers?`${t("bt.tab.offers")} (${activeOffers})`:t("bt.tab.offers")},
    {id:"bargain", icon:"ti-arrows-exchange", label:t("bt.tab.bargain")},
    {id:"behavior",icon:"ti-adjustments",     label:t("bt.tab.behavior")},
  ];

  const Sec=({icon,title,sub,right})=>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}}>
      <span style={{width:38,height:38,borderRadius:12,background:T.goldBg,color:T.gold,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}><i className={`ti ${icon}`}/></span>
      <div style={{flex:"1 1 180px",minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:700}}>{title}</div>
        <div style={{fontSize:11.5,color:T.textMuted,marginTop:1,lineHeight:1.5}}>{sub}</div>
      </div>
      {right}
    </div>;

  // One bargaining choice, as a big selectable card.
  const ChoiceCard=({id,icon,title,desc,children})=>{
    const on=barMode===id;
    return <div onClick={()=>pickBar(id)} style={{cursor:"pointer",border:`1px solid ${on?T.gold:T.border}`,background:on?T.goldBg:"transparent",borderRadius:12,padding:"13px 14px",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:11}}>
        <i className={`ti ${on?"ti-circle-check-filled":"ti-circle"}`} style={{fontSize:19,color:on?T.gold:T.textDim,flexShrink:0,marginTop:1}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13.5,fontWeight:700,display:"flex",alignItems:"center",gap:7}}><i className={`ti ${icon}`} style={{fontSize:15,color:on?T.gold:T.textMuted}}/>{title}</div>
          <div style={{fontSize:12,color:T.textMuted,marginTop:3,lineHeight:1.6}}>{desc}</div>
          {on&&children?<div onClick={e=>e.stopPropagation()} style={{marginTop:12}}>{children}</div>:null}
        </div>
      </div>
    </div>;
  };

  // Bottom padding clears BOTH the floating save bar and, on a phone, the
  // bottom navigation — otherwise the last card sits underneath them.
  return <div style={{maxWidth:700,paddingBottom:isMobile?156:96}}>
    {/* Checklist */}
    <Card style={{marginBottom:12,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 220px",minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:700}}>{t("bt.title")}</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2,lineHeight:1.5}}>
          {doneCount>=4?t("bt.allDone"):t("bt.progress",{done:doneCount,total:checks.length})}
        </div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {checks.map(c=><span key={c.key} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:600,padding:"4px 10px",borderRadius:20,background:c.done?`color-mix(in srgb, ${T.success} 12%, transparent)`:T.bgAlt,color:c.done?T.success:T.textDim,border:`0.5px solid ${c.done?`color-mix(in srgb, ${T.success} 35%, transparent)`:T.border}`}}>
          <i className={`ti ${c.done?"ti-check":"ti-point"}`} style={{fontSize:12}}/>{t(c.key)}
        </span>)}
      </div>
    </Card>

    {/* Sub-tabs */}
    <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
      {TABS.map(x=><button key={x.id} onClick={()=>setTab(x.id)} className="ui-btn" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"9px 16px",borderRadius:12,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",background:tab===x.id?"var(--acc-grad)":T.card,color:tab===x.id?"#fff":T.textMuted,boxShadow:tab===x.id?"var(--acc-glow)":"var(--nm-sm)"}}>
        <i className={`ti ${x.icon}`} style={{fontSize:15}}/>{x.label}
      </button>)}
    </div>

    {/* ============ TRAIN ============ */}
    {tab==="train"&&<>
    <Card style={{marginBottom:12}}>
      <Sec icon="ti-forms" title={t("bt.train.title")} sub={t("bt.train.sub")}
        right={<Badge color={answered?T.success:T.textDim}>{t("bt.train.answered",{n:answered,total:stepKeys.length})}</Badge>}/>

      {/* The questions used to be askable one at a time here as well. That
          conversation lives on the AI Assistant tab now — one place where you
          talk to it — and this is the door to it. */}
      <div style={{display:"flex",gap:9,alignItems:"flex-start",background:T.goldBg,borderRadius:12,padding:"10px 12px",marginBottom:14}}>
        <i className="ti ti-sparkles" style={{fontSize:16,color:T.gold,flexShrink:0,marginTop:1}}/>
        <div style={{flex:1,minWidth:0,fontSize:12,color:T.text,lineHeight:1.6}}>{t("bt.train.askThere")}</div>
        <Btn small gold onClick={()=>window.dispatchEvent(new CustomEvent("al-goto",{detail:"assistant"}))} style={{flexShrink:0,whiteSpace:"nowrap"}}>{t("nav.assistant")}</Btn>
      </div>

      <Inp textarea label={t("lbl.description")} value={q.description||""} onChange={e=>setQ({description:e.target.value})}
        inputStyle={{minHeight:130,lineHeight:1.65}} placeholder={t(`ph.${bk}.description`)}/>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11.5,color:T.textMuted,marginBottom:8}}>{t("bt.train.samples")}</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {(isEcom?SAMPLE_ECOM:SAMPLE_AGENCY).map(ex=><button key={ex.label} onClick={()=>setQ({description:ex.text})}
            style={{padding:"6px 13px",borderRadius:20,border:`1px solid ${T.border}`,background:T.bgAlt,color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{ex.label}</button>)}
        </div>
      </div>
      {/* Every question this business has, driven by the same list the
          assistant reads, so the two can never drift apart as questions are
          added. */}
      {stepKeys.filter(k=>k!=="description").map(k=>
        <Inp key={k} textarea={LONG.has(k)} label={t("lbl."+k)} value={q[k]||""}
          onChange={e=>setQ({[k]:e.target.value})} placeholder={t(`ph.${bk}.${k}`)}/>)}
      <Btn gold onClick={regenerate} disabled={gen}><i className="ti ti-sparkles" style={{marginRight:6}}/>{gen?t("bt.train.generating"):t("bt.train.regen")}</Btn>
      {genMsg&&<span style={{fontSize:12,color:T.textMuted,marginLeft:10}}>{genMsg}</span>}
    </Card>

    {/* Ongoing training — the bot keeps learning after the interview */}
    <Card style={{marginBottom:12}}>
      <Sec icon="ti-brain" title={t("bt.more.title")} sub={t("bt.more.sub")}
        right={notes.length?<Badge color={T.success}>{t("bt.more.count",{n:notes.length})}</Badge>:null}/>
      {notes.length>0&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14,maxHeight:260,overflowY:"auto"}}>
        {notes.map(n=><div key={n.id} style={{display:"flex",gap:10,alignItems:"flex-start",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:11,padding:"10px 12px"}}>
          <i className="ti ti-message-2-check" style={{fontSize:15,color:T.success,flexShrink:0,marginTop:2}}/>
          <div style={{flex:1,minWidth:0,fontSize:12.5,lineHeight:1.65,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{n.text}</div>
          <button onClick={()=>delNote(n.id)} title={t("bt.more.remove")} style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,fontSize:15,padding:2,flexShrink:0}}><i className="ti ti-x"/></button>
        </div>)}
      </div>}
      {!notes.length&&<div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7,marginBottom:14}}>{t("bt.more.empty")}</div>}
      <Inp textarea value={noteDraft} onChange={e=>{setNoteDraft(e.target.value);setNoteMsg("");}}
        placeholder={t("bt.more.ph")} inputStyle={{minHeight:80,lineHeight:1.6}} style={{marginBottom:10}}/>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <Btn gold onClick={addNote} disabled={!noteDraft.trim()}><i className="ti ti-plus" style={{marginRight:6}}/>{t("bt.more.add")}</Btn>
        {noteMsg&&<span style={{fontSize:12,color:T.success}}><i className="ti ti-check" style={{marginRight:4}}/>{noteMsg}</span>}
      </div>
    </Card>
    </>}

    {/* ============ OFFERS ============ */}
    {tab==="offers"&&<Card style={{marginBottom:12}}>
      <Sec icon="ti-discount-2" title={t("bt.off.title")} sub={t("bt.off.sub")}
        right={<div style={{display:"flex",gap:8,flexShrink:0}}>
          {isEcom&&<Btn small onClick={()=>window.dispatchEvent(new CustomEvent("al-goto",{detail:"inventory"}))}><i className="ti ti-box" style={{marginRight:4}}/>{t("nav.inventory")}</Btn>}
          <Btn small gold onClick={addOffer}><i className="ti ti-plus" style={{marginRight:4}}/>{t("bt.off.add")}</Btn>
        </div>}/>

      {!offers.length&&<div style={{textAlign:"center",padding:"26px 16px"}}>
        <i className="ti ti-discount-2" style={{fontSize:28,color:T.textDim}}/>
        <div style={{fontSize:13.5,fontWeight:600,margin:"10px 0 6px"}}>{t("bt.off.none")}</div>
        <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7,maxWidth:420,margin:"0 auto 16px"}}>
          {isEcom?t("bt.off.noneHelpEcom"):t("bt.off.noneHelpAgency")}
        </div>
        <Btn gold onClick={addOffer}><i className="ti ti-plus" style={{marginRight:6}}/>{t("bt.off.addFirst")}</Btn>
      </div>}

      {offers.map((o,i)=>{
        const items=itemsOf(o);
        const list=(prodList||[]).filter(p=>{
          const s2=(prodQ||"").toLowerCase();
          return !s2||String(p.product_name||"").toLowerCase().includes(s2)||String(p.product_code||"").toLowerCase().includes(s2);
        }).slice(0,50);
        return <div key={o.id} style={{border:`0.5px solid ${T.border}`,borderRadius:12,padding:"14px 14px 6px",marginBottom:10,background:o.active===false?T.bgAlt:"transparent",opacity:o.active===false?0.7:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <Badge color={o.active===false?T.textDim:T.success}>{o.active===false?t("bt.off.offState"):t("bt.off.live")}</Badge>
            <span style={{fontSize:11.5,color:T.textDim}}>{t("bt.off.n",{n:i+1})}</span>
            <span style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
              <Switch size="sm" on={o.active!==false} onClick={()=>patchOffer(o.id,{active:o.active===false})}
                title={o.active===false?t("common.on"):t("common.off")}/>
              <button onClick={()=>delOffer(o.id)} title={t("common.delete")} style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:16,padding:2}}><i className="ti ti-trash"/></button>
            </span>
          </div>

          {/* What the offer applies to */}
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>
              {isEcom?t("bt.off.productsLabel"):t("bt.off.servicesLabel")}
            </label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {items.map(p=><span key={p.id} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"5px 10px",borderRadius:16,background:T.goldBg,color:T.text,border:`0.5px solid color-mix(in srgb, ${T.gold} 25%, transparent)`}}>
                {p.name||p.code}{p.price?<span style={{color:T.textMuted}}> · {p.price}</span>:null}
                <i className="ti ti-x" onClick={()=>removeItem(o.id,p.id)} style={{fontSize:12,cursor:"pointer",color:T.textMuted}}/>
              </span>)}
              {isEcom&&<button onClick={()=>{setPickerFor(pickerFor===o.id?null:o.id);setProdQ("");}} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12,padding:"5px 11px",borderRadius:16,border:`1px dashed ${T.border}`,background:"transparent",color:T.textMuted,cursor:"pointer",fontFamily:"inherit"}}>
                <i className={`ti ${pickerFor===o.id?"ti-chevron-up":"ti-plus"}`} style={{fontSize:12}}/>{pickerFor===o.id?t("common.close"):t("bt.off.select")}
              </button>}
            </div>

            {/* Shop: pick from the real catalogue */}
            {isEcom&&pickerFor===o.id&&<div style={{marginTop:10,border:`0.5px solid ${T.border}`,borderRadius:10,background:T.bgAlt,padding:10}}>
              <input value={prodQ} onChange={e=>setProdQ(e.target.value)} placeholder={t("bt.off.searchProducts")}
                style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`0.5px solid ${T.border}`,background:T.card,color:T.text,fontSize:12.5,marginBottom:8,fontFamily:"inherit"}}/>
              <div style={{maxHeight:190,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
                {prodList===null&&<div style={{fontSize:12,color:T.textDim,padding:8}}>{t("common.loading")}</div>}
                {prodList!==null&&!list.length&&<div style={{fontSize:12,color:T.textDim,padding:8}}>
                  {t("bt.off.noProducts")}{" "}
                  <span onClick={()=>window.dispatchEvent(new CustomEvent("al-goto",{detail:"inventory"}))} style={{color:T.gold,cursor:"pointer",textDecoration:"underline"}}>{t("bt.off.goInventory")}</span>
                </div>}
                {list.map(p=>{
                  const on=items.some(x=>x.id===p.id);
                  return <div key={p.id} onClick={()=>toggleProd(o.id,p)} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",borderRadius:8,cursor:"pointer",background:on?T.goldBg:"transparent"}}>
                    <i className={`ti ${on?"ti-checkbox":"ti-square"}`} style={{fontSize:15,color:on?T.gold:T.textDim,flexShrink:0}}/>
                    <span style={{fontSize:12.5,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.product_name||"—"}{p.product_code?<span style={{color:T.textDim}}> · {p.product_code}</span>:null}</span>
                    <span style={{fontSize:12,color:T.textMuted,flexShrink:0}}>{p.sale_price||p.regular_price||""}</span>
                  </div>;
                })}
              </div>
            </div>}

            {/* Agency: services are typed, not picked from a catalogue */}
            {!isEcom&&<div style={{display:"flex",gap:8,marginTop:8}}>
              <input value={svcDraft[o.id]||""} onChange={e=>setSvcDraft(d=>({...d,[o.id]:e.target.value}))}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addService(o.id);}}}
                placeholder={t("bt.off.serviceName")}
                style={{flex:1,minWidth:0,padding:"9px 12px",borderRadius:10,border:`0.5px solid ${T.border}`,background:T.bgAlt,color:T.text,fontSize:12.5,fontFamily:"inherit"}}/>
              <Btn small onClick={()=>addService(o.id)}><i className="ti ti-plus" style={{marginRight:4}}/>{t("bt.off.selectServices")}</Btn>
            </div>}
          </div>

          <Inp label={t("bt.off.offerLabel")} value={o.title||""} onChange={e=>patchOffer(o.id,{title:e.target.value})}/>
          <Inp label={t("bt.off.detailsLabel")} value={o.details||""} onChange={e=>patchOffer(o.id,{details:e.target.value})}/>
          <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{width:200,flexShrink:0}}>
              <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{t("bt.off.validUntil")} <span style={{textTransform:"none",letterSpacing:0}}>({t("common.optional")})</span></label>
              <input type="date" value={o.valid_until||""} onChange={e=>patchOffer(o.id,{valid_until:e.target.value})}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`0.5px solid ${T.border}`,background:T.bgAlt,color:T.text,fontSize:13,marginBottom:12,fontFamily:"inherit"}}/>
            </div>
            <div style={{marginBottom:12}}>
              <Btn small onClick={()=>organise(o)} disabled={orgBusy===o.id}>
                <i className="ti ti-sparkles" style={{marginRight:5}}/>{orgBusy===o.id?t("bt.off.organising"):t("bt.off.organise")}
              </Btn>
            </div>
          </div>
        </div>;
      })}

      {offers.length>0&&<div style={{fontSize:11.5,color:T.textDim,lineHeight:1.7,marginTop:4}}>
        <i className="ti ti-info-circle" style={{marginRight:4}}/>{t("bt.off.hint")}
      </div>}
    </Card>}

    {/* ============ BARGAINING ============ */}
    {tab==="bargain"&&<Card style={{marginBottom:12}}>
      <Sec icon="ti-arrows-exchange" title={t("bt.bar.title")} sub={isEcom?t("bt.bar.subEcom"):t("bt.bar.subAgency")}/>
      <div style={{fontSize:12,color:T.textDim,marginBottom:14,lineHeight:1.6}}>{t("bt.bar.pickOne")}</div>

      <ChoiceCard id="fixed" icon="ti-lock" title={t("bt.bar.fixed")} desc={t("bt.bar.fixedDesc")}/>

      <ChoiceCard id="limited" icon="ti-percentage" title={t("bt.bar.limited")} desc={t("bt.bar.limitedDesc")}>
        <div style={{maxWidth:220}}>
          <Inp label={t("bt.bar.maxLabel")} type="number" min={1} max={50} value={b.max_discount_pct??5}
            onChange={e=>setB({max_discount_pct:Math.min(50,Math.max(1,Number(e.target.value)||1))})} style={{marginBottom:8}}/>
        </div>
        <div style={{fontSize:12,color:T.text,background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:9,padding:"9px 11px",lineHeight:1.6}}>
          <i className="ti ti-calculator" style={{marginRight:6,color:T.gold}}/>
          {t("bt.bar.example",{price:fmt(1000),floor:fmt(Math.round(1000-(1000*pct)/100))})}
        </div>
        <div style={{fontSize:11.5,color:T.textDim,marginTop:8,lineHeight:1.6}}><i className="ti ti-eye-off" style={{marginRight:5}}/>{t("bt.bar.secret")}</div>
      </ChoiceCard>

      <ChoiceCard id="custom" icon="ti-pencil" title={t("bt.bar.custom")} desc={t("bt.bar.customDesc")}>
        <Inp textarea label={t("bt.bar.customLabel")} value={b.custom||""} onChange={e=>setB({custom:e.target.value,mode:"custom"})}
          placeholder={t("bt.bar.customPh")} inputStyle={{minHeight:100,lineHeight:1.65}} style={{marginBottom:0}}/>
      </ChoiceCard>
    </Card>}

    {/* ============ BEHAVIOR ============ */}
    {tab==="behavior"&&<>
      <Card style={{marginBottom:12}}>
        <Sec icon="ti-id-badge-2" title={t("bt.beh.identity")} sub={t("bt.beh.identitySub")}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          <Inp label={t("bt.beh.botName")} value={s.botName||""} onChange={e=>setS({...s,botName:e.target.value})}/>
          <Inp label={t("bt.beh.businessName")} value={s.businessName||""} onChange={e=>setS({...s,businessName:e.target.value})}/>
        </div>
        <Inp label={t("bt.beh.greeting")} value={s.greeting||""} onChange={e=>setS({...s,greeting:e.target.value})}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          <div>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{t("bt.beh.tone")}</label>
            <Select wide value={q.tone||"Friendly and helpful"} onChange={v=>setQ({tone:v})}
              options={[{value:"Friendly and helpful",label:t("bt.beh.tone1")},{value:"Professional and formal",label:t("bt.beh.tone2")},{value:"Casual and fun",label:t("bt.beh.tone3")}]}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{t("bt.beh.languages")}</label>
            <Select wide value={q.languages||"Follow the customer's language"} onChange={v=>setQ({languages:v})}
              options={[{value:"Follow the customer's language",label:t("bt.beh.lang1")},{value:"Bangla only",label:t("bt.beh.lang2")},{value:"English only",label:t("bt.beh.lang3")}]}/>
          </div>
        </div>
      </Card>

      <Card style={{marginBottom:12}}>
        <Sec icon="ti-repeat" title={t("bt.beh.automation")} sub={t("bt.beh.automationSub")}
          right={<Switch size="sm" on={!!s.followup?.enabled} label={s.followup?.enabled?t("common.on"):t("common.off")}
            onClick={()=>setS(v=>({...v,followup:{...(v.followup||{}),enabled:!v.followup?.enabled}}))}/>}/>
        <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7,marginBottom:s.followup?.enabled?14:0}}>
          <b style={{color:T.text}}>{t("bt.beh.followupTitle")}</b>{" "}
          {isEcom?t("bt.beh.followupEcom"):t("bt.beh.followupAgency")}{" "}{t("bt.beh.followupTail")}
        </div>
        {s.followup?.enabled&&<>
          <div style={{maxWidth:220,marginBottom:14}}>
            <Inp label={t("bt.beh.delay")} type="number" min={1} max={23} value={s.followup?.delay_hours??20}
              onChange={e=>setS(v=>({...v,followup:{...(v.followup||{}),delay_hours:Number(e.target.value)}}))}/>
            <div style={{fontSize:11.5,color:T.textDim,marginTop:-6,lineHeight:1.6}}>{t("bt.beh.delayHelp")}</div>
          </div>
          <Inp label={t("bt.beh.message")} textarea maxLength={600}
            value={isEcom?(s.followup?.message_ecommerce??""):(s.followup?.message_agency??"")}
            onChange={e=>setS(v=>({...v,followup:{...(v.followup||{}),[isEcom?"message_ecommerce":"message_agency"]:e.target.value}}))}/>
          <div style={{fontSize:11.5,color:T.textDim,marginTop:6}}>{t("bt.beh.messageHelp")}</div>
        </>}
      </Card>

      <Card style={{marginBottom:12}}>
        <Sec icon="ti-lock" title={t("bt.beh.guardrails")} sub={t("bt.beh.guardrailsSub")}/>
        <Accordion icon="ti-shield-check" title={t("bt.beh.seeRules")} subtitle={isEcom?t("bt.beh.rulesEcom"):t("bt.beh.rulesAgency")}>
          <pre style={{fontSize:12,color:T.textMuted,whiteSpace:"pre-wrap",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:12,margin:0,lineHeight:1.7}}>{CORE_BASE_DISPLAY+"\n"+(isEcom?CORE_ECOM_DISPLAY:CORE_AGENCY_DISPLAY)}</pre>
        </Accordion>
      </Card>

      <Accordion icon="ti-file-text" title={t("bt.beh.advanced")} subtitle={t("bt.beh.advancedSub")}>
        <div style={{height:6}}/>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:12,lineHeight:1.6}}>{t("bt.beh.advancedHelp")}</div>
        {/* The profile is long, so the box is generous and can be opened
            full-screen — reading it through a five-line window was the reason
            owners never checked what their bot actually says. */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
          <span style={{fontSize:11.5,color:T.textDim}}>{t("bt.beh.chars",{n:promptText.length})}</span>
          <Btn small onClick={()=>setPromptFull(true)} style={{marginLeft:"auto"}}>
            <i className="ti ti-arrows-maximize" style={{marginRight:5}}/>{t("bt.beh.fullscreen")}
          </Btn>
        </div>
        <Inp textarea value={promptText} onChange={e=>setS({...s,businessPrompt:e.target.value})}
          inputStyle={{minHeight:260,lineHeight:1.7,fontSize:13,resize:"vertical"}} style={{marginBottom:0}}/>
      </Accordion>
    </>}

    {/* Full-screen profile editor */}
    {promptFull&&<div role="dialog" aria-modal="true" onClick={()=>setPromptFull(false)}
      style={{position:"fixed",inset:0,zIndex:80,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?0:24}}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:isMobile?0:16,width:"100%",maxWidth:900,height:isMobile?"100dvh":"88vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,.4)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <i className="ti ti-file-text" style={{fontSize:18,color:T.gold}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700}}>{t("bt.beh.editorTitle")}</div>
            <div style={{fontSize:11.5,color:T.textDim,marginTop:1}}>{t("bt.beh.chars",{n:promptText.length})}</div>
          </div>
          <Btn gold onClick={()=>setPromptFull(false)}><i className="ti ti-check" style={{marginRight:6}}/>{t("bt.beh.done")}</Btn>
        </div>
        <textarea value={promptText} onChange={e=>setS({...s,businessPrompt:e.target.value})} className="ui-inp"
          style={{flex:1,minHeight:0,width:"100%",background:T.bgAlt,border:"none",outline:"none",resize:"none",
            color:T.text,fontSize:13.5,lineHeight:1.75,padding:"16px 18px",fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>
    </div>}

    {/* Save bar */}
    {!promptFull&&<div style={{position:"fixed",left:0,right:0,bottom:isMobile?66:0,display:"flex",justifyContent:"center",pointerEvents:"none",zIndex:40,padding:"0 16px"}}>
      <div style={{width:"100%",maxWidth:700,display:"flex",justifyContent:"flex-end",padding:"0 0 12px"}}>
        {(dirty||saved)&&<div style={{pointerEvents:"auto",display:"flex",alignItems:"center",gap:12,background:T.card,border:`1px solid ${saved?`color-mix(in srgb, ${T.success} 40%, transparent)`:T.border}`,borderRadius:14,boxShadow:"0 10px 30px rgba(0,0,0,.14)",padding:"10px 12px 10px 16px"}}>
          <span style={{fontSize:12.5,color:saved?T.success:T.textMuted,display:"flex",alignItems:"center",gap:6}}>
            <i className={`ti ${saved?"ti-check":"ti-pencil"}`} style={{fontSize:14}}/>{saved?t("common.saved"):t("common.unsaved")}
          </span>
          {!saved&&<Btn gold onClick={save}><i className="ti ti-check" style={{marginRight:6}}/>{t("common.save")}</Btn>}
        </div>}
      </div>
    </div>}
  </div>;
}
