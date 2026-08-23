"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn, Inp, Badge, Accordion, Select, useIsMobile, SAMPLE_ECOM, SAMPLE_AGENCY } from "./ui.js";
import { api } from "./session.js";

// The Bot Training tab (page key "settings"). Redesigned 2026-08-23 after owner
// feedback that one long page was hard to handle: training is now four small
// sub-tabs — Train (a guided chat where the bot interviews the owner, with a
// classic form view too), Offers (structured running offers the bot quotes
// exactly), Bargaining (how far the bot may go when customers haggle) and
// Behavior (identity, automation, guardrails, advanced). One save bar covers
// them all. The stored settings shape is unchanged plus two new keys:
// `offers` (array) and `bargain` (object) — both read live by bot.js.

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

// The guided interview: the bot asks, the owner answers in a chat. Each step
// writes straight into the same questionnaire fields the form view edits, so
// the two views can never disagree.
const STEPS_ECOM = [
  { key: "description",  ta: true,  q: "Tell me about your business — what do you sell, and at what kind of prices?", ph: "e.g. আমরা ছেলেদের টি-শার্ট বিক্রি করি, দাম ৩৫০-৬০০ টাকা…" },
  { key: "delivery",     ta: false, q: "How do you deliver? Time and charge?", ph: "e.g. ঢাকায় ৬০৳ (১-২ দিন), ঢাকার বাইরে ১২০৳ (২-৩ দিন)" },
  { key: "payment",      ta: false, q: "How do customers pay you?", ph: "e.g. Cash on delivery, bKash, Nagad" },
  { key: "returnPolicy", ta: false, q: "What is your return / refund policy?", ph: "e.g. ৭ দিনের মধ্যে সমস্যা থাকলে বদলে দেই" },
  { key: "hours",        ta: false, q: "When are you open?", ph: "e.g. প্রতিদিন সকাল ১০টা - রাত ১০টা" },
  { key: "catalogLink",  ta: false, q: "Any catalog or website link customers can browse?", ph: "e.g. https://yourshop.com (skip if none)" },
  { key: "faq",          ta: true,  q: "What do customers ask most? Write the questions with your answers.", ph: "Q: স্টক আছে?\nA: হ্যাঁ, বেশিরভাগ সাইজ স্টকে থাকে…" },
  { key: "special",      ta: true,  q: "Anything else the bot should know? Brand rules, do's and don'ts…", ph: "e.g. সবসময় 'আপনি' করে বলবে, প্রতিযোগীদের নাম নেবে না… (skip if none)" },
];
const STEPS_AGENCY = [
  { key: "description", ta: true,  q: "Tell me about your business — what do you do, for whom?", ph: "e.g. আমরা একটি ডিজিটাল মার্কেটিং এজেন্সি…" },
  { key: "services",    ta: true,  q: "What services do you offer, and at what prices?", ph: "e.g. Facebook ads management — মাসে ১০,০০০৳ থেকে…" },
  { key: "meetingInfo", ta: false, q: "How do clients book a meeting or consultation with you?", ph: "e.g. ৩০ মিনিটের ফ্রি কনসালটেশন, অনলাইনে" },
  { key: "hours",       ta: false, q: "When are you available?", ph: "e.g. রবি-বৃহস্পতি, সকাল ১০টা - সন্ধ্যা ৭টা" },
  { key: "catalogLink", ta: false, q: "Any website or portfolio link to share?", ph: "e.g. https://youragency.com (skip if none)" },
  { key: "faq",         ta: true,  q: "What do clients ask most? Write the questions with your answers.", ph: "Q: কতদিনে রেজাল্ট আসে?\nA: সাধারণত ২-৩ মাস…" },
  { key: "special",     ta: true,  q: "Anything else the bot should know? Special rules, tone…", ph: "(skip if none)" },
];

