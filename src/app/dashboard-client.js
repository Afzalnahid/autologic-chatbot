"use client";
import { useState, useEffect, useRef, useCallback } from "react";

import { T, words, useIsMobile, Btn, Card, Inp, Motion, Theme, useTheme, ThemeToggle, Select, Segmented, OnboardFrame, SAMPLE_ECOM, SAMPLE_AGENCY } from "./dashboard/components/ui.js";
import { api, getSb, setAuthToken } from "./dashboard/components/session.js";
import Broadcast from "./dashboard/components/Broadcast.js";
import WebsiteWidget from "./dashboard/components/WebsiteWidget.js";
import Billing from "./dashboard/components/Billing.js";
import Analytics from "./dashboard/components/Analytics.js";
import Orders from "./dashboard/components/Orders.js";
import Inventory from "./dashboard/components/Inventory.js";
import Comments from "./dashboard/components/Comments.js";
import Profile from "./dashboard/components/Profile.js";
import Settings from "./dashboard/components/Settings.js";
import KnowledgeBase from "./dashboard/components/KnowledgeBase.js";
import Bookings from "./dashboard/components/Bookings.js";
import Channels from "./dashboard/components/Channels.js";
import Conversations from "./dashboard/components/Conversations.js";

const PAGES = ["analytics","conversations","comments","broadcast","inventory","orders","channels","billing","settings","profile"];
// Grouped and ordered the way the day runs: see how it is going, handle people,
// reach out, then the shop, then the plumbing.
const GROUPS = [
  { title: "Overview",  pages: ["analytics","conversations","comments"] },
  { title: "Outreach",  pages: ["broadcast","channels"] },
  { title: "Business",  pages: ["orders","inventory"] },
  { title: "Account",   pages: ["settings","billing","profile"] },
];
const ICONS = ["ti-chart-bar","ti-messages","ti-message-circle-2","ti-speakerphone","ti-package","ti-shopping-cart","ti-plug","ti-credit-card","ti-wand","ti-user"];
// "Bot Training" is the settings page: everything on it teaches or tunes the
// bot, and owners looked straight past a tab called "Settings" for exactly
// that. The page key stays "settings" so links and code paths are untouched.
const LABELS = ["Analytics","Conversations","Comments","Broadcast","Inventory","Orders","Channels","Billing","Bot Training","Profile"];





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
  // Terms are agreed to at signup, and the links have to work — Meta's review
  // checks them, and this is the only place a customer is asked to accept them.
  const [agreed,setAgreed]=useState(false);
  const go=async()=>{
    if(busy) return;
    if(!email||!pw){ setErr("Enter your email and password."); return; }
    if(mode==="signup"&&!agreed){ setErr("Please accept the terms to continue."); return; }
    setBusy(true); setErr(""); setMsg("");
    try{
      let res;
      if(mode==="signup") res=await getSb().auth.signUp({email,password:pw});
      else res=await getSb().auth.signInWithPassword({email,password:pw});
      if(res.error) throw res.error;
      const session=res.data.session;
      if(!session){setErr("Check your email to confirm, then sign in.");setBusy(false);return;}
      setAuthToken(session.access_token);
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
  // Sign in stays clickable and answers with a message. A dead button teaches
  // nothing; only signup waits, because the checkbox is a consent we must have.
  const canSubmit = !busy && (mode==="signin" ? true : (email && pw && agreed));
  const signup = mode==="signup";

  return <div className="auth-wrap">
    <Theme/><Motion/>
    <div className="auth-card">

      {/* The blue half: one sentence, and the way across to the other mode. */}
      <div className="auth-side">
        <div className="auth-pill">{signup?"Welcome back":"New here"}</div>
        <div className="auth-hello">{signup?"Hello, friend!":"Start free"}</div>
        <div className="auth-hello-sm">{signup?"Hello, friend!":"Start free — 3 days"}</div>
        <p className="auth-copy">
          {signup
            ? "Already have an account? Sign in and pick up where your customers left off."
            : "Three days free, no card needed. Connect Facebook, Instagram, WhatsApp and your own site."}
        </p>
        <button type="button" className="auth-ghost"
          onClick={()=>{setMode(m=>m==="signin"?"signup":"signin");setErr("");setMsg("");}}>
          {signup?"Sign in":"Create account"}
        </button>
      </div>

      {/* The form half. */}
      <div className="auth-form">
        <div className="auth-brand">
          <span className="auth-mark"><i className="ti ti-bolt"/></span> Autologic
        </div>
        <h1 className="auth-title">{signup?"Create account":"Welcome back"}</h1>
        <p className="auth-sub">{signup?"Sign up and begin your experience":"Sign in to your dashboard"}</p>

        {signup&&<div className="emb"><input value={biz} onChange={e=>setBiz(e.target.value)} placeholder="Business name"/></div>}
        <div className="emb"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address"/></div>
        <div className="emb">
          <input type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); e.currentTarget.blur(); } }} placeholder={signup?"Create password":"Password"} style={{paddingRight:52}}/>
          <button type="button" className="emb-eye" onClick={()=>setShowPw(v=>!v)}>{showPw?"Hide":"Show"}</button>
        </div>

        {signup
          ? <label className="auth-terms">
              <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>
              <span>I agree to the <a href="/terms" target="_blank" rel="noopener">terms</a> and <a href="/privacy" target="_blank" rel="noopener">privacy policy</a></span>
            </label>
          : <div className="auth-forgot"><span onClick={forgot}>Forgot password?</span></div>}

        <button className="auth-go" onClick={go} disabled={!canSubmit}>
          {busy?"Please wait…":(signup?"Create account":"Sign in")}
        </button>

        {err&&<div className="auth-err">{err}</div>}
        {msg&&<div className="auth-msg">{msg}</div>}

        <div className="auth-swap" onClick={()=>{setMode(m=>m==="signin"?"signup":"signin");setErr("");setMsg("");}}>
          {signup?"Already have an account? Sign in":"New here? Create account"}
        </div>
      </div>
    </div>

    <style dangerouslySetInnerHTML={{__html:`
      .auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center;
        padding: 20px; background: ${T.bg} }
      .auth-card { display: grid; grid-template-columns: 1fr 1fr; width: min(880px, 100%);
        border-radius: 26px; overflow: hidden; background: ${T.card};
        border: 1px solid ${T.border}; box-shadow: ${T.nmOut} }

      .auth-side { background: linear-gradient(160deg, ${T.gold}, ${T.goldDim}); color: #fff;
        padding: 46px 38px; display: flex; flex-direction: column; align-items: center;
        justify-content: center; text-align: center; gap: 14px }
      .auth-pill { font-size: 11.5px; font-weight: 600; padding: 6px 14px; border-radius: 999px;
        background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.28) }
      .auth-hello { font-size: 30px; font-weight: 700; letter-spacing: -.02em }
      .auth-copy { font-size: 14px; line-height: 1.65; opacity: .92; max-width: 300px; margin: 0 }
      .auth-ghost { margin-top: 8px; padding: 12px 30px; border-radius: 12px; cursor: pointer;
        font-size: 14px; font-weight: 600; color: #fff; background: rgba(255,255,255,.14);
        border: 1px solid rgba(255,255,255,.42);
        transition: background .18s ease-out, transform .14s ease-out }
      .auth-ghost:hover { background: rgba(255,255,255,.24) }
      .auth-ghost:active { transform: scale(.97) }

      .auth-form { padding: 44px 40px; text-align: center }
      .auth-brand { display: inline-flex; align-items: center; gap: 9px; font-size: 15px;
        font-weight: 700; color: ${T.text}; margin-bottom: 22px }
      .auth-mark { width: 28px; height: 28px; border-radius: 9px; background: ${T.accGrad}; box-shadow: ${T.accGlow};
        color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 16px }
      .auth-title { margin: 0 0 6px; font-size: 26px; font-weight: 700; letter-spacing: -.02em; color: ${T.text} }
      .auth-sub { margin: 0 0 26px; font-size: 13.5px; color: ${T.textMuted} }

      /* The embossed field from the reference: pressed into the surface rather
         than drawn on top of it. Both themes get their own shadow pair. */
      .emb { position: relative; margin-bottom: 14px }
      .emb input { width: 100%; padding: 14px 16px; border-radius: 14px; border: 1px solid ${T.border};
        background: ${T.bgAlt}; color: ${T.text}; font-size: 14px; font-family: inherit;
        box-shadow: inset 2px 2px 6px color-mix(in srgb, ${T.text} 8%, transparent),
                    inset -2px -2px 6px color-mix(in srgb, ${T.card} 90%, transparent);
        transition: border-color .16s ease-out, box-shadow .18s ease-out }
      .emb input::placeholder { color: ${T.textDim} }
      .emb input:focus { outline: none; border-color: ${T.gold};
        box-shadow: 0 0 0 3px color-mix(in srgb, ${T.gold} 22%, transparent) }
      .emb-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer; color: ${T.textMuted}; font-size: 12px; padding: 6px }

      .auth-terms { display: flex; align-items: flex-start; gap: 9px; text-align: left;
        font-size: 12.5px; color: ${T.textMuted}; margin: 4px 0 18px; cursor: pointer; line-height: 1.5 }
      .auth-terms input { width: 16px; height: 16px; accent-color: ${T.gold}; margin-top: 1px; cursor: pointer }
      .auth-terms a { color: ${T.gold} }
      .auth-forgot { text-align: right; margin: 2px 0 18px }
      .auth-forgot span { font-size: 12.5px; color: ${T.gold}; cursor: pointer }

      .auth-go { width: 100%; padding: 15px; border-radius: 14px; border: none; cursor: pointer;
        font-size: 15px; font-weight: 700; color: #fff; font-family: inherit;
        background: linear-gradient(160deg, ${T.gold}, ${T.goldDim});
        box-shadow: 0 10px 24px color-mix(in srgb, ${T.gold} 34%, transparent);
        transition: transform .14s ease-out, box-shadow .2s ease-out, filter .15s ease-out }
      .auth-go:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.05) }
      .auth-go:active:not(:disabled) { transform: scale(.98); box-shadow: none }
      .auth-go:disabled { opacity: .5; cursor: not-allowed; box-shadow: none }

      .auth-err { font-size: 12.5px; color: ${T.danger}; margin-top: 12px }
      .auth-msg { font-size: 12.5px; color: ${T.success}; margin-top: 12px }
      .auth-swap { font-size: 12.5px; color: ${T.textMuted}; margin-top: 18px; cursor: pointer }
      .auth-swap:hover { color: ${T.text} }

      /* On a phone the blue panel would push the form below the fold, so it goes. */
      .auth-hello-sm { display: none }

      /* On a phone the panel becomes a strip: the form still starts above the
         fold, but the blue half — the whole point of the design — survives. */
      @media (max-width: 720px) {
        .auth-card { grid-template-columns: 1fr }
        .auth-side { padding: 18px 20px; flex-direction: row; flex-wrap: wrap;
          text-align: left; gap: 10px; justify-content: flex-start }
        .auth-hello, .auth-copy { display: none }
        .auth-hello-sm { display: block; font-size: 17px; font-weight: 700; letter-spacing: -.015em }
        .auth-pill { font-size: 10.5px; padding: 5px 11px }
        .auth-ghost { margin: 0 0 0 auto; padding: 9px 16px; font-size: 12.5px; border-radius: 10px }
        .auth-form { padding: 30px 22px }
        .auth-card { border-radius: 20px }
      }
      @media (prefers-reduced-motion: reduce) {
        .auth-ghost, .auth-go, .emb input { transition: none !important; transform: none !important }
      }
    `}}/>
  </div>;
}

