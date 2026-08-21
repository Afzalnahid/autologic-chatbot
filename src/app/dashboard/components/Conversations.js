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
  const [search,setSearch]=useState("");
  const [contacts,setContacts]=useState({});
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
  // With several Pages/accounts on one platform, the filter can narrow to one
  // of them ("facebook|<page_id>") and each row says which one it lives on.
  const perPlatform={};
  channels.forEach(c=>{ if(!perPlatform[c.platform]) perPlatform[c.platform]=[]; perPlatform[c.platform].push(c); });
  const acctName=(p,pid)=>{ const ch=(perPlatform[p]||[]).find(x=>x.page_id===pid); return ch?.name||(pid?"…"+String(pid).slice(-4):null); };
  const chMatch=(c)=>{
    if(chFilter==="all") return true;
    const p=c.platform||"facebook";
    if(chFilter.includes("|")){ const [fp,fpid]=chFilter.split("|"); return p===fp&&String(c.page_id||"")===fpid; }
    return p===chFilter;
  };
  const q=search.trim().toLowerCase();
  const convos=allConvos.filter(c=>chMatch(c)
    &&(tagFilter==="all"||tagsOf(c.id).includes(tagFilter))
    &&(!q||(((contacts[c.id]?.name||c.sender||"")+" "+(c.lastMsg||"")).toLowerCase().includes(q))));
  const PICON={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp"};
  const avail=[...new Set([...channels.map(c=>c.platform),...allConvos.map(c=>c.platform||"facebook")].filter(Boolean))];
  // "2m / 3h / 5d" — enough to scan the list; the full date lives in the chat.
  const ago=(t)=>{ if(!t) return ""; const s=(Date.now()-new Date(t).getTime())/1000;
    if(s<60) return "now"; if(s<3600) return Math.floor(s/60)+"m"; if(s<86400) return Math.floor(s/3600)+"h";
    if(s<604800) return Math.floor(s/86400)+"d"; return new Date(t).toLocaleDateString("en-GB",{day:"numeric",month:"short"}); };
  const isMobile=useIsMobile();
  const [sel,setSel]=useState(-1);
  // The open conversation answers the back press before the tab does, so one
  // press closes the chat and the next leaves the tab.
  useEffect(()=>{
    if(typeof window==="undefined") return;
    window.__alBack = () => { if(sel>=0){ setSel(-1); return true; } return false; };
    return ()=>{ if(window.__alBack) window.__alBack=null; };
  },[sel]);
  useEffect(()=>{onChatOpen&&onChatOpen(isMobile&&sel>=0);},[sel,isMobile]);
  // Changing a filter can drop the conversation that was open; let it go rather
  // than leaving an index pointing at nothing.
  useEffect(()=>{ if(sel>=convos.length) setSel(convos.length?0:-1); },[convos.length]);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
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

  // A message arriving anywhere for this client re-fetches contacts (line
  // below), which used to blindly overwrite whatever was just toggled: click
  // "off", a new message's broadcast lands mid-flight, the refetch still
  // carries the pre-PUT value and stomps the switch back on a few seconds
  // later. pendingRef remembers what the user just set and for how long, so
  // a refetch during that window keeps the local value instead of the
  // possibly-stale fetched one. It clears itself once the PUT has had time
  // to actually commit, so a genuinely newer change (e.g. from another tab)
  // still comes through after that.
  const pendingRef=useRef({});         // { [sender_id]: expiresAt }  ("global" for the whole-account switch)
  const stillPending=(key)=>{ const exp=pendingRef.current[key]; if(exp&&Date.now()<exp) return true; if(exp) delete pendingRef.current[key]; return false; };

  const loadContacts=async()=>{
    try{
      const d=await api("/api/contacts").then(r=>r.json());
      if(d.contacts) setContacts(prev=>{
        const next=Object.fromEntries(d.contacts.map(c=>[c.sender_id,c]));
        for(const sid of Object.keys(next)) if(stillPending(sid)) next[sid]=prev[sid]||next[sid];
        return next;
      });
      if(typeof d.global_bot_enabled==="boolean" && !stillPending("global")) setGlobalBot(d.global_bot_enabled);
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
    pendingRef.current[isGlobal?"global":sender_id]=Date.now()+8000;
    if(isGlobal) setGlobalBot(val);
    else setContacts(p=>({...p,[sender_id]:{...p[sender_id],sender_id,bot_enabled:val}}));
    await api("/api/contacts",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(isGlobal?{global:true,bot_enabled:val}:{sender_id,bot_enabled:val})});
  };

  const filtered = chFilter!=="all"||tagFilter!=="all"||!!q;
  if(!convos.length&&!filtered) return <Card style={{textAlign:"center",padding:"48px 24px"}}>
    <i className="ti ti-inbox" style={{fontSize:32,color:T.textDim}}/>
    <div style={{fontSize:15,fontWeight:600,color:T.text,margin:"14px 0 7px"}}>No conversations yet</div>
    <div style={{fontSize:13.5,color:T.textMuted,lineHeight:1.65,maxWidth:320,margin:"0 auto"}}>
      As soon as someone writes to your Facebook, Instagram, WhatsApp or website, the chat appears here.
    </div>
  </Card>;
  const idx=sel<0?0:sel;
  // `c` is empty whenever a filter matches nothing. Everything below has to
  // survive that: the crash was reading c.sender on an empty list.
  const c=convos[idx]||convos[0]||null;
  const ct=(c&&contacts[c.id])||{};
  const cname=ct.name||c?.sender||"";
  const showList=!isMobile||sel<0;
  const showChat=(!isMobile||sel>=0)&&!!c;

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

  return <div style={{display:isMobile?"block":"grid",gridTemplateColumns:"320px minmax(0,1fr)",gap:16,height:isMobile?(sel>=0?"100dvh":"calc(100dvh - 190px)"):"calc(100vh - 130px)"}}>
    {showList&&<Card style={{overflow:"auto",padding:0,height:"100%"}}>
      <div style={{padding:"12px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:500,color:T.textMuted}}>CHATS</span>
        <Toggle on={globalBot} onClick={()=>toggle(null,!globalBot,true)} label={globalBot?"Bot ON":"Bot OFF"}/>
      </div>
      {/* Search first — with a long inbox it is the fastest way in. */}
      <div style={{padding:"10px 12px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:10,padding:"0 10px"}}>
          <i className="ti ti-search" style={{fontSize:14,color:T.textDim,flexShrink:0}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or message"
            style={{flex:1,background:"none",border:"none",outline:"none",color:T.text,fontSize:12.5,padding:"8px 0",minWidth:0}}/>
          {search&&<button onClick={()=>setSearch("")} aria-label="Clear search" style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,fontSize:14,padding:2,flexShrink:0}}><i className="ti ti-x"/></button>}
        </div>
      </div>
      {/* Two dropdowns instead of two rows of chips. On a phone the chips were
          eating half the screen before a single conversation appeared, and the
          counts are more readable inside the menu than crammed into a pill.
          A platform with several accounts also lists each one. */}
      {(avail.length>1||!!tagData?.available?.length)&&
        <div style={{display:"flex",gap:8,padding:"10px 12px",borderBottom:`1px solid ${T.border}`,flexWrap:"wrap"}}>
          {avail.length>1&&
            <Select value={chFilter} onChange={setChFilter} style={{flex:"1 1 140px",minWidth:0}}
              options={[{value:"all",label:`All channels (${allConvos.length})`,icon:"ti-inbox"},
                ...avail.flatMap(f=>[
                  {value:f,label:cap(f),icon:CH_ICON[f]||"ti-message"},
                  ...(((perPlatform[f]||[]).length>1)?(perPlatform[f]||[]).map(ch=>({value:`${f}|${ch.page_id}`,label:`— ${ch.name||"…"+String(ch.page_id||"").slice(-4)}`,icon:CH_ICON[f]||"ti-message"})):[]),
                ])]}/>}
          {!!tagData?.available?.length&&
            <Select value={tagFilter} onChange={setTagFilter} style={{flex:"1 1 140px",minWidth:0}}
              options={[{value:"all",label:"All tags",icon:"ti-tag"},
                ...tagData.available.map(f=>{
                  const n=tagData.counts?.[f]||0;
                  return {value:f,label:n?`${f} (${n})`:f,
                    icon:f===tagData.complaint_tag?"ti-alert-triangle":"ti-tag"};
                })]}/>}
        </div>}

      {!convos.length&&<div style={{padding:"38px 20px",textAlign:"center"}}>
        <i className="ti ti-inbox" style={{fontSize:30,color:T.textDim}}/>
        <div style={{fontSize:14,fontWeight:600,color:T.text,margin:"12px 0 6px"}}>Nothing here yet</div>
        <div style={{fontSize:13,color:T.textMuted,lineHeight:1.6,maxWidth:300,margin:"0 auto 16px"}}>
          {filtered
            ? "No conversation matches these filters."
            : "Conversations will appear here as soon as a customer writes to you."}
        </div>
        {filtered&&
          <button onClick={()=>{setChFilter("all");setTagFilter("all");setSearch("");}} className="ui-btn"
            style={{padding:"9px 16px",borderRadius:9,border:`1px solid ${T.border}`,background:T.card,
              color:T.text,fontSize:13.5,fontWeight:600,cursor:"pointer"}}>Clear filters</button>}
      </div>}
      {convos.map((cv,i)=>{
        const cvt=contacts[cv.id]||{};
        const multi=(perPlatform[cv.platform]||[]).length>1;
        return <div key={cv.id} onClick={()=>setSel(i)} style={{padding:"14px 16px",cursor:"pointer",borderBottom:`0.5px solid ${T.border}`,background:sel===i?T.goldBg:"transparent",borderLeft:sel===i?`3px solid ${T.gold}`:"3px solid transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:6,minWidth:0}}>
              <i className={`ti ${CH_ICON[cv.platform]||"ti-message"}`} style={{fontSize:13,color:T.textMuted,flexShrink:0}}/>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cvt.name||cv.sender}</span>
            </span>
            <span style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
              <span style={{fontSize:10.5,color:T.textDim}}>{ago(cv.time)}</span>
              <Badge color={cvt.bot_enabled===false?T.warn:T.success}>{cvt.bot_enabled===false?"manual":"bot"}</Badge>
            </span>
          </div>
          <span style={{fontSize:12,color:T.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{cv.lastMsg}</span>
          {(multi&&cv.page_id)||tagsOf(cv.id).length?<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6,alignItems:"center"}}>
            {multi&&cv.page_id&&<span style={{fontSize:10.5,padding:"2px 8px",borderRadius:10,background:T.bgAlt,color:T.textDim,border:`0.5px solid ${T.border}`,display:"inline-flex",alignItems:"center",gap:4}}><i className="ti ti-arrow-narrow-right" style={{fontSize:11}}/>{acctName(cv.platform,cv.page_id)}</span>}
            {tagsOf(cv.id).map(t=><span key={t} style={{fontSize:10.5,padding:"2px 8px",borderRadius:10,background:t===tagData?.complaint_tag?T.dangerBg:T.bgAlt,color:t===tagData?.complaint_tag?T.danger:T.textMuted,border:`0.5px solid ${t===tagData?.complaint_tag?T.danger+"40":T.border}`}}>{t}</span>)}
          </div>:null}
        </div>;
      })}
    </Card>}
    {showChat&&<Card style={{display:"flex",flexDirection:"column",padding:0,overflow:"hidden",height:"100%"}}>
      <div style={{padding:"14px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          {isMobile&&<button onClick={()=>setSel(-1)} style={{background:"none",border:"none",cursor:"pointer",color:T.gold,fontSize:20,padding:0,flexShrink:0}}><i className="ti ti-chevron-left"/></button>}
          <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cname}</div><div style={{fontSize:12,color:T.textMuted,display:"flex",alignItems:"center",gap:4}}><i className={`ti ${PICON[c.platform]||"ti-message"}`} style={{fontSize:13}}/>{c.platform}{(perPlatform[c.platform]||[]).length>1&&c.page_id?<span style={{color:T.textDim}}> · {acctName(c.platform,c.page_id)}</span>:null}
            {!!tagData?.available?.length&&<span onClick={e=>e.stopPropagation()} style={{marginLeft:6,display:"inline-block"}}>
              <Select value={tagsOf(c.id)[0]||""} placeholder="Tag…" style={{fontSize:11}}
                options={tagData.available.map(t=>({value:t,label:t,icon:"ti-tag"}))}
                onChange={async t=>{
                  if(!t) return;
                  await api("/api/tags",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_id:c.id,tag:t})});
                  loadTags();
                }}/>
            </span>}
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