export default function Settings({settings,setSettings}) {
  const [s,setS]=useState(settings);
  const [saved,setSaved]=useState(false);
  const [gen,setGen]=useState(false);
  const [genMsg,setGenMsg]=useState("");
  const [me,setMe]=useState(null);
  const [tab,setTab]=useState("train");
  const [view,setView]=useState("chat");        // "chat" | "form" inside Train
  const isMobile=useIsMobile();
  useEffect(()=>{setS(settings);},[settings]);
  useEffect(()=>{api("/api/me").then(r=>r.json()).then(setMe).catch(()=>{});},[]);
  const bType=me?.client?.business_type||"ecommerce";
  const isEcom=bType==="ecommerce";
  const q=s.questionnaire||{};
  const setQ=(patch)=>setS(v=>({...v,questionnaire:{...(v.questionnaire||{}),...patch}}));
  const dirty=JSON.stringify(s)!==JSON.stringify(settings);
  const save=async()=>{setSettings(s); await api("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}); setSaved(true); setTimeout(()=>setSaved(false),2000);};
  const regenerate=async(fromState)=>{
    if(gen) return;
    const answers=(fromState||s).questionnaire||{};
    if(!(answers.description||"").trim()){setGenMsg("Please describe your business first");return;}
    setGen(true); setGenMsg("AI is writing your bot's business profile...");
    const r=await api("/api/generate-prompt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers})}).then(r=>r.json()).catch(()=>({error:"network"}));
    setGen(false);
    if(r.error){setGenMsg("Failed: "+r.error);return;}
    setS(v=>({...v,businessPrompt:r.prompt})); setGenMsg("Generated. Review it in Behavior → Advanced, then Save.");
  };

  // ---------- guided interview ----------
  const steps=isEcom?STEPS_ECOM:STEPS_AGENCY;
  const [iv,setIv]=useState(0);                 // current step index; steps.length = done
  const [ivInput,setIvInput]=useState("");
  const chatRef=useRef(null);
  useEffect(()=>{ setIvInput(iv<steps.length?(q[steps[iv]?.key]||""):""); },[iv,bType]); // eslint-disable-line
  useEffect(()=>{ chatRef.current?.scrollTo({top:chatRef.current.scrollHeight,behavior:"smooth"}); },[iv,view]);
  const ivSend=()=>{ if(iv>=steps.length) return; const st=steps[iv]; if(ivInput.trim()) setQ({[st.key]:ivInput.trim()}); setIv(iv+1); };
  const ivSkip=()=>{ if(iv<steps.length) setIv(iv+1); };
  const ivBack=()=>{ if(iv>0) setIv(iv-1); };

  const BotBubble=({children})=>
    <div style={{display:"flex",gap:8,alignItems:"flex-start",maxWidth:"92%"}}>
      <span style={{width:26,height:26,borderRadius:9,background:T.goldBg,color:T.gold,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:2}}><i className="ti ti-robot"/></span>
      <div style={{background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:"4px 14px 14px 14px",padding:"9px 13px",fontSize:13,lineHeight:1.6}}>{children}</div>
    </div>;
  const MeBubble=({children,skipped})=>
    <div style={{display:"flex",justifyContent:"flex-end"}}>
      <div style={{maxWidth:"88%",background:skipped?T.bgAlt:T.goldBg,color:skipped?T.textDim:T.text,border:`0.5px solid ${skipped?T.border:`color-mix(in srgb, ${T.gold} 25%, transparent)`}`,borderRadius:"14px 4px 14px 14px",padding:"9px 13px",fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap",fontStyle:skipped?"italic":"normal"}}>{children}</div>
    </div>;

  // ---------- offers ----------
  const offers=Array.isArray(s.offers)?s.offers:[];
  const setOffers=(list)=>setS(v=>({...v,offers:list}));
  const addOffer=()=>setOffers([...offers,{id:String(Date.now()),title:"",details:"",valid_until:"",active:true}]);
  const patchOffer=(id,patch)=>setOffers(offers.map(o=>o.id===id?{...o,...patch}:o));
  const delOffer=(id)=>setOffers(offers.filter(o=>o.id!==id));
  const activeOffers=offers.filter(o=>o.active!==false&&String(o.title||o.details||"").trim()).length;

  // ---------- bargaining ----------
  const b=s.bargain||{};
  const setB=(patch)=>setS(v=>({...v,bargain:{enabled:false,mode:"limited",max_discount_pct:5,custom:"",...(v.bargain||{}),...patch}}));

  // The training checklist — six honest checks, each flips only when the owner
  // has actually given the bot that material.
  const checks=[
    { label:"Identity",  done:!!(s.botName&&s.greeting),                                        hint:"bot name + greeting (Behavior tab)" },
    { label:"Business",  done:!!(q.description||"").trim(),                                     hint:"describe your business (Train tab)" },
    { label:isEcom?"Policies":"Services", done:isEcom?!!(q.delivery&&q.payment):!!(q.services||"").trim(), hint:isEcom?"delivery + payment":"services you offer" },
    { label:"Q&A",       done:!!(q.faq||"").trim(),                                             hint:"common questions (Train tab)" },
    { label:"Offers",    done:activeOffers>0,                                                   hint:"optional — running offers (Offers tab)" },
    { label:"Bargaining",done:!!s.bargain&&("enabled" in (s.bargain||{})),                      hint:"optional — haggling policy (Bargaining tab)" },
  ];
  const doneCount=checks.filter(c=>c.done).length;

  const TABS=[
    {id:"train",   icon:"ti-messages",       label:"Train"},
    {id:"offers",  icon:"ti-discount-2",     label:activeOffers?`Offers (${activeOffers})`:"Offers"},
    {id:"bargain", icon:"ti-arrows-exchange",label:"Bargaining"},
    {id:"behavior",icon:"ti-adjustments",    label:"Behavior"},
  ];

  const Sec=({icon,title,sub,right})=>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
      <span style={{width:38,height:38,borderRadius:12,background:T.goldBg,color:T.gold,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}><i className={`ti ${icon}`}/></span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:700}}>{title}</div>
        <div style={{fontSize:11.5,color:T.textMuted,marginTop:1}}>{sub}</div>
      </div>
      {right}
    </div>;

  return <div style={{maxWidth:700,paddingBottom:isMobile?90:70}}>
    {/* Checklist strip */}
    <Card style={{marginBottom:12,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 220px",minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:700}}>Train your bot</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2,lineHeight:1.5}}>
          {doneCount>=4?"Core training done — offers and bargaining make it sell even better.":`${doneCount} of ${checks.length} steps done. The more you give it, the better it sells.`}
        </div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {checks.map(c=><span key={c.label} title={c.hint} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:600,padding:"4px 10px",borderRadius:20,background:c.done?`color-mix(in srgb, ${T.success} 12%, transparent)`:T.bgAlt,color:c.done?T.success:T.textDim,border:`0.5px solid ${c.done?`color-mix(in srgb, ${T.success} 35%, transparent)`:T.border}`}}>
          <i className={`ti ${c.done?"ti-check":"ti-point"}`} style={{fontSize:12}}/>{c.label}
        </span>)}
      </div>
    </Card>

    {/* Sub-tab pills */}
    <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
      {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className="ui-btn" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"9px 16px",borderRadius:12,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,background:tab===t.id?"var(--acc-grad)":T.card,color:tab===t.id?"#fff":T.textMuted,boxShadow:tab===t.id?"var(--acc-glow)":"var(--nm-sm)"}}>
        <i className={`ti ${t.icon}`} style={{fontSize:15}}/>{t.label}
      </button>)}
    </div>

    {/* ============ TRAIN ============ */}
    {tab==="train"&&<>
      <Card style={{marginBottom:12}}>
        <Sec icon="ti-messages" title="Teach it your business" sub="Answer the bot's questions — it writes its own training from them"
          right={<div style={{display:"inline-flex",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:9,padding:3,gap:3,flexShrink:0}}>
            {[["chat","Chat"],["form","Form"]].map(([id,l])=>
              <button key={id} onClick={()=>setView(id)} style={{padding:"5px 12px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11.5,fontWeight:600,background:view===id?T.gold:"transparent",color:view===id?"#fff":T.textMuted}}>{l}</button>)}
          </div>}/>

        {view==="chat"&&<>
          <div ref={chatRef} style={{display:"flex",flexDirection:"column",gap:12,maxHeight:380,overflowY:"auto",padding:"4px 2px",marginBottom:12}}>
            <BotBubble>Hi! I'm your bot. Answer a few questions and I'll learn your business — you can write in Bangla, English or a mix. Skip anything, change anything later.</BotBubble>
            {steps.slice(0,iv).map((st,i)=><div key={st.key} style={{display:"flex",flexDirection:"column",gap:12}}>
              <BotBubble>{st.q}</BotBubble>
              <MeBubble skipped={!(q[st.key]||"").trim()}>{(q[st.key]||"").trim()||"(skipped)"}</MeBubble>
            </div>)}
            {iv<steps.length&&<BotBubble>{steps[iv].q}</BotBubble>}
            {iv>=steps.length&&<BotBubble>
              That's everything — thank you! Now press the button below and I'll turn your answers into my business profile. You can re-run this chat anytime; your answers stay.
            </BotBubble>}
          </div>

          {iv<steps.length?<>
            {steps[iv].ta
              ?<Inp textarea value={ivInput} onChange={e=>setIvInput(e.target.value)} placeholder={steps[iv].ph} inputStyle={{minHeight:90,lineHeight:1.6}} style={{marginBottom:10}}/>
              :<Inp value={ivInput} onChange={e=>setIvInput(e.target.value)} placeholder={steps[iv].ph} style={{marginBottom:10}}/>}
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <Btn gold onClick={ivSend}><i className="ti ti-send" style={{marginRight:6}}/>Send</Btn>
              <Btn small onClick={ivSkip}>Skip</Btn>
              {iv>0&&<Btn small onClick={ivBack}><i className="ti ti-arrow-back-up" style={{marginRight:4}}/>Back</Btn>}
              <span style={{marginLeft:"auto",fontSize:11.5,color:T.textDim}}>{iv+1} / {steps.length}</span>
            </div>
          </>:<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <Btn gold onClick={()=>regenerate()} disabled={gen}><i className="ti ti-sparkles" style={{marginRight:6}}/>{gen?"Generating...":"Generate my bot's profile"}</Btn>
            <Btn small onClick={()=>setIv(0)}><i className="ti ti-refresh" style={{marginRight:4}}/>Redo the chat</Btn>
          </div>}
          {genMsg&&<div style={{fontSize:12,color:T.textMuted,marginTop:10}}>{genMsg}</div>}
        </>}

        {view==="form"&&<>
          <Inp textarea label="Describe your business" value={q.description||""} onChange={e=>setQ({description:e.target.value})}
            inputStyle={{minHeight:130,lineHeight:1.65}}
            placeholder={isEcom
              ? "What do you sell? What are your prices? How do you deliver and take payment?"
              : "What services do you offer? What do they cost? How do clients book you?"}/>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11.5,color:T.textMuted,marginBottom:8}}>Start from an example and edit it:</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {(isEcom?SAMPLE_ECOM:SAMPLE_AGENCY).map(ex=><button key={ex.label} onClick={()=>setQ({description:ex.text})}
                style={{padding:"6px 13px",borderRadius:20,border:`1px solid ${T.border}`,background:T.bgAlt,color:T.textMuted,fontSize:12,cursor:"pointer"}}>
                {ex.label}
              </button>)}
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
          <Inp label="Working hours" value={q.hours||""} onChange={e=>setQ({hours:e.target.value})}/>
          <Inp textarea label="Common questions & answers" value={q.faq||""} onChange={e=>setQ({faq:e.target.value})}/>
          <Inp textarea label="Anything else (special rules)" value={q.special||""} onChange={e=>setQ({special:e.target.value})}/>
          <Btn gold onClick={()=>regenerate()} disabled={gen}><i className="ti ti-sparkles" style={{marginRight:6}}/>{gen?"Generating...":"Regenerate with AI"}</Btn>
          {genMsg&&<span style={{fontSize:12,color:T.textMuted,marginLeft:10}}>{genMsg}</span>}
        </>}
      </Card>
    </>}

    {/* ============ OFFERS ============ */}
    {tab==="offers"&&<Card style={{marginBottom:12}}>
      <Sec icon="ti-discount-2" title="Running offers" sub="The bot quotes these exactly — never invents its own"
        right={<Btn small gold onClick={addOffer}><i className="ti ti-plus" style={{marginRight:4}}/>Add offer</Btn>}/>
      {!offers.length&&<div style={{textAlign:"center",padding:"26px 16px"}}>
        <i className="ti ti-discount-2" style={{fontSize:28,color:T.textDim}}/>
        <div style={{fontSize:13.5,fontWeight:600,margin:"10px 0 6px"}}>No offers yet</div>
        <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7,maxWidth:380,margin:"0 auto 14px"}}>
          Example: <b style={{color:T.text}}>"৩টা টি-শার্ট ৯৯৯৳"</b> — details: "free delivery included, any colours".
          The bot mentions the right offer at the right moment and applies the price exactly.
        </div>
        <Btn gold onClick={addOffer}><i className="ti ti-plus" style={{marginRight:6}}/>Add your first offer</Btn>
      </div>}
      {offers.map((o,i)=><div key={o.id} style={{border:`0.5px solid ${T.border}`,borderRadius:12,padding:"14px 14px 6px",marginBottom:10,background:o.active===false?T.bgAlt:"transparent",opacity:o.active===false?0.7:1}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Badge color={o.active===false?T.textDim:T.success}>{o.active===false?"Off":"Live"}</Badge>
          <span style={{fontSize:11.5,color:T.textDim}}>Offer {i+1}</span>
          <span style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>patchOffer(o.id,{active:o.active===false})} title={o.active===false?"Turn on":"Turn off"} style={{width:34,height:20,borderRadius:11,border:"none",cursor:"pointer",background:o.active===false?T.border:T.success,position:"relative"}}>
              <span style={{position:"absolute",top:2,left:o.active===false?2:16,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .15s"}}/>
            </button>
            <button onClick={()=>delOffer(o.id)} title="Delete offer" style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:16,padding:2}}><i className="ti ti-trash"/></button>
          </span>
        </div>
        <Inp label="Offer (what the customer hears)" value={o.title||""} onChange={e=>patchOffer(o.id,{title:e.target.value})} placeholder="e.g. ৩টা টি-শার্ট মাত্র ৯৯৯৳"/>
        <Inp label="Details (conditions, what's included)" value={o.details||""} onChange={e=>patchOffer(o.id,{details:e.target.value})} placeholder="e.g. ফ্রি ডেলিভারি, যেকোনো কালার, স্টক থাকা পর্যন্ত"/>
        <div style={{maxWidth:220}}>
          <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Valid until <span style={{textTransform:"none",letterSpacing:0}}>(optional)</span></label>
          <input type="date" value={o.valid_until||""} onChange={e=>patchOffer(o.id,{valid_until:e.target.value})}
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`0.5px solid ${T.border}`,background:T.bgAlt,color:T.text,fontSize:13,marginBottom:12,colorScheme:"inherit"}}/>
        </div>
      </div>)}
      {offers.length>0&&<div style={{fontSize:11.5,color:T.textDim,lineHeight:1.7,marginTop:4}}>
        <i className="ti ti-info-circle" style={{marginRight:4}}/>Expired offers stop automatically on their end date. Remember to press Save below.
      </div>}
    </Card>}

    {/* ============ BARGAINING ============ */}
    {tab==="bargain"&&<Card style={{marginBottom:12}}>
      <Sec icon="ti-arrows-exchange" title="Bargaining (দরদাম)" sub="Customers will haggle — decide how your bot responds"
        right={<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:T.textMuted,cursor:"pointer",flexShrink:0}}>
          <input type="checkbox" checked={!!b.enabled} onChange={e=>setB({enabled:e.target.checked})}/>
          {b.enabled?"Allowed":"Fixed price"}
        </label>}/>
      {!b.enabled&&<div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7}}>
        <b style={{color:T.text}}>Fixed price mode.</b> When a customer asks for a discount, the bot politely holds your
        listed price — it highlights the value and any running offer instead, and never gives a discount of its own.
        {!("enabled" in b)&&<div style={{marginTop:8,fontSize:11.5,color:T.textDim}}>Tip: tick the box once (even to keep it off) and Save, so the bot knows your policy explicitly.</div>}
      </div>}
      {b.enabled&&<>
        <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7,marginBottom:14}}>
          The bot negotiates like a skilled shopkeeper: holds the price first, concedes in small steps,
          and <b style={{color:T.text}}>never goes below your limit — and never reveals it.</b>
        </div>
        <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>How should it negotiate?</label>
        <Select wide value={b.mode||"limited"} onChange={v=>setB({mode:v})} style={{marginBottom:14}}
          options={[{value:"limited",label:"Up to a discount limit I set",icon:"ti-percentage"},{value:"custom",label:"My own rule (write it yourself)",icon:"ti-pencil"}]}/>
        {(b.mode||"limited")==="limited"&&<div style={{maxWidth:240}}>
          <Inp label="Maximum discount (%)" type="number" min={1} max={50} value={b.max_discount_pct??5}
            onChange={e=>setB({max_discount_pct:Math.min(50,Math.max(1,Number(e.target.value)||1))})}/>
          <div style={{fontSize:11.5,color:T.textDim,lineHeight:1.6,marginTop:-6}}>
            e.g. 5 — on a ৳1,000 product the bot can go down to ৳950, never lower.
          </div>
        </div>}
        {b.mode==="custom"&&<Inp textarea label="Your bargaining rule" value={b.custom||""} onChange={e=>setB({custom:e.target.value})}
          placeholder={"e.g. ৫০০৳-এর নিচের পণ্যে কোনো ছাড় নেই। এর উপরে সর্বোচ্চ ৫০৳ ছাড়। ৩টার বেশি নিলে ডেলিভারি ফ্রি বলা যাবে।"}
          inputStyle={{minHeight:100,lineHeight:1.65}}/>}
      </>}
    </Card>}

    {/* ============ BEHAVIOR ============ */}
    {tab==="behavior"&&<>
      <Card style={{marginBottom:12}}>
        <Sec icon="ti-id-badge-2" title="Bot identity" sub="Who answers your customers, and how it sounds"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          <Inp label="Bot name" value={s.botName||""} onChange={e=>setS({...s,botName:e.target.value})}/>
          <Inp label="Business name" value={s.businessName||""} onChange={e=>setS({...s,businessName:e.target.value})}/>
        </div>
        <Inp label="Greeting" value={s.greeting||""} onChange={e=>setS({...s,greeting:e.target.value})}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          <div>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Bot tone</label>
            <Select wide value={q.tone||"Friendly and helpful"} onChange={v=>setQ({tone:v})}
              options={["Friendly and helpful","Professional and formal","Casual and fun"]}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Customer languages</label>
            <Select wide value={q.languages||"Follow the customer's language"} onChange={v=>setQ({languages:v})}
              options={["Follow the customer's language","Bangla only","English only"]}/>
          </div>
        </div>
      </Card>

      <Card style={{marginBottom:12}}>
        <Sec icon="ti-repeat" title="Automation" sub="What the bot does without being asked"
          right={<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:T.textMuted,cursor:"pointer",flexShrink:0}}>
            <input type="checkbox" checked={!!s.followup?.enabled} onChange={e=>setS(v=>({...v,followup:{...(v.followup||{}),enabled:e.target.checked}}))}/>
            {s.followup?.enabled?"On":"Off"}
          </label>}/>
        <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7,marginBottom:s.followup?.enabled?14:0}}>
          <b style={{color:T.text}}>Follow-up message.</b>{" "}
          {isEcom
            ?"Someone asked about a product but never ordered — send them one reminder."
            :"Someone asked about a service but never booked — send them one reminder."}
          {" "}They get it once, and it stops immediately if they reply.
        </div>
        {s.followup?.enabled&&<>
          <div style={{maxWidth:220,marginBottom:14}}>
            <Inp label="Send after (hours)" type="number" min={1} max={23}
              value={s.followup?.delay_hours??20}
              onChange={e=>setS(v=>({...v,followup:{...(v.followup||{}),delay_hours:Number(e.target.value)}}))}/>
            <div style={{fontSize:11.5,color:T.textDim,marginTop:6,lineHeight:1.6}}>
              Maximum 23. Facebook, Instagram and WhatsApp close the messaging window 24 hours after the customer's last message, so anything later cannot be delivered.
            </div>
          </div>
          <Inp label="Message" textarea maxLength={600}
            value={isEcom?(s.followup?.message_ecommerce??""):(s.followup?.message_agency??"")}
            placeholder={isEcom
              ?"আসসালামু আলাইকুম! আপনি আমাদের পণ্য নিয়ে জানতে চেয়েছিলেন..."
              :"আসসালামু আলাইকুম! আপনি আমাদের সার্ভিস নিয়ে জানতে চেয়েছিলেন..."}
            onChange={e=>setS(v=>({...v,followup:{...(v.followup||{}),[isEcom?"message_ecommerce":"message_agency"]:e.target.value}}))}/>
          <div style={{fontSize:11.5,color:T.textDim,marginTop:6}}>Leave empty to use the default message.</div>
        </>}
      </Card>

      <Card style={{marginBottom:12}}>
        <Sec icon="ti-lock" title="Guardrails" sub="Platform rules that keep every bot safe — always on, cannot be changed"/>
        <Accordion icon="ti-shield-check" title="See the rules" subtitle={isEcom?"E-commerce rules active":"Agency rules active"}>
          <pre style={{fontSize:12,color:T.textMuted,whiteSpace:"pre-wrap",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:12,margin:0,lineHeight:1.7}}>{CORE_BASE_DISPLAY+"\n"+(isEcom?CORE_ECOM_DISPLAY:CORE_AGENCY_DISPLAY)}</pre>
        </Accordion>
      </Card>

      <Accordion icon="ti-file-text" title="Advanced — the bot's business profile" subtitle="The exact text the bot works from; edit only if you know why">
        <div style={{height:6}}/>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>The Train tab writes this for you. Edit freely — the guardrails above are added automatically on top.</div>
        <Inp textarea value={s.businessPrompt||s.systemPrompt||""} onChange={e=>setS({...s,businessPrompt:e.target.value})} style={{marginBottom:0}}/>
      </Accordion>
    </>}

    {/* Save bar */}
    <div style={{position:"fixed",left:0,right:0,bottom:isMobile?66:0,display:"flex",justifyContent:"center",pointerEvents:"none",zIndex:40,padding:"0 16px"}}>
      <div style={{width:"100%",maxWidth:700,display:"flex",justifyContent:"flex-end",padding:"0 0 12px"}}>
        {(dirty||saved)&&<div style={{pointerEvents:"auto",display:"flex",alignItems:"center",gap:12,background:T.card,border:`1px solid ${saved?`color-mix(in srgb, ${T.success} 40%, transparent)`:T.border}`,borderRadius:14,boxShadow:"0 10px 30px rgba(0,0,0,.14)",padding:"10px 12px 10px 16px"}}>
          <span style={{fontSize:12.5,color:saved?T.success:T.textMuted,display:"flex",alignItems:"center",gap:6}}>
            <i className={`ti ${saved?"ti-check":"ti-pencil"}`} style={{fontSize:14}}/>{saved?"Saved":"Unsaved changes"}
          </span>
          {!saved&&<Btn gold onClick={save}><i className="ti ti-check" style={{marginRight:6}}/>Save</Btn>}
        </div>}
      </div>
    </div>
  </div>;
}
