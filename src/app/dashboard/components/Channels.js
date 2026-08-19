"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn } from "./ui.js";
import { api } from "./session.js";
import WebsiteWidget from "./WebsiteWidget.js";

// The Channels tab. One client can connect MANY Pages, Instagram accounts and
// WhatsApp numbers, so the tab is organised per platform: a section header with
// the count, then one row per connected account with its saved name. Rows from
// before names were stored fall back to the raw id and pick their name up on
// the next reconnect.

// What the owner sees right after a channel connects: the brand's own colour,
// the name that was connected, and one plain sentence about what happens now.
const JUST = {
  facebook:  { label:"Facebook Page connected",     icon:"ti-brand-facebook",  color:"#1877F2", what:"Autologic now answers every Messenger message this Page receives." },
  instagram: { label:"Instagram account connected", icon:"ti-brand-instagram", color:"#E1306C", what:"Autologic now answers every DM this account receives." },
  whatsapp:  { label:"WhatsApp number connected",   icon:"ti-brand-whatsapp",  color:"#25D366", what:"Autologic now answers every WhatsApp message on this number." },
  gcal:      { label:"Google Calendar connected",   icon:"ti-brand-google",    color:"#4285F4", what:"Bookings land in this calendar with a Google Meet link, automatically." },
};

const META = {
  facebook:  { label:"Facebook",  noun:"Page",    plural:"Pages",    icon:"ti-brand-facebook",  color:"#1877F2", sub:"Messenger replies and comment automation" },
  instagram: { label:"Instagram", noun:"account", plural:"accounts", icon:"ti-brand-instagram", color:"#E1306C", sub:"DM replies and comment automation" },
  whatsapp:  { label:"WhatsApp",  noun:"number",  plural:"numbers",  icon:"ti-brand-whatsapp",  color:"#25D366", sub:"Replies on your business numbers" },
};

