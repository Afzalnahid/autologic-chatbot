"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Inp } from "./ui.js";
import { api } from "./session.js";

// The website widget card from the Channels tab, moved out unchanged.

export default function WebsiteWidget({onChanged}) {
  const [ch,setCh]=useState(null);
  const [loading,setLoading]=useState(true);
  const [domain,setDomain]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [copied,setCopied]=useState(false);

  const load=async()=>{
    try{
      const r=await api("/api/channels/website");
      const j=await r.json();
      if(!j.error) setCh(j.channel||null);
    }catch{}
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const origin=typeof window!=="undefined"?window.location.origin:"";
  const snippet=ch?`<script src="${origin}/widget.js" data-client="${ch.page_id}"><\/script>`:"";

  const call=async(method,body)=>{
    if(busy) return;
    setBusy(true); setErr("");
    try{
      const r=await api("/api/channels/website",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const j=await r.json();
      if(j.error) setErr(j.error);
      else { setCh(j.channel); setDomain(""); onChanged&&onChanged(); }
    }catch{ setErr("Could not save. Please check your connection and try again."); }
    setBusy(false);
  };

  const create=()=>{ if(!domain.trim()){setErr("Enter your website address first.");return;} call("POST",{allowed_domains:[domain]}); };
  const addDomain=()=>{ if(!domain.trim()) return; call("PATCH",{allowed_domains:[...(ch.allowed_domains||[]),domain]}); };
  const removeDomain=(d)=>{
    const rest=(ch.allowed_domains||[]).filter(x=>x!==d);
    if(!rest.length){ setErr("Keep at least one website address, or the chat cannot load anywhere."); return; }
    call("PATCH",{allowed_domains:rest});
  };
  const rotate=()=>{
    if(!window.confirm("Create a new key? The chat will stop working on your website until you paste the new code in.")) return;
    call("POST",{rotate:true});
  };
  const copy=async()=>{
    try{ await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(()=>setCopied(false),1600); }catch{}
  };

  if(loading) return null;

  return <Card style={{display:"flex",flexDirection:"column",gap:0}}>
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:4}}>
      <div style={{width:40,height:40,borderRadius:10,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <i className="ti ti-world" style={{fontSize:20,color:T.gold}}/>
      </div>
      <div>
        <div style={{fontSize:14,fontWeight:500}}>Your website</div>
        <div style={{fontSize:12,color:T.textMuted}}>Add the chat to your own site with one line of code</div>
      </div>
    </div>

    {!ch ? <div style={{marginTop:14}}>
      <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7,marginBottom:12}}>
        Enter the website where the chat should appear. Only this address will be able to use it.
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div style={{flex:1,minWidth:200}}>
          <Inp label="Website address" value={domain} onChange={e=>setDomain(e.target.value)} placeholder="yourshop.com"/>
        </div>
        <Btn gold onClick={create} disabled={busy}>{busy?"Creating...":"Create widget"}</Btn>
      </div>
    </div> : <div style={{marginTop:14,paddingTop:14,borderTop:`0.5px solid ${T.border}`}}>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:8}}>Paste this once, just before <code style={{fontFamily:"monospace"}}>&lt;/body&gt;</code> on your website</div>
      <div style={{background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:9,padding:"11px 12px",fontFamily:"monospace",fontSize:11.5,color:T.text,wordBreak:"break-all",lineHeight:1.6,marginBottom:10}}>
        {snippet}
      </div>
      <Btn gold small onClick={copy} style={{marginBottom:18}}>
        <i className={`ti ${copied?"ti-check":"ti-copy"}`} style={{marginRight:6}}/>{copied?"Copied":"Copy code"}
      </Btn>

      <div style={{fontSize:12,color:T.textMuted,marginBottom:9}}>Websites allowed to use this chat</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:11}}>
        {(ch.allowed_domains||[]).map(d=><span key={d} style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12.5,background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:20,padding:"5px 8px 5px 12px"}}>
          {d}
          <button onClick={()=>removeDomain(d)} disabled={busy} title="Remove" style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:14,lineHeight:1,padding:0}}>&times;</button>
        </span>)}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div style={{flex:1,minWidth:180}}>
          <Inp label="Add another website" value={domain} onChange={e=>setDomain(e.target.value)} placeholder="shop.yourbrand.com"/>
        </div>
        <Btn small onClick={addDomain} disabled={busy}>Add</Btn>
      </div>

      <div style={{marginTop:16,paddingTop:14,borderTop:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{fontSize:11.5,color:T.textDim,maxWidth:380,lineHeight:1.6}}>
          Only create a new key if you think someone copied your code. You will need to paste the new line into your website again.
        </div>
        <Btn small onClick={rotate} disabled={busy}>New key</Btn>
      </div>
    </div>}

    {err&&<div style={{fontSize:12.5,color:T.danger,marginTop:12}}>{err}</div>}
  </Card>;
}
