"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Badge, Accordion } from "./ui.js";
import { api } from "./session.js";
import WebsiteWidget from "./WebsiteWidget.js";

// The Channels tab, moved out of dashboard-client.js unchanged.

export default function Channels({onConnect}) {
  const [channels,setChannels]=useState([]);
  const [busyId,setBusyId]=useState(null);
  const load=()=>api("/api/channels").then(r=>r.json()).then(d=>Array.isArray(d)&&setChannels(d)).catch(()=>{});
  useEffect(()=>{load();},[]);
  const icons={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp",website:"ti-world"};

  const toggle=async(ch)=>{
    setBusyId(ch.id);
    const next=ch.status==="connected"?"paused":"connected";
    await api("/api/channels",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:ch.id,status:next})}).catch(()=>{});
    await load(); setBusyId(null);
  };
  const setCommentOpt=async(ch,key,val)=>{
    setBusyId(ch.id);
    await api("/api/channels",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:ch.id,[key]:val})}).catch(()=>{});
    await load(); setBusyId(null);
  };
  const disconnect=async(ch)=>{
    if(!window.confirm(`Disconnect ${ch.platform}? The bot will stop replying on this channel and you'll need to reconnect to use it again.`)) return;
    setBusyId(ch.id);
    await api("/api/channels",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:ch.id})}).catch(()=>{});
    await load(); setBusyId(null);
  };

  const Toggle=({on,onClick,disabled})=><button onClick={onClick} disabled={disabled} style={{width:38,height:22,borderRadius:11,border:"none",cursor:disabled?"default":"pointer",background:on?T.success:T.border,position:"relative",flexShrink:0,opacity:disabled?0.6:1,transition:"background .15s"}}>
    <span style={{position:"absolute",top:2,left:on?18:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .15s"}}/>
  </button>;

  // Every channel used to be open at once, so the tab was a wall of controls.
  // Each is a folder now: the header carries name and status, the rest waits.
  return <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:700}}>
    <Btn gold onClick={onConnect} style={{alignSelf:"flex-start"}}><i className="ti ti-plus" style={{marginRight:6}}/>Connect new channel</Btn>

    <Accordion icon="ti-world" title="Website widget" subtitle="One line of code on your own site">
      <WebsiteWidget onChanged={load}/>
    </Accordion>

    {channels.map(ch=><Accordion key={ch.id}
      icon={icons[ch.platform]||"ti-plug"}
      title={ch.platform}
      subtitle={ch.page_id||"-"}
      badge={<Badge color={ch.status==="connected"?T.success:T.textDim}>{ch.status}</Badge>}>

      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <Btn small onClick={()=>toggle(ch)} disabled={busyId===ch.id}>
            <i className={`ti ${ch.status==="connected"?"ti-player-pause":"ti-player-play"}`} style={{marginRight:4}}/>{ch.status==="connected"?"Pause":"Resume"}
          </Btn>
          <button onClick={()=>disconnect(ch)} disabled={busyId===ch.id} title="Disconnect" style={{background:"none",border:`1px solid ${T.danger}`,borderRadius:6,cursor:"pointer",color:T.danger,fontSize:13,padding:"5px 10px",display:"flex",alignItems:"center",gap:4,opacity:busyId===ch.id?0.5:1}}>
            <i className="ti ti-plug-x"/>Disconnect
          </button>
      </div>
      {(ch.platform==="facebook"||ch.platform==="instagram")&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:12,display:"flex",alignItems:"center",gap:6}}><i className="ti ti-message-circle-2"/>Comment automation</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{minWidth:0,paddingRight:12}}>
            <div style={{fontSize:13}}>Auto-reply to comments</div>
            <div style={{fontSize:11.5,color:T.textDim}}>Publicly reply when someone comments on your posts</div>
          </div>
          <Toggle on={ch.comment_reply_enabled!==false} disabled={busyId===ch.id} onClick={()=>setCommentOpt(ch,"comment_reply_enabled",!(ch.comment_reply_enabled!==false))}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{minWidth:0,paddingRight:12}}>
            <div style={{fontSize:13}}>Send to inbox</div>
            <div style={{fontSize:11.5,color:T.textDim}}>Also message the commenter privately to start a conversation</div>
          </div>
          <Toggle on={ch.comment_dm_enabled!==false} disabled={busyId===ch.id} onClick={()=>setCommentOpt(ch,"comment_dm_enabled",!(ch.comment_dm_enabled!==false))}/>
        </div>
      </div>}
    </Accordion>)}
    {channels.length===0&&<Card style={{textAlign:"center",padding:"40px 24px"}}>
      <i className="ti ti-plug-off" style={{fontSize:30,color:T.textDim}}/>
      <div style={{fontSize:15,fontWeight:600,color:T.text,margin:"12px 0 6px"}}>No channels connected yet</div>
      <div style={{fontSize:13.5,color:T.textMuted,lineHeight:1.65,maxWidth:320,margin:"0 auto 16px"}}>
        Connect Facebook, Instagram or WhatsApp and the bot starts answering there straight away.
      </div>
      <Btn gold onClick={onConnect}><i className="ti ti-plus" style={{marginRight:6}}/>Connect a channel</Btn>
    </Card>}
  </div>;
}