export default function Channels({onConnect,justConnected,onDismissConnected}) {
  const [channels,setChannels]=useState([]);
  const [busyId,setBusyId]=useState(null);
  const [open,setOpen]=useState(null);           // expanded account row id
  const load=()=>api("/api/channels").then(r=>r.json()).then(d=>Array.isArray(d)&&setChannels(d)).catch(()=>{});
  useEffect(()=>{load();},[]);
  // A fresh connection reloads the list so the new channel is in it at once.
  useEffect(()=>{ if(justConnected) load(); },[justConnected]);
  const jc = justConnected && JUST[justConnected.platform];

  const meta=channels.filter(c=>META[c.platform]);
  const webRows=channels.filter(c=>c.platform==="website");
  const live=meta.filter(c=>c.status==="connected").length;

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
    const what=META[ch.platform]?`this ${META[ch.platform].noun}`:"this channel";
    if(!window.confirm(`Disconnect ${ch.name||what}? The bot stops replying here and you'll need to reconnect to use it again.`)) return;
    setBusyId(ch.id);
    await api("/api/channels",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:ch.id})}).catch(()=>{});
    await load(); setBusyId(null);
  };

  const Toggle=({on,onClick,disabled})=><button onClick={onClick} disabled={disabled} style={{width:38,height:22,borderRadius:11,border:"none",cursor:disabled?"default":"pointer",background:on?T.success:T.border,position:"relative",flexShrink:0,opacity:disabled?0.6:1,transition:"background .15s"}}>
    <span style={{position:"absolute",top:2,left:on?18:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .15s"}}/>
  </button>;

  const fmtDate=(d)=>d?new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"";

  // One connected account. The header row carries identity and the live
  // switch; the id, date, comment automation and disconnect wait behind it.
  const AccountRow=({ch})=>{
    const m=META[ch.platform];
    const isOpen=open===ch.id;
    const on=ch.status==="connected";
    return <div style={{borderTop:`0.5px solid ${T.border}`}}>
      <div onClick={()=>setOpen(isOpen?null:ch.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 2px",cursor:"pointer"}}>
        <span style={{width:36,height:36,borderRadius:11,background:`${m.color}14`,color:m.color,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,position:"relative"}}>
          <i className={`ti ${m.icon}`}/>
          <span style={{position:"absolute",right:-3,bottom:-3,width:11,height:11,borderRadius:"50%",background:on?T.live:T.textDim,border:`2px solid ${T.card}`}}/>
        </span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13.5,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ch.name||`${m.label} ${m.noun} · …${String(ch.page_id||"").slice(-4)}`}</div>
          <div style={{fontSize:11.5,color:T.textMuted,marginTop:1}}>{on?"Live — the bot is answering":"Paused — messages wait for you"}</div>
        </div>
        <span onClick={e=>e.stopPropagation()}><Toggle on={on} disabled={busyId===ch.id} onClick={()=>toggle(ch)}/></span>
        <i className={`ti ti-chevron-${isOpen?"up":"down"}`} style={{fontSize:15,color:T.textDim,flexShrink:0}}/>
      </div>
      {isOpen&&<div style={{padding:"2px 2px 14px 50px"}}>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:11.5,color:T.textDim,marginBottom:12}}>
          <span title="Platform ID"><i className="ti ti-hash" style={{marginRight:4}}/><span style={{fontFamily:"monospace"}}>{ch.page_id}</span></span>
          {ch.connected_at&&<span><i className="ti ti-plug" style={{marginRight:4}}/>Connected {fmtDate(ch.connected_at)}</span>}
        </div>
        {(ch.platform==="facebook"||ch.platform==="instagram")&&<div style={{marginBottom:12}}>
          <div style={{fontSize:11.5,color:T.textMuted,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><i className="ti ti-message-circle-2"/>Comment automation</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{minWidth:0,paddingRight:12}}>
              <div style={{fontSize:12.5}}>Auto-reply to comments</div>
              <div style={{fontSize:11,color:T.textDim}}>Publicly reply when someone comments on your posts</div>
            </div>
            <Toggle on={ch.comment_reply_enabled!==false} disabled={busyId===ch.id} onClick={()=>setCommentOpt(ch,"comment_reply_enabled",!(ch.comment_reply_enabled!==false))}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{minWidth:0,paddingRight:12}}>
              <div style={{fontSize:12.5}}>Send to inbox</div>
              <div style={{fontSize:11,color:T.textDim}}>Also message the commenter privately to start a conversation</div>
            </div>
            <Toggle on={ch.comment_dm_enabled!==false} disabled={busyId===ch.id} onClick={()=>setCommentOpt(ch,"comment_dm_enabled",!(ch.comment_dm_enabled!==false))}/>
          </div>
        </div>}
        <button onClick={()=>disconnect(ch)} disabled={busyId===ch.id} style={{background:"none",border:`1px solid ${T.danger}`,borderRadius:8,cursor:"pointer",color:T.danger,fontSize:12.5,padding:"6px 12px",display:"inline-flex",alignItems:"center",gap:5,opacity:busyId===ch.id?0.5:1}}>
          <i className="ti ti-plug-x"/>Disconnect
        </button>
      </div>}
    </div>;
  };

  return <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:700}}>
    {jc&&<Card style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderColor:`color-mix(in srgb, ${T.success} 35%, transparent)`,boxShadow:`0 10px 26px color-mix(in srgb, ${T.success} 18%, transparent)`}}>
      <div style={{position:"relative",width:46,height:46,borderRadius:15,background:T.card,boxShadow:T.nmSm,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <i className={`ti ${jc.icon}`} style={{fontSize:24,color:jc.color}}/>
        <span style={{position:"absolute",right:-5,bottom:-5,width:20,height:20,borderRadius:"50%",background:T.success,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,border:`2px solid ${T.card}`}}><i className="ti ti-check"/></span>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:700,letterSpacing:"-.01em"}}>{jc.label}{justConnected.name?<span style={{fontWeight:500,color:T.textMuted}}> · {justConnected.name}</span>:null}</div>
        <div style={{fontSize:12.5,color:T.textMuted,marginTop:2,lineHeight:1.5}}>{jc.what}</div>
      </div>
      <button onClick={onDismissConnected} aria-label="Dismiss" className="ui-btn" style={{background:"none",border:"none",color:T.textDim,cursor:"pointer",fontSize:17,padding:6,flexShrink:0}}><i className="ti ti-x"/></button>
    </Card>}

    {/* Summary + the one action. Every Page, account and number can power
        exactly one Autologic account — said here once, plainly. */}
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 260px",minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:700}}>
          {meta.length
            ? <>{meta.length} {meta.length===1?"account":"accounts"} connected<span style={{fontWeight:500,color:T.textMuted}}> · {live} live</span></>
            : "Connect your first channel"}
        </div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2,lineHeight:1.5}}>
          Connect as many Pages, accounts and numbers as you need — each one can belong to only one Autologic account.
        </div>
      </div>
      <Btn gold onClick={onConnect} style={{flexShrink:0}}><i className="ti ti-plus" style={{marginRight:6}}/>Connect new channel</Btn>
    </div>

    {Object.entries(META).map(([p,m])=>{
      const rows=meta.filter(c=>c.platform===p);
      if(!rows.length) return null;
      return <Card key={p} style={{paddingBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:12,paddingBottom:10}}>
          <span style={{width:40,height:40,borderRadius:12,background:`${m.color}14`,color:m.color,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}><i className={`ti ${m.icon}`}/></span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700}}>{m.label}<span style={{fontWeight:500,color:T.textMuted}}> · {rows.length} {rows.length===1?m.noun:m.plural}</span></div>
            <div style={{fontSize:11.5,color:T.textMuted,marginTop:1}}>{m.sub}</div>
          </div>
          <Btn small onClick={onConnect}><i className="ti ti-plus" style={{marginRight:4}}/>Add</Btn>
        </div>
        {rows.map(ch=><AccountRow key={ch.id} ch={ch}/>)}
      </Card>;
    })}

    <Card style={{paddingBottom:6}}>
      <div style={{display:"flex",alignItems:"center",gap:12,paddingBottom:webRows.length?10:0}}>
        <span style={{width:40,height:40,borderRadius:12,background:T.goldBg,color:T.gold,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}><i className="ti ti-world"/></span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700}}>Website<span style={{fontWeight:500,color:T.textMuted}}>{webRows.length?` · ${webRows.length===1?"1 widget":`${webRows.length} widgets`}`:""}</span></div>
          <div style={{fontSize:11.5,color:T.textMuted,marginTop:1}}>The same bot on your own site — one line of code</div>
        </div>
      </div>
      {webRows.map(ch=>{
        const on=ch.status==="connected";
        return <div key={ch.id} style={{borderTop:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,padding:"12px 2px"}}>
          <span style={{width:36,height:36,borderRadius:11,background:T.goldBg,color:T.gold,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,position:"relative"}}>
            <i className="ti ti-world"/>
            <span style={{position:"absolute",right:-3,bottom:-3,width:11,height:11,borderRadius:"50%",background:on?T.live:T.textDim,border:`2px solid ${T.card}`}}/>
          </span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13.5,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(ch.allowed_domains||[]).join(", ")||"Website chat widget"}</div>
            <div style={{fontSize:11.5,color:T.textMuted,marginTop:1}}>{on?"Live — the bot is answering":"Paused — the chat is hidden"}</div>
          </div>
          <Toggle on={on} disabled={busyId===ch.id} onClick={()=>toggle(ch)}/>
          <button onClick={()=>disconnect(ch)} disabled={busyId===ch.id} title="Remove this widget" style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,fontSize:16,padding:4,flexShrink:0}}><i className="ti ti-trash"/></button>
        </div>;
      })}
      <div style={{borderTop:webRows.length?`0.5px solid ${T.border}`:"none",paddingTop:webRows.length?12:0,marginTop:webRows.length?2:0,paddingBottom:8}}>
        <WebsiteWidget bare onChanged={load}/>
      </div>
    </Card>

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