function Onboarding({me,onTrial}) {
  // New signups complete their business profile first, teach the bot, then start the trial.
  const c=me?.client||{};
  const needProfile=!c.phone&&!c.address;
  const [step,setStep]=useState(needProfile?"profile":"ready");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [form,setForm]=useState({business_name:c.business_name||"",business_type:c.business_type||"ecommerce",phone:"",address:"",website:""});
  const BIZ=[{value:"ecommerce",label:"E-commerce / Online shop",icon:"ti-shopping-bag"},{value:"agency",label:"Agency / Service provider",icon:"ti-briefcase"}];
  const [q,setQ]=useState({description:"",tone:"Friendly and helpful",languages:"Bangla and English",hours:"",delivery:"",payment:"",returnPolicy:"",services:"",meetingInfo:"",faq:"",catalogLink:"",special:""});
  const [showMore,setShowMore]=useState(false);
  const [preview,setPreview]=useState("");
  const isEcom=form.business_type==="ecommerce";
  const CTA={width:"100%",padding:"13px 20px",fontSize:14.5,borderRadius:14};
  const trainBot=async(skip)=>{
    // Skipping must not throw away what the owner already typed. If they wrote
    // anything, save it as their business profile without AI — an imperfect
    // profile is far better than a bot that knows nothing about the business.
    if(skip){
      if(q.description.trim().length>=25){
        try{
          await api("/api/generate-prompt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers:q,mode:"raw"})});
        }catch{}
      }
      setStep("ready");return;
    }
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
      setStep("ready");
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
  const Err=()=>err?<div style={{fontSize:12.5,color:T.danger,margin:"-4px 0 12px",display:"flex",gap:6,alignItems:"flex-start"}}><i className="ti ti-alert-circle" style={{fontSize:15,flexShrink:0}}/><span>{err}</span></div>:null;
  const Label=({children})=><label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{children}</label>;

  if(step==="profile") return <OnboardFrame icon="ti-building-store" title="Set up your business profile"
    sub="This helps your AI assistant represent your business" step={1} of={3}>
    <Inp emb label="Business name *" value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} placeholder="e.g. Autologic Agency"/>
    <div style={{marginBottom:16}}>
      <Label>Business type *</Label>
      <Select wide value={form.business_type} options={BIZ} onChange={v=>setForm({...form,business_type:v})}
        style={{}}/>
    </div>
    <Inp emb label="Phone *" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="e.g. 01700000000"/>
    <Inp emb label="Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="City, Country"/>
    <Inp emb label="Website (optional)" value={form.website} onChange={e=>setForm({...form,website:e.target.value})} placeholder="example.com"/>
    <Err/>
    <Btn gold onClick={saveProfile} disabled={busy} style={CTA}>{busy?"Saving...":"Continue"}<i className="ti ti-arrow-right" style={{marginLeft:8,fontSize:15,verticalAlign:-2}}/></Btn>
  </OnboardFrame>;

  const EXAMPLES = isEcom ? SAMPLE_ECOM : SAMPLE_AGENCY;

  if(step==="train") return <OnboardFrame icon="ti-wand" title="Teach your bot about your business"
    sub="Write it in your own words and AI does the rest" step={2} of={3} width={580} scroll>
    <Inp emb textarea label="Tell us about your business *" value={q.description}
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
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {EXAMPLES.map(ex=><button key={ex.label} type="button" onClick={()=>setQ({...q,description:ex.text})} className="ui-btn ob-chip"
          style={{padding:"7px 14px",borderRadius:20,border:`1px solid ${T.border}`,background:T.card,boxShadow:T.nmSm,color:T.textMuted,fontSize:12.5,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
          <i className="ti ti-sparkles" style={{fontSize:13,marginRight:5,color:T.gold}}/>{ex.label}
        </button>)}
      </div>
    </div>

    <button type="button" onClick={()=>setShowMore(v=>!v)} className="ui-btn" style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"12px 14px",borderRadius:12,background:T.bgAlt,boxShadow:T.nmIn,border:"none",marginBottom:showMore?16:18,fontFamily:"inherit",textAlign:"left"}}>
      <span style={{fontSize:12.5,color:T.text}}>Add more details <span style={{color:T.textDim}}>— optional, improves accuracy</span></span>
      <i className={`ti ti-chevron-${showMore?"up":"down"}`} style={{fontSize:15,color:T.textMuted}}/>
    </button>

    {showMore&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <div style={{marginBottom:16}}>
          <Label>Bot tone</Label>
          <Select wide value={q.tone} options={["Friendly and helpful","Professional and formal","Casual and fun"]} onChange={v=>setQ({...q,tone:v})}/>
        </div>
        <div style={{marginBottom:16}}>
          <Label>Customer languages</Label>
          <Select wide value={q.languages} options={["Bangla and English","Bangla only","English only"]} onChange={v=>setQ({...q,languages:v})}/>
        </div>
      </div>
      <Inp emb label="Working hours" value={q.hours} onChange={e=>setQ({...q,hours:e.target.value})} placeholder="e.g. Everyday 10am-10pm"/>
      <Inp emb label="Catalog / website link" value={q.catalogLink} onChange={e=>setQ({...q,catalogLink:e.target.value})} placeholder="e.g. www.yourshop.com"/>
      <Inp emb label="Special brand rules" value={q.special} onChange={e=>setQ({...q,special:e.target.value})} placeholder="e.g. Address customers as আপনি, never say নমস্কার"/>
      <Inp emb textarea label="Common questions & answers" value={q.faq} onChange={e=>setQ({...q,faq:e.target.value})} placeholder={"Q: Do you have a physical shop?\nA: No, we are online only."}/>
    </>}

    <Err/>
    <Btn gold onClick={()=>trainBot(false)} disabled={busy} style={{...CTA,marginBottom:10}}><i className="ti ti-sparkles" style={{marginRight:6}}/>{busy?"Building your bot...":"Generate my bot"}</Btn>
    <button type="button" onClick={()=>!busy&&trainBot(true)} className="ui-btn" style={{width:"100%",background:"none",border:"none",textAlign:"center",fontSize:12.5,color:T.textMuted,cursor:"pointer",padding:8,fontFamily:"inherit"}}>Skip for now</button>
  </OnboardFrame>;

  if(step==="preview") return <OnboardFrame icon="ti-check" title="Your bot is trained"
    sub="This is what it now knows about your business. Change anything that is not right." step={2} of={3} width={640} scroll>
    <Inp emb textarea value={preview} onChange={e=>setPreview(e.target.value)} inputStyle={{minHeight:260,fontSize:12.8,lineHeight:1.7}}/>
    <div style={{fontSize:11.5,color:T.textDim,marginBottom:16,lineHeight:1.6,display:"flex",gap:7,alignItems:"flex-start"}}>
      <i className="ti ti-lock" style={{fontSize:14,flexShrink:0,marginTop:1}}/>
      <span>Platform rules — reply format, language matching and never guessing prices — are always applied on top of this and cannot be removed.</span>
    </div>
    <Err/>
    <Btn gold onClick={savePreview} disabled={busy} style={{...CTA,marginBottom:12}}>{busy?"Saving...":"Looks good — continue"}</Btn>
    <div style={{display:"flex",gap:10,justifyContent:"center",fontSize:12.5}}>
      <span onClick={()=>!busy&&trainBot(false)} style={{color:T.gold,cursor:"pointer",fontWeight:600}}>Regenerate</span>
      <span style={{color:T.textDim}}>·</span>
      <span onClick={()=>!busy&&setStep("train")} style={{color:T.textMuted,cursor:"pointer"}}>Edit my answers</span>
    </div>
  </OnboardFrame>;

  const perks=isEcom
    ?["AI replies on Facebook, Instagram, WhatsApp and your site","Product catalogue with photo matching","Orders recorded straight into your dashboard"]
    :["AI replies on Facebook, Instagram, WhatsApp and your site","Answers from your own documents","Bookings with automatic Google Meet links"];
  return <OnboardFrame icon="ti-rocket" title={`Welcome, ${form.business_name||c.business_name||"there"}`}
    sub="You are ready to go live" step={3} of={3}>
    <div style={{padding:"16px 16px 6px",borderRadius:16,background:T.bgAlt,boxShadow:T.nmIn,marginBottom:18}}>
      <div style={{fontSize:13.5,fontWeight:700,marginBottom:10,color:T.text}}>3-day free trial · 30 messages a day · no card</div>
      {perks.map(p=><div key={p} style={{display:"flex",gap:10,alignItems:"flex-start",fontSize:12.5,color:T.textMuted,marginBottom:10,lineHeight:1.5}}>
        <span style={{width:20,height:20,borderRadius:7,background:T.accGrad,color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12}}><i className="ti ti-check"/></span>{p}
      </div>)}
    </div>
    <Btn gold onClick={startTrial} disabled={busy} style={CTA}>{busy?"Starting...":"Start free trial"}<i className="ti ti-arrow-right" style={{marginLeft:8,fontSize:15,verticalAlign:-2}}/></Btn>
    <div style={{textAlign:"center",fontSize:11.5,color:T.textDim,marginTop:12}}>Next: connect Facebook, Instagram or WhatsApp with one click.</div>
  </OnboardFrame>;
}

function ConnectChannel({onDone,clientId}) {
  useEffect(()=>{
    const h=e=>{
      if(e.data==="fb_connected"||e.data==="ig_connected"||e.data==="wa_connected") onDone();
    };
    window.addEventListener("message",h);
    return ()=>window.removeEventListener("message",h);
  },[]);
  // A real popup, not a full-tab redirect. instagram.com (and to a lesser
  // extent facebook.com) is registered as an app link on Android/iOS, so a
  // top-level navigation there gets intercepted by the installed IG app
  // instead of staying on the web login — a client testing on their phone
  // would leave the dashboard entirely and land in the app with no way
  // back. A window.open()'d popup is a separate browsing context the OS
  // treats differently, and it's what the postMessage listener above was
  // already built for (window.opener.postMessage in connect-page.js).
  const openPopup=(url)=>{
    if(typeof window==="undefined") return;
    const w=520,h=680;
    const left=window.screenX+(window.outerWidth-w)/2, top=window.screenY+(window.outerHeight-h)/2;
    const win=window.open(url,"al-connect",`width=${w},height=${h},left=${left},top=${top}`);
    // Popup blocked (rare, but happens) — fall back to the old behaviour
    // rather than leaving the click looking like it did nothing.
    if(!win) window.location.href=url;
  };
  const opts=[
    {id:"facebook",icon:"ti-brand-facebook",label:"Facebook Page",hint:"One-click connect with Facebook login",color:"#1877f2"},
    {id:"instagram",icon:"ti-brand-instagram",label:"Instagram Business",hint:"One-click connect with Instagram login",color:"#e1306c"},
    {id:"whatsapp",icon:"ti-brand-whatsapp",label:"WhatsApp Business",hint:"We'll show your existing number, or help you create one",color:"#25d366"},
  ];
  const handleClick=(id)=>{
    if(id==="facebook") openPopup(`/api/fb/login?client_id=${clientId}`);
    else if(id==="instagram") openPopup(`/api/ig/login?client_id=${clientId}`);
    // WhatsApp starts at the Embedded Signup hub (wa/embedded): "Set up with
    // Meta" creates a new number or picks an existing one, a second door covers
    // the WhatsApp Business app (coexistence), and its Advanced section still
    // offers the older wa/login → wa/callback auto-detect for a shared number.
    // So wa/callback is no longer the front door — only an advanced landing.
    else if(id==="whatsapp") openPopup(`/api/wa/embedded?client_id=${clientId}`);
  };
  return <OnboardFrame icon="ti-plug" title="Connect a channel" sub="Your bot will reply to customers on this channel" width={520}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {opts.map(o=><button key={o.id} type="button" onClick={()=>handleClick(o.id)} className="ui-btn ob-row"
        style={{display:"flex",alignItems:"center",gap:14,cursor:"pointer",padding:"14px 16px",borderRadius:16,
          background:T.card,boxShadow:T.nmSm,border:`1px solid ${T.border}`,textAlign:"left",fontFamily:"inherit",color:T.text,width:"100%"}}>
        <div style={{width:44,height:44,borderRadius:13,background:`${o.color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${o.color}30`}}>
          <i className={`ti ${o.icon}`} style={{fontSize:22,color:o.color}}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600}}>{o.label}</div>
          <div style={{fontSize:11.5,color:T.textMuted,marginTop:2}}>{o.hint}</div>
        </div>
        <i className="ti ti-chevron-right" style={{fontSize:16,color:T.textDim,flexShrink:0}}/>
      </button>)}
      <button type="button" onClick={onDone} className="ui-btn" style={{background:"none",border:"none",textAlign:"center",fontSize:12.5,color:T.textMuted,cursor:"pointer",marginTop:4,padding:8,fontFamily:"inherit"}}>Skip for now</button>
    </div>
  </OnboardFrame>;
}

