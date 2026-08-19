"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Inp, Badge, Accordion, Select, words, SAMPLE_ECOM, SAMPLE_AGENCY } from "./ui.js";
import { api } from "./session.js";

// The Settings tab, moved out of dashboard-client.js unchanged.

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
  return <div style={{maxWidth:700}}>
    <div style={{marginBottom:10}}/>
    <Card style={{marginBottom:10}}><div style={{fontSize:15,fontWeight:500,marginBottom:16}}>General</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Inp label="Bot name" value={s.botName||""} onChange={e=>setS({...s,botName:e.target.value})}/>
        <Inp label="Business name" value={s.businessName||""} onChange={e=>setS({...s,businessName:e.target.value})}/>
      </div>
      <Inp label="Greeting" value={s.greeting||""} onChange={e=>setS({...s,greeting:e.target.value})}/>
    </Card>

    <Accordion icon="ti-lock" title="Core rules" subtitle="Always active, cannot be changed">
      <div style={{fontSize:12,color:T.textMuted,marginBottom:10}}>These platform rules keep every bot accurate and safe. They are always active and cannot be changed.</div>
      <pre style={{fontSize:12,color:T.textMuted,whiteSpace:"pre-wrap",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:12,margin:0,lineHeight:1.7}}>{CORE_BASE_DISPLAY+"\n"+(isEcom?CORE_ECOM_DISPLAY:CORE_AGENCY_DISPLAY)}</pre>
      <div style={{fontSize:11.5,color:T.textDim,marginTop:8}}><i className="ti ti-info-circle" style={{marginRight:4}}/>{isEcom?"E-commerce rules active — product matching, display and order flow.":"Agency rules active — knowledge-base answers and meeting booking flow."}</div>
    </Accordion>

    <Accordion icon="ti-wand" title="Bot training" subtitle="Describe your business in your own words">
      <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>Describe your business in your own words — AI rewrites the business profile below, inside the locked structure.</div>

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
        <span style={{fontSize:12.5,color:T.text}}>More details <span style={{color:T.textDim}}>— optional, improves accuracy</span></span>
        <i className={`ti ti-chevron-${showMore?"up":"down"}`} style={{fontSize:15,color:T.textMuted}}/>
      </div>

      {showMore&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Bot tone</label>
            <Select wide value={q.tone||"Friendly and helpful"} onChange={v=>setQ({tone:v})}
              options={["Friendly and helpful","Professional and formal","Casual and fun"]}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Customer languages</label>
            <Select wide value={q.languages||"Follow the customer's language"} onChange={v=>setQ({languages:v})}
              options={["Follow the customer's language","Bangla only","English only"]}/>
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
      </>}
      <Btn gold onClick={regenerate} disabled={gen}><i className="ti ti-sparkles" style={{marginRight:6}}/>{gen?"Generating...":"Regenerate with AI"}</Btn>
      {genMsg&&<span style={{fontSize:12,color:T.textMuted,marginLeft:10}}>{genMsg}</span>}
    </Accordion>

    <Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:6}}>
        <div style={{fontSize:15,fontWeight:500}}>Follow-up message</div>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:T.textMuted,cursor:"pointer"}}>
          <input type="checkbox" checked={!!s.followup?.enabled} onChange={e=>setS(v=>({...v,followup:{...(v.followup||{}),enabled:e.target.checked}}))}/>
          {s.followup?.enabled?"On":"Off"}
        </label>
      </div>
      <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7,marginBottom:14}}>
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

    <AIKeyBox/>

    <Accordion icon="ti-file-text" title="Business prompt" subtitle="What the bot knows about you">
      <div style={{height:6}}/>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>This is your bot's business knowledge. Edit freely — the locked core rules above are added automatically on top.</div>
      <Inp textarea value={s.businessPrompt||s.systemPrompt||""} onChange={e=>setS({...s,businessPrompt:e.target.value})} style={{marginBottom:0}}/>
    </Accordion>
    <Btn gold onClick={save}><i className="ti ti-check" style={{marginRight:6}}/>{saved?"Saved!":"Save settings"}</Btn>
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
    api("/api/ai-key").then(r => r.json()).then(setSt).catch(() => {});
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
