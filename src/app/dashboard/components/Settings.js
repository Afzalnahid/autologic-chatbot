"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Inp, Accordion, words, SAMPLE_ECOM, SAMPLE_AGENCY } from "./ui.js";
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
  const selStyle={width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:13.5};
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
            <select value={q.tone||"Friendly and helpful"} onChange={e=>setQ({tone:e.target.value})} style={selStyle}>
              {["Friendly and helpful","Professional and formal","Casual and fun"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Customer languages</label>
            <select value={q.languages||"Follow the customer's language"} onChange={e=>setQ({languages:e.target.value})} style={selStyle}>
              {["Follow the customer's language","Bangla only","English only"].map(t=><option key={t}>{t}</option>)}
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

    <Accordion icon="ti-file-text" title="Business prompt" subtitle="What the bot knows about you">
      <div style={{height:6}}/>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>This is your bot's business knowledge. Edit freely — the locked core rules above are added automatically on top.</div>
      <Inp textarea value={s.businessPrompt||s.systemPrompt||""} onChange={e=>setS({...s,businessPrompt:e.target.value})} style={{marginBottom:0}}/>
    </Accordion>
    <Btn gold onClick={save}><i className="ti ti-check" style={{marginRight:6}}/>{saved?"Saved!":"Save settings"}</Btn>
  </div>;
}