function ConnectCalendar({clientId,onDone}) {
  const [calOk,setCalOk]=useState(false);
  useEffect(()=>{
    const h=e=>{if(e.data==="gcal-connected") setCalOk(true);};
    window.addEventListener("message",h);
    return ()=>window.removeEventListener("message",h);
  },[]);
  const open=()=>{
    const w=window.open(`/api/gcal/login?client_id=${clientId}`,"gcal","width=520,height=640");
    if(!w) window.location.href=`/api/gcal/login?client_id=${clientId}`;
  };
  return <OnboardFrame icon="ti-calendar-event" title="Connect Google Calendar"
    sub="Your bot books appointments and sends automatic Google Meet links to customers" width={480}>
    {calOk
      ?<div style={{textAlign:"center",padding:"18px 8px 4px"}}>
          <div style={{width:60,height:60,borderRadius:"50%",background:`color-mix(in srgb, ${T.success} 12%, transparent)`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
            <i className="ti ti-circle-check" style={{fontSize:34,color:T.success}}/>
          </div>
          <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Google Calendar connected!</div>
          <div style={{fontSize:12.5,color:T.textMuted,marginBottom:20}}>Your bot will now create Meet links automatically for every booking.</div>
          <Btn gold onClick={onDone} style={{width:"100%",padding:"13px 20px",fontSize:14.5,borderRadius:14}}>Go to dashboard →</Btn>
        </div>
      :<>
        <button type="button" onClick={open} className="ui-btn ob-row"
          style={{display:"flex",alignItems:"center",gap:14,cursor:"pointer",padding:"16px 18px",borderRadius:16,width:"100%",
            background:T.card,boxShadow:T.nmSm,border:`1px solid ${T.border}`,textAlign:"left",fontFamily:"inherit",color:T.text}}>
          <div style={{width:44,height:44,borderRadius:13,background:"#4285f415",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid #4285f430"}}>
            <i className="ti ti-brand-google" style={{fontSize:22,color:"#4285f4"}}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600}}>Connect with Google</div>
            <div style={{fontSize:11.5,color:T.textMuted,marginTop:2}}>One-click — select your calendar and confirm</div>
          </div>
          <i className="ti ti-chevron-right" style={{fontSize:16,color:T.textDim,flexShrink:0}}/>
        </button>
        <button type="button" onClick={onDone} className="ui-btn" style={{width:"100%",background:"none",border:"none",textAlign:"center",fontSize:12.5,color:T.textMuted,cursor:"pointer",marginTop:14,padding:8,fontFamily:"inherit"}}>Skip for now</button>
      </>
    }
  </OnboardFrame>;
}

export default function Dashboard() {
  const isMobile=useIsMobile();
  const [chatOpen,setChatOpen]=useState(false);
  const pageRef=useRef("analytics");
  const [page,setPageRaw]=useState("analytics");
  const [upgradeIntent,setUpgradeIntent]=useState({plan:null,cycle:"monthly"});
  const [justConnected,setJustConnected]=useState(null);
  // A popup (Google Calendar, or a channel opened in a new window) reports
  // back with a message; a full-page connect comes back with ?connected=.
  useEffect(()=>{
    const h=(e)=>{ if(e.data&&e.data.type==="al-connected"&&e.data.platform){ setJustConnected({platform:e.data.platform,name:e.data.name||""}); if(e.data.platform!=="gcal") setPageRaw("channels"); } };
    window.addEventListener("message",h);
    return ()=>window.removeEventListener("message",h);
  },[]);
  // One history entry for "inside a tab", not one per tab visited. Hopping
  // between six tabs used to leave six entries, so getting out took six presses.
  const HOME="analytics";
  const pushed=useRef(false);
  const setPage=(p)=>{
    if(typeof window==="undefined"){ setPageRaw(p); return; }
    setPageRaw(prev=>{
      if(p===prev) return p;
      if(p===HOME&&pushed.current){
        // Walk the entry back instead of replacing it, so the phone's back
        // button never lands on a state that looks identical to this one.
        pushed.current=false;
        window.history.back();
        return prev;
      }
      if(prev===HOME&&p!==HOME){ window.history.pushState({page:p},"","#"+p); pushed.current=true; }
      else window.history.replaceState({page:p},"","#"+p);
      return p;
    });
  };
  useEffect(()=>{
    const onPop=(e)=>{
      // A sub-view claims the press first; only then does the tab give way.
      if(window.__alBack&&window.__alBack()){
        window.history.pushState({page:pageRef.current},"","#"+pageRef.current);
        return;
      }
      const to=e.state?.page||HOME;
      pushed.current = to!==HOME;
      setPageRaw(to);
    };
    window.addEventListener("popstate",onPop);
    const params=new URLSearchParams(window.location.search);
    // Back from a channel's "connected" page: remember what was connected so
    // the Channels tab can say so, then drop the query from the address bar.
    const cp=params.get("connected");
    if(cp){
      setJustConnected({platform:cp,name:params.get("name")||""});
      window.history.replaceState({page:"channels"},"","/dashboard#channels");
      setPageRaw("channels");
    }
    const up=params.get("upgrade");
    if(up&&["starter","pro","agency"].includes(up)){
      setUpgradeIntent({plan:up,cycle:params.get("cycle")==="yearly"?"yearly":"monthly"});
      setPageRaw("billing");
      window.history.replaceState({page:"billing",level:1},"","#billing");
      return;
    }
    const h=window.location.hash.replace("#","");
    if(h) setPageRaw(h);
    window.history.replaceState({page:window.location.hash.replace("#","")||HOME,level:0},"","");
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);
  useEffect(()=>{ pageRef.current=page; },[page]);
  const [products,setProducts]=useState([]);
  const [convos,setConvos]=useState([]);
  const [dashChannels,setDashChannels]=useState([]);
  const [orders,setOrders]=useState([]);
  const [bookingCount,setBookingCount]=useState(0);
  const [settings,setSettings]=useState({botName:"Autologic Bot",businessName:"My Business",systemPrompt:"You are a helpful sales assistant.",greeting:"Hello! How can I help?"});
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [mode,toggleTheme]=useTheme();
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
      if(session){setAuthToken(session.access_token);setAuthed(true);await loadMe();}
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

  // Desktop keeps the sidebar out by default the way the reference does not —
  // a premium dashboard opens with its menu in place; a phone keeps it away.
  useEffect(()=>{ if(stage==="app") setSidebarOpen(!isMobile); },[isMobile,stage]);

  useEffect(()=>{if(authed&&stage==="app")load();},[authed,stage]);
  useEffect(()=>{
    if(!authed||stage!=="app") return;
    const t=setInterval(()=>load(true),10000);
    return ()=>clearInterval(t);
  },[authed,stage]);

  if(!authChecked||stage==="loading") return null;
  if(stage==="auth") return <AuthGate onReady={async()=>{setAuthed(true);await loadMe();}}/>;
  // The first-run screens need the palette and motion sheet too — without them
  // every CSS variable is undefined and the pages render unstyled.
  if(stage==="onboarding") return <><Theme/><Motion/><Onboarding me={me} onTrial={async()=>{await loadMe();setStage("connect");}}/></>;
  if(stage==="connect") return <><Theme/><Motion/><ConnectChannel clientId={me?.client?.id} onDone={async()=>{const bt=me?.client?.business_type;await loadMe();setStage(bt==="agency"?"connect-cal":"app");}}/></>;
  if(stage==="connect-cal") return <><Theme/><Motion/><ConnectCalendar clientId={me?.client?.id} onDone={async()=>{await loadMe();setStage("app");}}/></>;

  const activeCount=convos.filter(c=>c.status==="active").length;
  const botLive=dashChannels.length>0;
  const initials=(me?.client?.business_name||"A").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();

  return <div style={{display:"flex",height:isMobile?"100dvh":"100vh",overflow:"hidden",background:T.bg}}>
    <Theme/><Motion/>
    {sidebarOpen&&isMobile&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:40}}/>}

    {/* The sidebar is the reference's neumorphic card: a soft slab floating off
        the page, grouped sections with quiet labels, and one red capsule marking
        where you are. */}
    <div style={{position:"fixed",zIndex:50,top:isMobile?10:14,bottom:isMobile?10:14,left:isMobile?10:14,
      width:isMobile?"min(272px, calc(100vw - 20px))":252,background:T.rail,
      borderRadius:24,boxShadow:sidebarOpen?T.nmOut:"none",display:"flex",flexDirection:"column",flexShrink:0,
      transform:sidebarOpen?"translateX(0)":"translateX(calc(-100% - 60px))",
      // visibility flips after the slide finishes on close (0.28s delay), and
      // at once on open — so the closed sidebar's soft shadow can never bleed
      // onto the page (it did, as a red sliver above the calendar).
      visibility:sidebarOpen?"visible":"hidden",
      transition:sidebarOpen
        ?"transform 0.28s cubic-bezier(.22,.61,.36,1), box-shadow .2s ease-out, visibility 0s"
        :"transform 0.28s cubic-bezier(.22,.61,.36,1), box-shadow .2s ease-out, visibility 0s .28s",
      paddingBottom:"env(safe-area-inset-bottom)"}}>
      <div style={{padding:"20px 18px 14px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:44,height:44,borderRadius:14,background:T.card,boxShadow:T.nmSm,
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
          {me?.client?.logo_url
            ?<img src={me.client.logo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            :<i className="ti ti-bolt" style={{fontSize:21,color:T.gold}}/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:"-0.01em"}}>{me?.client?.business_name||"Autologic"}</div>
          <div style={{fontSize:9.5,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.16em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>{settings?.botName||"chatbot"}</div>
        </div>
        <button onClick={()=>setSidebarOpen(false)} className="ui-btn" aria-label="Collapse menu"
          style={{width:28,height:28,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",
            background:"transparent",border:"none",color:T.textDim,cursor:"pointer",padding:0}}>
          <i className={`ti ti-${isMobile?"x":"chevron-left"}`} style={{fontSize:16}}/>
        </button>
      </div>

      <nav style={{flex:1,padding:"4px 12px",overflowY:"auto",minHeight:0}}>
        {GROUPS.map((g,gi)=>(
          <div key={g.title} style={{marginBottom:6,paddingTop:gi?10:0,
            borderTop:gi?`1px solid ${T.border}`:"none"}}>
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",
              color:T.textDim,padding:"0 12px",marginBottom:6}}>{g.title}</div>
            <Segmented vertical value={page} onChange={(p)=>{setPage(p);if(isMobile)setSidebarOpen(false);}}
              items={g.pages.map(p=>{
                const i=PAGES.indexOf(p);
                return {
                  value:p,
                  label:navLabel(i),
                  icon:isAgency&&p==="inventory"?"ti-database":isAgency&&p==="orders"?"ti-calendar-event":ICONS[i],
                  badge:p==="conversations"&&activeCount?String(activeCount):undefined,
                };
              })}/>
          </div>
        ))}
      </nav>

      {/* The bottom of the reference sidebar: parted from the menu, always reachable.
          On a phone this is also where sync and the theme switch live. */}
      <div style={{padding:"10px 12px 14px",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}>
        <button onClick={async()=>{try{await getSb().auth.signOut({scope:"local"});}catch{} window.location.href="/";}}
          className="ui-btn seg-item" style={{display:"flex",alignItems:"center",gap:9,flex:1,minWidth:0,
            padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",
            fontFamily:"inherit",fontSize:13.5,fontWeight:500,color:T.textMuted,textAlign:"left"}}>
          <i className="ti ti-logout" style={{fontSize:17}}/>Log out
        </button>
        {isMobile&&<>
          <button onClick={()=>load(false)} disabled={loading} className={`pbtn${loading?" is-busy":""}`}
            title="Sync" aria-label="Sync" style={{width:38,height:38,borderRadius:12}}>
            <i className="ti ti-refresh" style={{animation:loading?"spin 0.8s linear infinite":"none"}}/>
          </button>
          <ThemeToggle mode={mode} toggle={toggleTheme} style={{width:38,height:38,borderRadius:12}}/>
        </>}
      </div>
    </div>

    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0,marginLeft:(!isMobile&&sidebarOpen)?280:0,transition:"margin-left 0.28s cubic-bezier(.22,.61,.36,1)"}}>
      {/* The reference header: a rounded bar floating on the surface, square
          soft-shadow buttons that flood red on hover, a live avatar on the end. */}
      {!(isMobile&&chatOpen)&&<div style={{margin:isMobile?"10px 10px 0":"14px 18px 0",padding:isMobile?"8px 10px":"9px 12px",
        background:T.card,borderRadius:isMobile?16:20,boxShadow:T.nmSm,
        display:"flex",alignItems:"center",gap:isMobile?8:12,flexShrink:0}}>

        <div style={{display:"flex",alignItems:"center",gap:isMobile?6:10,flexShrink:0}}>
          {!sidebarOpen&&<button onClick={()=>setSidebarOpen(true)} className="pbtn" aria-label="Menu"
            style={isMobile?{width:36,height:36,borderRadius:11}:undefined}>
            <i className="ti ti-menu-2"/>
          </button>}
          {/* The phone's own back button does the same job; on screen it only
              earns a slot when it will not squeeze the title into an ellipsis. */}
          {isMobile&&page!==HOME&&<button onClick={()=>setPage(HOME)} className="pbtn hide-xs" aria-label="Back"
            style={{width:36,height:36,borderRadius:11}}>
            <i className="ti ti-arrow-left" style={{fontSize:16}}/>
          </button>}
        </div>

        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:isMobile?15.5:17.5,fontWeight:700,letterSpacing:"-0.02em",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{navLabel(PAGES.indexOf(page))}</div>
          {!isMobile&&<div style={{fontSize:11.5,color:T.textDim,marginTop:1,overflow:"hidden",
            textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {me?.client?.business_name} · {me?.client?.plan==='trial'
              ?`Trial — ${me?.usage?.today??0}/30 messages today`
              :`${products.length} ${words(bt).item.toLowerCase()}s`}
          </div>}
        </div>

        {/* On a phone the row holds only what is used every minute: bell,
            avatar. Sync and the theme switch move into the sidebar footer —
            still one tap away, no longer crowding the title off the bar. */}
        <div style={{display:"flex",alignItems:"center",gap:isMobile?7:10,flexShrink:0}}>
          {!isMobile&&<button onClick={()=>load(false)} disabled={loading} className={`pbtn${loading?" is-busy":""}`}
            title="Sync" aria-label="Sync">
            <i className="ti ti-refresh" style={{animation:loading?"spin 0.8s linear infinite":"none"}}/>
          </button>}
          <button onClick={()=>setPage("conversations")} className="pbtn" title="Active conversations"
            aria-label={`Notifications${activeCount?`, ${activeCount} active`:""}`}
            style={isMobile?{width:36,height:36,borderRadius:11}:undefined}>
            <i className="ti ti-bell"/>
            {activeCount>0&&<span className="pbadge">{activeCount>9?"9+":activeCount}</span>}
          </button>
          {!isMobile&&<ThemeToggle mode={mode} toggle={toggleTheme}/>}
          <div title={botLive?"Bot is live":"No channel connected"}
            style={{position:"relative",width:isMobile?36:42,height:isMobile?36:42,borderRadius:"50%",
              background:T.accGrad,boxShadow:T.accGlow,display:"flex",alignItems:"center",
              justifyContent:"center",flexShrink:0,overflow:"visible",marginRight:isMobile?2:0}}>
            {me?.client?.logo_url
              ?<img src={me.client.logo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>
              :<span style={{fontSize:isMobile?13:15,fontWeight:700,color:"#fff",letterSpacing:".02em"}}>{initials}</span>}
            {botLive&&<span className="ui-live" style={{position:"absolute",bottom:0,right:0,width:11,height:11,
              borderRadius:"50%",background:T.live,border:`2px solid ${T.card}`}}/>}
          </div>
        </div>
      </div>
      }<div style={{flex:1,overflow:"auto",padding:isMobile&&chatOpen?0:(isMobile?"12px 10px":20),minHeight:0,minWidth:0}}>
        {loading?<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60,flexDirection:"column",gap:16}}><div style={{width:32,height:32,border:`3px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontSize:13,color:T.textMuted}}>Loading from Supabase...</span></div>:(
          <div key={page} className="ui-page">
            {page==="analytics"&&<Analytics isAgency={isAgency}/>}
            {page==="conversations"&&<Conversations convos={convos} refresh={load} onChatOpen={setChatOpen} channels={dashChannels}/>}
            {page==="broadcast"&&<Broadcast/>}
            {page==="comments"&&<Comments/>}
            {page==="inventory"&&(isAgency?<KnowledgeBase/>:<Inventory products={products} refresh={load}/>)}
            {page==="orders"&&(isAgency?<Bookings calConnected={!!me?.client?.gcal_connected} clientId={me?.client?.id}/>:<Orders orders={orders} refresh={load}/>)}
            {page==="channels"&&<Channels onConnect={()=>setStage("connect")} justConnected={justConnected} onDismissConnected={()=>setJustConnected(null)}/>}
            {page==="billing"&&<Billing initialPlan={upgradeIntent.plan} initialCycle={upgradeIntent.cycle}/>}
            {page==="profile"&&<Profile/>}
            {page==="settings"&&<Settings settings={settings} setSettings={setSettings}/>}
          </div>
        )}
      </div>
    </div>
  </div>;
}
