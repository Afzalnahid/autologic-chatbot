"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Badge, useIsMobile, Select } from "./ui.js";
import { api, getSb } from "./session.js";

// The Conversations tab, moved out of dashboard-client.js unchanged.

const CH_ICON = { facebook:"ti-brand-messenger", instagram:"ti-brand-instagram",
  whatsapp:"ti-brand-whatsapp", website:"ti-world" };

export default function Conversations({convos:allConvos,refresh,onChatOpen,channels=[]}) {
  const cap=(w)=>String(w||"").charAt(0).toUpperCase()+String(w||"").slice(1);
  const [chFilter,setChFilter]=useState("all");
  const [tagFilter,setTagFilter]=useState("all");
  const [tagData,setTagData]=useState(null);
  const loadTags=async()=>{
    try{
      const r=await api(`/api/tags?t=${Date.now()}`,{cache:"no-store"});
      const j=await r.json();
      if(!j.error) setTagData(j);
    }catch{}
  };
  useEffect(()=>{loadTags();},[]);
  const tagsOf=(id)=>(tagData?.tags?.[id]||[]).map(x=>x.tag);
  const byChannel=chFilter==="all"?allConvos:allConvos.filter(c=>(c.platform||"facebook")===chFilter);
  const convos=tagFilter==="all"?byChannel:byChannel.filter(c=>tagsOf(c.id).includes(tagFilter));
  const PICON={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp"};
  const avail=[...new Set([...channels.map(c=>c.platform),...allConvos.map(c=>c.platform||"facebook")].filter(Boolean))];
  const isMobile=useIsMobile();
  const [sel,setSel]=useState(-1);
  useEffect(()=>{onChatOpen&&onChatOpen(isMobile&&sel>=0);},[sel,isMobile]);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [contacts,setContacts]=useState({});
  const [globalBot,setGlobalBot]=useState(true);
  const chatRef=useRef(null);
  const galleryRef=useRef(null);
  const cameraRef=useRef(null);
  const [showEmoji,setShowEmoji]=useState(false);
  const [recording,setRecording]=useState(false);
  const recRef=useRef(null);
  const EMOJIS=["😀","😂","❤️","👍","🙏","😍","🔥","🎉","😢","😮","💯","✅"];

  const sendMedia=async(file,kind)=>{
    if(!file) return;
    setSending(true);
    const fd=new FormData();
    fd.append("sender_id",c.id);
    fd.append("kind",kind);
    fd.append("file",file);
    const r=await api("/api/send-media",{method:"POST",body:fd}).then(r=>r.json()).catch(()=>({error:"network"}));
    setSending(false);
    if(r.error) alert("Send failed: "+r.error);
    else refresh&&refresh(true);
  };

  const toggleRec=async()=>{
    if(recording){recRef.current?.stop();return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=MediaRecorder.isTypeSupported("audio/mp4")?"audio/mp4":"audio/webm";
      const rec=new MediaRecorder(stream,{mimeType:mime});
      const chunks=[];
      rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());
        setRecording(false);
        const ext=mime.includes("mp4")?"mp4":"webm";
        sendMedia(new File(chunks,`voice.${ext}`,{type:mime}),"audio");
      };
      recRef.current=rec;
      rec.start();
      setRecording(true);
    }catch{alert("Microphone access denied");}
  };

  const deleteChat=async()=>{
    if(!confirm(`Delete chat with ${cname}?`)) return;
    await api("/api/conversations",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_id:c.id})});
    setSel(-1);
    refresh&&refresh(true);
  };

  const loadContacts=async()=>{
    try{
      const d=await api("/api/contacts").then(r=>r.json());
      if(d.contacts) setContacts(Object.fromEntries(d.contacts.map(c=>[c.sender_id,c])));
      if(typeof d.global_bot_enabled==="boolean") setGlobalBot(d.global_bot_enabled);
    }catch{}
  };
  useEffect(()=>{loadContacts();},[]);
  useEffect(()=>{
    const ch=getSb().channel("mb").on("broadcast",{event:"insert"},()=>{refresh&&refresh(true);loadContacts();}).subscribe();
    const t=setInterval(()=>{refresh&&refresh(true);loadContacts();},45000);
    return ()=>{getSb().removeChannel(ch);clearInterval(t);};
  },[refresh]);
  useEffect(()=>{chatRef.current?.scrollTo(0,chatRef.current.scrollHeight);},[convos,sel]);

  const toggle=async(sender_id,val,isGlobal)=>{
    if(isGlobal) setGlobalBot(val);
    else setContacts(p=>({...p,[sender_id]:{...p[sender_id],sender_id,bot_enabled:val}}));
    await api("/api/contacts",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(isGlobal?{global:true,bot_enabled:val}:{sender_id,bot_enabled:val})});
  };

  if(!convos.length) return <Card style={{textAlign:"center",color:T.textDim,padding:60}}>No conversations yet</Card>;
  const idx=sel<0?0:sel;
  const c=convos[idx]||convos[0];
  const ct=contacts[c.id]||{};
  const cname=ct.name||c.sender;
  const showList=!isMobile||sel<0;
  const showChat=!isMobile||sel>=0;

  const send=async()=>{
    const text=input.trim();
    if(!text||sending) return;
    setSending(true); setInput("");
    const r=await api("/api/send-message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_id:c.id,text})}).then(r=>r.json()).catch(()=>({error:"network"}));
    setSending(false);
    if(r.error) alert("Send failed: "+r.error);
    else refresh&&refresh(true);
  };

  const Toggle=({on,onClick,label})=><div onClick={onClick} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} title={label}>
    <div style={{width:32,height:18,borderRadius:10,background:on?T.success:T.textDim,position:"relative",transition:"background .2s"}}>
      <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:on?16:2,transition:"left .2s"}}/>
    </div>
    <span style={{fontSize:11,color:T.textMuted}}>{label}</span>
  </div>;

  return <div style={{display:isMobile?"block":"grid",gridTemplateColumns:"320px 1fr",gap:16,height:isMobile?(sel>=0?"100dvh":"calc(100dvh - 190px)"):"calc(100vh - 130px)"}}>
    {showList&&<Card style={{overflow:"auto",padding:0,height:"100%"}}>
      <div style={{padding:"12px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:500,color:T.textMuted}}>CHATS</span>
        <Toggle on={globalBot} onClick={()=>toggle(null,!globalBot,true)} label={globalBot?"Bot ON":"Bot OFF"}/>
      </div>
      {/* Two dropdowns instead of two rows of chips. On a phone the chips were
          eating half the screen before a single conversation appeared, and the
          counts are more readable inside the menu than crammed into a pill. */}
      {(avail.length>1||!!tagData?.available?.length)&&
        <div style={{display:"flex",gap:8,padding:"10px 12px",borderBottom:`1px solid ${T.border}`,flexWrap:"wrap"}}>
          {avail.length>1&&
            <Select value={chFilter} onChange={setChFilter} style={{flex:"1 1 140px",minWidth:0}}
              options={[{value:"all",label:`All channels (${allConvos.length})`,icon:"ti-inbox"},
                ...avail.map(f=>({value:f,label:cap(f),icon:CH_ICON[f]||"ti-message"}))]}/>}
          {!!tagData?.available?.length&&
            <Select value={tagFilter} onChange={setTagFilter} style={{flex:"1 1 140px",minWidth:0}}
              options={[{value:"all",label:"All tags",icon:"ti-tag"},
                ...tagData.available.map(f=>{
                  const n=tagData.counts?.[f]||0;
                  return {value:f,label:n?`${f} (${n})`:f,
                    icon:f===tagData.complaint_tag?"ti-alert-triangle":"ti-tag"};
                })]}/>}
        </div>}

      {convos.map((cv,i)=>{
        const cvt=contacts[cv.id]||{};
        return <div key={cv.id} onClick={()=>setSel(i)} style={{padding:"14px 16px",cursor:"pointer",borderBottom:`0.5px solid ${T.border}`,background:sel===i?T.goldBg:"transparent",borderLeft:sel===i?`3px solid ${T.gold}`:"3px solid transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:500}}>{cvt.name||cv.sender}</span>
            <Badge color={cvt.bot_enabled===false?T.warn:T.success}>{cvt.bot_enabled===false?"manual":"bot"}</Badge>
          </div>
          <span style={{fontSize:12,color:T.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{cv.lastMsg}</span>
          {!!tagsOf(cv.id).length&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
            {tagsOf(cv.id).map(t=><span key={t} style={{fontSize:10.5,padding:"2px 8px",borderRadius:10,background:t===tagData?.complaint_tag?T.dangerBg:T.bgAlt,color:t===tagData?.complaint_tag?T.danger:T.textMuted,border:`0.5px solid ${t===tagData?.complaint_tag?T.danger+"40":T.border}`}}>{t}</span>)}
          </div>}
        </div>;
      })}
    </Card>}
    {showChat&&<Card style={{display:"flex",flexDirection:"column",padding:0,overflow:"hidden",height:"100%"}}>
      <div style={{padding:"14px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          {isMobile&&<button onClick={()=>setSel(-1)} style={{background:"none",border:"none",cursor:"pointer",color:T.gold,fontSize:20,padding:0,flexShrink:0}}><i className="ti ti-chevron-left"/></button>}
          <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cname}</div><div style={{fontSize:12,color:T.textMuted,display:"flex",alignItems:"center",gap:4}}><i className={`ti ${PICON[c.platform]||"ti-message"}`} style={{fontSize:13}}/>{c.platform}
            {!!tagData?.available?.length&&<select value={tagsOf(c.id)[0]||""} onChange={async e=>{
              const t=e.target.value;
              if(!t) return;
              await api("/api/tags",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_id:c.id,tag:t})});
              loadTags();
            }} onClick={e=>e.stopPropagation()} style={{marginLeft:6,background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.textMuted,fontSize:11,padding:"2px 6px",outline:"none",fontFamily:"inherit"}}>
              <option value="">Tag...</option>
              {tagData.available.map(t=><option key={t} value={t}>{t}</option>)}
            </select>}
            </div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Toggle on={ct.bot_enabled!==false} onClick={()=>toggle(c.id,ct.bot_enabled===false,false)} label={ct.bot_enabled===false?"Bot OFF (manual)":"Bot ON"}/>
          <button onClick={deleteChat} title="Delete chat" style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:18,padding:4}}><i className="ti ti-trash"/></button>
        </div>
      </div>
      <div ref={chatRef} style={{flex:1,overflow:"auto",padding:20,display:"flex",flexDirection:"column",gap:12}}>
        {(c.messages||[]).map((m,i)=>{
          const mine=m.role!=="customer";
          return <div key={i} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start"}}>
          <div style={{maxWidth:"70%"}}>
            {(m.attachments||[]).length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:4,alignItems:mine?"flex-end":"flex-start"}}>
              {m.attachments.map((u,j)=><img key={j} src={u} alt="" style={{maxWidth:220,borderRadius:16,display:"block"}} onError={e=>{e.target.style.display="none"}}/>)}
            </div>}
            {(!(m.attachments||[]).length||(m.text&&m.text!=="📷 Photo"))&&<div style={{padding:"9px 14px",borderRadius:18,fontSize:13.5,lineHeight:1.45,whiteSpace:"pre-wrap",color:mine?"#fff":T.text,background:mine?"#0084ff":T.bgAlt,borderBottomRightRadius:mine?6:18,borderBottomLeftRadius:mine?18:6}}>{m.text}</div>}
            {mine&&m.role==="agent"&&<div style={{fontSize:10,color:T.textDim,marginTop:2,textAlign:"right"}}>You</div>}
          </div>
        </div>;})}
      </div>
      <div style={{borderTop:`0.5px solid ${T.border}`,position:"relative"}}>
        {showEmoji&&<div style={{position:"absolute",bottom:"100%",right:12,background:T.card,border:`0.5px solid ${T.border}`,borderRadius:12,padding:8,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,zIndex:5}}>
          {EMOJIS.map(e=><span key={e} onClick={()=>{setInput(p=>p+e);setShowEmoji(false);}} style={{fontSize:20,cursor:"pointer",padding:4}}>{e}</span>)}
        </div>}
        <div style={{padding:"10px 8px",display:"flex",gap:2,alignItems:"center"}}>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e=>{sendMedia(e.target.files[0],"image");e.target.value="";}}/>
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={e=>{sendMedia(e.target.files[0],"image");e.target.value="";}}/>
          <button onClick={()=>cameraRef.current?.click()} title="Camera" style={{background:"none",border:"none",cursor:"pointer",color:"#0084ff",fontSize:19,padding:"4px 3px",flexShrink:0}}><i className="ti ti-camera"/></button>
          <button onClick={()=>galleryRef.current?.click()} title="Photo" style={{background:"none",border:"none",cursor:"pointer",color:"#0084ff",fontSize:19,padding:"4px 3px",flexShrink:0}}><i className="ti ti-photo"/></button>
          <button onClick={toggleRec} title="Voice" style={{background:"none",border:"none",cursor:"pointer",color:recording?T.danger:"#0084ff",fontSize:19,padding:"4px 3px",flexShrink:0,animation:recording?"pulse 1s infinite":"none"}}><i className={`ti ${recording?"ti-player-stop-filled":"ti-microphone"}`}/></button>
          <div style={{flex:1,display:"flex",alignItems:"center",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:20,padding:"0 4px 0 12px",minWidth:0}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message" style={{flex:1,background:"none",border:"none",padding:"10px 0",color:T.text,fontSize:13,outline:"none",minWidth:0}}/>
            <button onClick={()=>setShowEmoji(s=>!s)} title="Emoji" style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"4px 2px",flexShrink:0}}>😊</button>
          </div>
          <button onClick={send} disabled={sending} style={{width:34,height:34,borderRadius:"50%",border:"none",cursor:"pointer",background:"#0084ff",display:"flex",alignItems:"center",justifyContent:"center",opacity:sending?.6:1,flexShrink:0}}><i className="ti ti-send" style={{fontSize:16,color:"#fff"}}/></button>
        </div>
      </div>
    </Card>}
  </div>;
}
