"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Inp, Badge, Accordion, Select, useIsMobile, SAMPLE_ECOM, SAMPLE_AGENCY } from "./ui.js";
import { api } from "./session.js";

// The Bot Training tab (page key "settings"). Everything here teaches or tunes
// the bot, so the page walks the owner through it in order: who the bot is,
// what it knows, what it may never do, what runs on its own — with a training
// checklist up top and a save bar that appears when something changed.

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

export default function Settings({settings,setSettings}) {
  const [s,setS]=useState(settings);
  const [saved,setSaved]=useState(false);
  const [gen,setGen]=useState(false);
  const [genMsg,setGenMsg]=useState("");
  const [showMore,setShowMore]=useState(false);
  const [me,setMe]=useState(null);
  const isMobile=useIsMobile();
  useEffect(()=>{setS(settings);},[settings]);
  useEffect(()=>{api("/api/me").then(r=>r.json()).then(setMe).catch(()=>{});},[]);
  const bType=me?.client?.business_type||"ecommerce";
  const isEcom=bType==="ecommerce";
  const q=s.questionnaire||{};
  const setQ=(patch)=>setS(v=>({...v,questionnaire:{...(v.questionnaire||{}),...patch}}));
  const dirty=JSON.stringify(s)!==JSON.stringify(settings);
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

  // The training checklist. Four honest checks, no invented percentages: each
  // one flips when the owner has actually given the bot that material.
  const checks=[
    { label:"Identity",  done:!!(s.botName&&s.greeting),                                        hint:"bot name + greeting" },
    { label:"Business",  done:!!(q.description||"").trim(),                                     hint:"describe your business" },
    { label:isEcom?"Policies":"Services", done:isEcom?!!(q.delivery&&q.payment):!!(q.services||"").trim(), hint:isEcom?"delivery + payment":"services you offer" },
    { label:"Q&A",       done:!!(q.faq||"").trim(),                                             hint:"common questions" },
  ];
  const doneCount=checks.filter(c=>c.done).length;

  // One numbered section header, used by every card so the page reads as a
  // guided course rather than a pile of settings.
  const Sec=({n,icon,title,sub,right})=>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
      <span style={{width:38,height:38,borderRadius:12,background:T.goldBg,color:T.gold,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,position:"relative"}}>
        <i className={`ti ${icon}`}/>
        <span style={{position:"absolute",top:-6,left:-6,width:17,height:17,borderRadius:"50%",background:T.gold,color:"#fff",fontSize:10.5,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{n}</span>
      </span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:700}}>{title}</div>
        <div style={{fontSize:11.5,color:T.textMuted,marginTop:1}}>{sub}</div>
      </div>
      {right}
    </div>;

  return <div style={{maxWidth:700,paddingBottom:isMobile?90:70}}>
    {/* Checklist strip: where the training stands, at a glance. */}
    <Card style={{marginBottom:12,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 220px",minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:700}}>Train your bot</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2,lineHeight:1.5}}>
          {doneCount===checks.length
            ?"All four training steps are done — keep refining anytime."
            :`${doneCount} of ${checks.length} training steps done. The more you give it, the better it sells.`}
        </div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {checks.map(c=><span key={c.label} title={c.hint} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:600,padding:"4px 10px",borderRadius:20,background:c.done?`color-mix(in srgb, ${T.success} 12%, transparent)`:T.bgAlt,color:c.done?T.success:T.textDim,border:`0.5px solid ${c.done?`color-mix(in srgb, ${T.success} 35%, transparent)`:T.border}`}}>
          <i className={`ti ${c.done?"ti-check":"ti-point"}`} style={{fontSize:12}}/>{c.label}
        </span>)}
      </div>
    </Card>

    {/* 1 — who the bot is */}
    <Card style={{marginBottom:12}}>
      <Sec n={1} icon="ti-id-badge-2" title="Bot identity" sub="Who answers your customers, and how it sounds"/>
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

    {/* 2 — what the bot knows */}
    <Card style={{marginBottom:12}}>
      <Sec n={2} icon="ti-wand" title="Teach it your business" sub="Write it in your own words — AI turns it into the bot's business profile"/>
      <Inp textarea label="Describe your business" value={q.description||""} onChange={e=>setQ({description:e.target.value})}
        inputStyle={{minHeight:140,lineHeight:1.65}}
        placeholder={isEcom
          ? "What do you sell? What are your prices? How do you deliver and take payment? Anything customers always ask?"
          : "What services do you offer? What do they cost? How do clients book you? Anything clients always ask?"}/>
      <div style={{fontSize:11.5,color:T.textDim,marginTop:-8,marginBottom:14,lineHeight:1.6}}>
        Write it like you are explaining to a new employee. Bangla, English or a mix — all fine.
      </div>

      <div style={{marginBottom:16}}>
        <div style={{fontSize:11.5,color:T.textMuted,marginBottom:8}}>Start from an example and edit it:</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {(isEcom?SAMPLE_ECOM:SAMPLE_AGENCY).map(ex=><button key={ex.label} onClick={()=>setQ({description:ex.text})}
            style={{padding:"6px 13px",borderRadius:20,border:`1px solid ${T.border}`,background:T.bgAlt,color:T.textMuted,fontSize:12,cursor:"pointer"}}>
            {ex.label}
          </button>)}
        </div>
      </div>

      <div onClick={()=>setShowMore(v=>!v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"11px 13px",borderRadius:9,background:T.bgAlt,border:`0.5px solid ${T.border}`,marginBottom:16}}>
        <span style={{fontSize:12.5,color:T.text}}>{isEcom?"Delivery, payment, hours & FAQ":"Services, booking, hours & FAQ"} <span style={{color:T.textDim}}>— optional, improves accuracy</span></span>
        <i className={`ti ti-chevron-${showMore?"up":"down"}`} style={{fontSize:15,color:T.textMuted}}/>
      </div>

      {showMore&&<>
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
      </>}
      <Btn gold onClick={regenerate} disabled={gen}><i className="ti ti-sparkles" style={{marginRight:6}}/>{gen?"Generating...":"Regenerate with AI"}</Btn>
      {genMsg&&<span style={{fontSize:12,color:T.textMuted,marginLeft:10}}>{genMsg}</span>}
    </Card>

    {/* 3 — what it may never do */}
    <Card style={{marginBottom:12}}>
      <Sec n={3} icon="ti-lock" title="Guardrails" sub="Platform rules that keep every bot safe — always on, cannot be changed"/>
      <Accordion icon="ti-shield-check" title="See the rules" subtitle={isEcom?"E-commerce rules active":"Agency rules active"}>
        <pre style={{fontSize:12,color:T.textMuted,whiteSpace:"pre-wrap",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:12,margin:0,lineHeight:1.7}}>{CORE_BASE_DISPLAY+"\n"+(isEcom?CORE_ECOM_DISPLAY:CORE_AGENCY_DISPLAY)}</pre>
        <div style={{fontSize:11.5,color:T.textDim,marginTop:8}}><i className="ti ti-info-circle" style={{marginRight:4}}/>{isEcom?"E-commerce rules active — product matching, display and order flow.":"Agency rules active — knowledge-base answers and meeting booking flow."}</div>
      </Accordion>
    </Card>

    {/* 4 — what runs on its own */}
    <Card style={{marginBottom:12}}>
      <Sec n={4} icon="ti-repeat" title="Automation" sub="What the bot does without being asked"
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

    <Accordion icon="ti-file-text" title="Advanced — the bot's business profile" subtitle="The exact text the bot works from; edit only if you know why">
      <div style={{height:6}}/>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>Step 2 writes this for you. Edit freely — the guardrails above are added automatically on top.</div>
      <Inp textarea value={s.businessPrompt||s.systemPrompt||""} onChange={e=>setS({...s,businessPrompt:e.target.value})} style={{marginBottom:0}}/>
    </Accordion>

    {/* The save bar. Appears the moment anything differs from what is stored,
        so leaving without saving is a choice, never an accident. */}
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

// ── Your AI API key (BYOK) ───────────────────────────────────────────────────
// Renders NOTHING unless the super admin has enabled this account for its own
// key (/api/ai-key answers allowed:false otherwise). With permission, the
// owner pastes a Google AI Studio or OpenAI key here; it is verified with the
// provider before saving, stored encrypted, and shown only masked afterwards.
// From then on their bot runs exclusively on that key — an exhausted or broken
// key pauses the bot politely, it never spends the platform's key.
const AI_PROVIDERS = {
  google: { label: "Google AI Studio", icon: "ti-brand-google", color: "#4285F4", ph: "AIza…", help: "aistudio.google.com → Get API key" },
  openai: { label: "OpenAI", icon: "ti-brand-openai", color: "#10A37F", ph: "sk-…", help: "platform.openai.com → API keys" },
};

export function AIKeyBox({ preview }) {
  const [st, setSt] = useState(preview || null);      // /api/ai-key shape
  const [form, setForm] = useState(null);              // {provider, api_key, model}
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);                // {ok, text}
  const [confirmRm, setConfirmRm] = useState(false);

  useEffect(() => {
    if (preview) return;
    const load = () => api("/api/ai-key", { cache: "no-store" }).then(r => r.json()).then(setSt).catch(() => {});
    load();
    // The super admin can remove this account's access while the tab is open;
    // re-check whenever the owner comes back to it so the box vanishes (or
    // appears) without needing a full reload.
    const onFocus = () => { if (!document.hidden) load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, []);

  if (!st || !st.allowed) return null;
  const hasKey = !!st.has_key;
  const P = hasKey ? AI_PROVIDERS[st.provider] : null;

  const save = async (f) => {
    if (!f?.api_key?.trim() || busy) return;
    setBusy(true); setMsg({ ok: true, text: "Checking your key with " + AI_PROVIDERS[f.provider].label + "…" });
    const r = await api("/api/ai-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: f.provider, api_key: f.api_key.trim(), model: f.model?.trim() || null }) }).then(x => x.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setSt(r); setForm(null);
    setMsg({ ok: true, text: "Verified and saved. Your bot now runs on your own key." });
  };
  const removeKey = async () => {
    setBusy(true);
    const r = await api("/api/ai-key", { method: "DELETE" }).then(x => x.json()).catch(() => ({ error: "network" }));
    setBusy(false); setConfirmRm(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setSt(r); setMsg({ ok: true, text: "Key removed — your bot is back on the platform." });
  };

  return <Card style={{ marginBottom: 10, border: `1px solid color-mix(in srgb, ${T.gold} 25%, transparent)` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
      <span style={{ width: 40, height: 40, borderRadius: 13, background: hasKey ? `${P.color}1a` : T.goldBg, color: hasKey ? P.color : T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        <i className={`ti ${hasKey ? P.icon : "ti-key"}`} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Your AI API key</div>
        <div style={{ fontSize: 12, color: T.textMuted }}>Your account is enabled to run the bot on your own key — your AI usage bills to you, not the platform.</div>
      </div>
    </div>

    {hasKey && !form && <div style={{ padding: "12px 14px", borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{P.label} <span style={{ fontFamily: "monospace", fontWeight: 400, color: T.textMuted, marginLeft: 6 }}>{st.key_mask}</span>{st.model ? <span style={{ color: T.textMuted, fontWeight: 400 }}> · {st.model}</span> : null}</div>
        <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {st.status === "failing"
            ? <Badge color={T.danger}>Not working — bot paused</Badge>
            : <Badge color={T.success}>Active</Badge>}
          {st.status === "failing" && st.last_error && <span style={{ fontSize: 11.5, color: T.textDim, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={st.last_error}>{st.last_error}</span>}
        </div>
        {st.status === "failing" && <div style={{ fontSize: 11.5, color: T.warn, marginTop: 6, lineHeight: 1.5 }}>Your key hit its limit or was rejected, so your bot cannot answer right now. Top up / fix billing with the provider, or paste a new key — replies resume automatically.</div>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn small onClick={() => { setForm({ provider: st.provider, api_key: "", model: st.model || "" }); setMsg(null); }} disabled={busy}>Replace</Btn>
        {confirmRm
          ? <><Btn small danger onClick={removeKey} disabled={busy}>{busy ? "…" : "Yes, remove"}</Btn><Btn small onClick={() => setConfirmRm(false)}>Cancel</Btn></>
          : <Btn small onClick={() => setConfirmRm(true)} disabled={busy} style={{ color: T.danger, background: T.dangerBg }}>Remove</Btn>}
      </div>
    </div>}

    {(!hasKey || form) && (() => {
      const f = form || { provider: "google", api_key: "", model: "" };
      const setF = (patch) => setForm({ ...f, ...patch });
      const PP = AI_PROVIDERS[f.provider];
      return <div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Provider</label>
          <Select wide value={f.provider} onChange={(v) => setForm({ provider: v, api_key: f.api_key, model: "" })}
            options={Object.entries(AI_PROVIDERS).map(([v, p]) => ({ value: v, label: p.label, icon: p.icon }))} />
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 5 }}>Get your key: {PP.help}</div>
        </div>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <input type={show ? "text" : "password"} value={f.api_key} onChange={(e) => setF({ api_key: e.target.value })} placeholder={`Paste your ${PP.label} key — ${PP.ph}`} className="ui-inp"
            style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 56px 13px 16px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
          <button type="button" onClick={() => setShow(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 12, padding: 6, minHeight: 0 }}>{show ? "Hide" : "Show"}</button>
        </div>
        <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 14, lineHeight: 1.6 }}>
          We check the key with {PP.label} before saving, store it encrypted, and never show it again — only a masked form. From then on your bot's replies, photo matching and voice run entirely on your key; if it runs out, your bot pauses until you top it up.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn gold onClick={() => save(f)} disabled={busy || !f.api_key.trim()} style={{ borderRadius: 12 }}>{busy ? "Verifying…" : "Verify & activate"}</Btn>
          {form && hasKey && <Btn onClick={() => { setForm(null); setMsg(null); }} disabled={busy} style={{ borderRadius: 12 }}>Cancel</Btn>}
        </div>
      </div>;
    })()}

    {msg && <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: msg.ok ? T.success : T.danger }}>
      <i className={`ti ${msg.ok ? "ti-check" : "ti-alert-circle"}`} style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
      <span>{msg.text}</span>
    </div>}
  </Card>;
}
