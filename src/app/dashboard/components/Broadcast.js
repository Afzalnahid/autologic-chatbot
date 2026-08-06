"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Inp, Badge } from "./ui.js";
import { api } from "./session.js";

// The Broadcast tab, moved out of dashboard-client.js unchanged.

const SEG_HOURS=[{v:6,l:"Active in the last 6 hours"},{v:12,l:"Active in the last 12 hours"},{v:24,l:"Active in the last 24 hours"}];
const selStyle={width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit"};
const fieldLabel={display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1};


export default function Broadcast(){
  const [d,setD]=useState(null);
  const [loading,setLoading]=useState(true);
  const [channel,setChannel]=useState("all");
  const [msg,setMsg]=useState("");
  const [hours,setHours]=useState(24);
  const [conv,setConv]=useState("any");
  const [tag,setTag]=useState("");
  const [prev,setPrev]=useState(null);
  const [busy,setBusy]=useState("");
  const [err,setErr]=useState("");
  const [prog,setProg]=useState(null);
  const [openId,setOpenId]=useState(null);
  const [recips,setRecips]=useState([]);

  const load=async()=>{
    try{
      const r=await api(`/api/broadcast?t=${Date.now()}`,{cache:"no-store"});
      const j=await r.json();
      if(!j.error) setD(j);
    }catch{}
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const post=async(body)=>{
    const r=await api("/api/broadcast",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    return r.json();
  };

  const bt=d?.business_type||"ecommerce";
  const convWords=bt==="agency"
    ?{any:"Everyone",yes:"Has booked before",no:"Never booked"}
    :{any:"Everyone",yes:"Has ordered before",no:"Never ordered"};
  const segment=()=>({channel,activeWithinHours:hours,converted:conv,tags:tag?[tag]:[]});
  const maxLen=d?.max_message||900;

  const preview=async()=>{
    setBusy("preview"); setErr(""); setPrev(null); setProg(null);
    try{
      const j=await post({action:"preview",segment:segment()});
      if(j.error) setErr(j.error); else setPrev(j);
    }catch{ setErr("Could not check the audience. Please try again."); }
    setBusy("");
  };

  const send=async()=>{
    if(!prev||!prev.counts.eligible||!msg.trim()) return;
    if(!window.confirm(`Send this message to ${prev.counts.eligible} people now? It cannot be taken back.`)) return;
    setBusy("send"); setErr(""); setProg({sent:0,total:prev.counts.eligible,done:false});
    try{
      let j=await post({action:"send",channel,message:msg,segment:segment()});
      if(j.error){ setErr(j.error); setBusy(""); setProg(null); return; }
      let guard=0;
      while(j.ok&&!j.done&&j.broadcast&&guard<200){
        setProg({sent:j.broadcast.sent||0,total:j.broadcast.total||0,done:false});
        j=await post({action:"resume",id:j.broadcast.id});
        guard++;
      }
      const b=j.broadcast||{};
      setProg({sent:b.sent||0,total:b.total||0,failed:b.failed||0,skipped:b.skipped||0,done:true});
      setMsg(""); setPrev(null);
      load();
    }catch{
      setErr("Sending stopped before it finished. Open the history below to see exactly who received it.");
      load();
    }
    setBusy("");
  };

  const openRecipients=async(id)=>{
    if(openId===id){ setOpenId(null); setRecips([]); return; }
    setOpenId(id); setRecips([]);
    try{ const j=await post({action:"recipients",id}); setRecips(j.recipients||[]); }catch{}
  };

  if(loading) return <div style={{padding:40,textAlign:"center",color:T.textMuted}}>Loading...</div>;

  const channels=d?.channels||[];
  const quota=d?.quota||{};

  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    {!channels.length&&<Card style={{borderLeft:`2px solid ${T.warn}`}}>
      <div style={{fontSize:13.5,fontWeight:500,marginBottom:4}}>No channel is ready for broadcasts</div>
      <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7}}>Connect Facebook, Instagram or WhatsApp in Channels first, and make sure the bot is not paused there. Website chat cannot receive broadcasts — once a visitor closes the tab there is no address to send to.</div>
    </Card>}

    <Card>
      <div style={{fontSize:14,fontWeight:500,marginBottom:2}}>Write your message</div>
      <div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.7,marginBottom:16}}>
        You can only message people who wrote to you in the last 24 hours. That is Meta's rule, not ours — sending outside it can get your Page blocked.
      </div>

      <Inp label="Message" textarea value={msg} maxLength={maxLen} onChange={e=>{setMsg(e.target.value);setPrev(null);}} placeholder="Write exactly what your customers will receive..." style={{marginBottom:6}}/>
      <div style={{fontSize:11.5,color:msg.length>maxLen-50?T.warn:T.textDim,textAlign:"right",marginBottom:16}}>{msg.length} / {maxLen}</div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:14,marginBottom:16}}>
        <div>
          <label style={fieldLabel}>Channel</label>
          <select value={channel} onChange={e=>{setChannel(e.target.value);setPrev(null);}} style={selStyle}>
            <option value="all">All connected channels</option>
            {channels.map(c=><option key={c.platform} value={c.platform}>{c.platform.charAt(0).toUpperCase()+c.platform.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>Who</label>
          <select value={hours} onChange={e=>{setHours(Number(e.target.value));setPrev(null);}} style={selStyle}>
            {SEG_HOURS.map(h=><option key={h.v} value={h.v}>{h.l}</option>)}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>{bt==="agency"?"Booking history":"Order history"}</label>
          <select value={conv} onChange={e=>{setConv(e.target.value);setPrev(null);}} style={selStyle}>
            <option value="any">{convWords.any}</option>
            <option value="yes">{convWords.yes}</option>
            <option value="no">{convWords.no}</option>
          </select>
        </div>
        {!!d?.available_tags?.length&&<div>
          <label style={fieldLabel}>Tag</label>
          <select value={tag} onChange={e=>{setTag(e.target.value);setPrev(null);}} style={selStyle}>
            <option value="">Any tag</option>
            {d.available_tags.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>}
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <Btn onClick={preview} disabled={!!busy||!channels.length}>{busy==="preview"?"Checking...":"Check who will get it"}</Btn>
        <Btn gold onClick={send} disabled={!!busy||!prev||!prev.counts.eligible||!msg.trim()}>{busy==="send"?"Sending...":"Send now"}</Btn>
        {!prev&&<span style={{fontSize:12,color:T.textDim}}>Check the audience before you can send</span>}
      </div>

      {err&&<div style={{fontSize:12.5,color:T.danger,marginTop:12,lineHeight:1.6}}>{err}</div>}

      {prev&&<div style={{marginTop:16,paddingTop:16,borderTop:`0.5px solid ${T.border}`}}>
        <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:12}}>
          <div><div style={{fontSize:24,fontWeight:600,color:T.success}}>{prev.counts.eligible}</div><div style={{fontSize:12,color:T.textMuted}}>will receive it</div></div>
          <div><div style={{fontSize:24,fontWeight:600,color:T.textDim}}>{prev.counts.skipped}</div><div style={{fontSize:12,color:T.textMuted}}>cannot be messaged</div></div>
        </div>
        {prev.over_quota&&<div style={{fontSize:12.5,color:T.danger,marginBottom:10,lineHeight:1.6}}>This is more than your plan allows right now — {prev.quota.remaining} messages left this {prev.quota.period}.</div>}
        {!!prev.sample?.length&&<div style={{fontSize:12.5,color:T.textMuted,marginBottom:8}}>For example: {prev.sample.map(x=>x.name).join(", ")}{prev.counts.eligible>prev.sample.length?" and more":""}</div>}
        {!!prev.skipped_sample?.length&&<div style={{marginTop:8}}>
          <div style={{fontSize:12,color:T.textMuted,marginBottom:6}}>Why some are left out</div>
          {prev.skipped_sample.map((x,i)=><div key={i} style={{fontSize:12,color:T.textDim,lineHeight:1.7}}>{x.name} — {x.reason}</div>)}
        </div>}
      </div>}

      {prog&&<div style={{marginTop:16,paddingTop:16,borderTop:`0.5px solid ${T.border}`}}>
        <div style={{fontSize:13,color:prog.done?T.success:T.text}}>
          {prog.done?`Finished — ${prog.sent} sent`:`Sending... ${prog.sent} of ${prog.total}`}
          {prog.done&&prog.failed>0&&<span style={{color:T.danger}}>, {prog.failed} failed</span>}
        </div>
        {prog.done&&prog.failed>0&&<div style={{fontSize:12,color:T.textMuted,marginTop:4}}>Open it in the history below to see the exact reason for each one.</div>}
      </div>}
    </Card>

    {!quota.unlimited&&quota.limit&&<div style={{fontSize:12,color:T.textDim}}>{quota.remaining} of {quota.limit} messages left this {quota.period}.</div>}

    <Card>
      <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>Past broadcasts</div>
      {!d?.broadcasts?.length&&<div style={{fontSize:12.5,color:T.textDim}}>You have not sent any broadcasts yet.</div>}
      {(d?.broadcasts||[]).map(b=><div key={b.id} style={{borderTop:`0.5px solid ${T.border}`,paddingTop:12,marginTop:12}}>
        <div onClick={()=>openRecipients(b.id)} style={{cursor:"pointer",display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:13,lineHeight:1.6,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{b.message}</div>
            <div style={{fontSize:11.5,color:T.textDim}}>{new Date(b.created_at).toLocaleString()} · {b.channel==="all"?"All channels":b.channel}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
            <Badge color={T.success}>{b.sent} sent</Badge>
            {b.failed>0&&<Badge color={T.danger}>{b.failed} failed</Badge>}
            {b.skipped>0&&<Badge color={T.textDim}>{b.skipped} skipped</Badge>}
          </div>
        </div>
        {openId===b.id&&<div style={{marginTop:10,paddingLeft:2}}>
          {!recips.length&&<div style={{fontSize:12,color:T.textDim}}>Loading...</div>}
          {recips.map((r,i)=><div key={i} style={{fontSize:12,lineHeight:1.8,color:r.status==="sent"?T.textMuted:T.danger}}>
            {r.platform} · {String(r.sender_id).slice(-6)} — {r.status}{r.error?`: ${r.error}`:""}
          </div>)}
        </div>}
      </div>)}
    </Card>
  </div>;
}
