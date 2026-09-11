"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Badge, useIsMobile, Select, Switch } from "./ui.js";
import { api, getSb, apiJson } from "./session.js";
import { useBackClose } from "./back.js";

// The Conversations tab, moved out of dashboard-client.js unchanged.

const CH_ICON = { facebook:"ti-brand-messenger", instagram:"ti-brand-instagram",
  whatsapp:"ti-brand-whatsapp", website:"ti-world" };

export default function Conversations({convos:allConvos,refresh,onChatOpen,channels=[],focus=null}) {
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
  // The open conversation is tracked by its STABLE id, never its position in the
  // list — the list re-sorts every refresh (newest chat first), so an index would
  // point at a different conversation seconds later, which is why one chat used to
  // "jump" into another.
  const [selId,setSelId]=useState(null);
  // The shown conversation, found by its stable id in the FULL list — so a
  // re-sort (newest chat jumps to the top every refresh) or a filter can never
  // swap the open chat for a different one, which was the "it took me to another
  // conversation" bug. On desktop, where the pane is always on screen, the newest
  // is previewed until one is chosen.
  const selConvo = selId!=null ? allConvos.find(x=>String(x.id)===String(selId)) : null;
  const c = selConvo || (isMobile ? null : (convos[0]||null));
  const hasSel = !!selConvo;                       // a real conversation is chosen
  // The FULL history of the open chat, fetched on open (the list only carries a
  // recent window, so a long chat was missing its older messages — like opening
  // Messenger and seeing every message, not just the last few). `thread` is that
  // full history; new messages that arrive after it loads are appended from the
  // live list so nothing is missed while the chat stays open.
  const [thread,setThread]=useState(null);
  const [threadId,setThreadId]=useState(null);     // which chat `thread` belongs to
  const shownMsgs = (()=>{
    const live=c?.messages||[];
    if(threadId!==(c?.id)||!thread) return live;   // history not loaded yet → show what we have
    const lastT=thread.length?new Date(thread[thread.length-1].time).getTime():0;
    const extra=live.filter(m=>new Date(m.time).getTime()>lastT);
    return extra.length?[...thread,...extra]:thread;
  })();
  const msgCount = shownMsgs.length;
  // Desktop always shows a conversation; make it a STABLE pick, not the moving
  // top-of-list (which changed under you whenever a new message re-sorted the
  // list). Read the real width, not the isMobile state, which starts false on
  // mount and would briefly auto-open a chat on a phone.
  useEffect(()=>{
    if(selId!=null || !convos.length) return;
    if(typeof window!=="undefined" && window.innerWidth>=768) setSelId(convos[0].id);
  },[selId,convos.length]);
  // The open conversation answers the back press before the tab does, so one
  // press closes the chat and the next goes to the previous page.
  useBackClose(hasSel,()=>setSelId(null));
  // A notification was tapped for ONE customer: open that chat as soon as it is
  // in the list (the list may still be loading on a cold start). `ts` lets the
  // same customer be opened twice in a row.
  useEffect(()=>{
    if(!focus?.id) return;
    if(allConvos.some(x=>String(x.id)===String(focus.id))) setSelId(focus.id);
  },[focus?.id,focus?.ts,allConvos.length]); // eslint-disable-line
  useEffect(()=>{onChatOpen&&onChatOpen(isMobile&&hasSel);},[hasSel,isMobile]);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  // null = not loaded yet. Starting at `true` painted a green "Bot ON" for the
  // first seconds after a reload (a cold API call can take 5s), which read as
  // "my OFF turned itself back on". No state is shown until the truth arrives.
  const [globalBot,setGlobalBot]=useState(null);
  const [ctLoaded,setCtLoaded]=useState(false);
  const chatRef=useRef(null);
  const galleryRef=useRef(null);
  const cameraRef=useRef(null);
  // The mobile chat list used to be a fixed height (calc(100dvh - 190px)); that
  // magic number is right on one phone and leaves a gap or overflows on the next,
  // because the header, the "Read docs" line and any banner above it are all
  // different heights per device/state. Measure the list's own top instead and
  // fill from there to the bottom of the screen — correct on every device.
  const listRef=useRef(null);
  const [fitH,setFitH]=useState(null);
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
    const r=await apiJson("/api/send-media",{method:"POST",body:fd});
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
    setSelId(null);
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
      if(d.contacts) setCtLoaded(true);
    }catch{}
  };
  useEffect(()=>{loadContacts();},[]);
  useEffect(()=>{
    const ch=getSb().channel("mb").on("broadcast",{event:"insert"},()=>{refresh&&refresh(true);loadContacts();}).subscribe();
    const t=setInterval(()=>{refresh&&refresh(true);loadContacts();},45000);
    return ()=>{getSb().removeChannel(ch);clearInterval(t);};
  },[refresh]);
  // Whether the reader is at the bottom of the thread right now. Updated on
  // scroll; a new message only pulls the view down if they were already there —
  // never yanks them down while they are reading older messages (the old effect
  // ran on every render because `convos` is a fresh array each time, so any
  // background refresh scrolled to the bottom).
  // Load the whole history when a conversation opens (or when it changes). Reset
  // first so the previous chat's history never flashes under the new one.
  useEffect(()=>{
    const id=c?.id;
    if(id==null){ setThread(null); setThreadId(null); return; }
    let cancelled=false;
    setThread(null); setThreadId(id);
    api(`/api/conversations/messages?sender_id=${encodeURIComponent(id)}`)
      .then(r=>r.json())
      .then(d=>{ if(!cancelled && Array.isArray(d?.messages)) setThread(d.messages); })
      .catch(()=>{ /* the recent window from the list still shows */ });
    return ()=>{ cancelled=true; };
  },[c?.id]);
  const atBottomRef=useRef(true);
  const pinBottom=(smooth)=>{ const el=chatRef.current; if(!el) return; if(smooth) el.scrollTo({top:el.scrollHeight,behavior:"smooth"}); else el.scrollTop=el.scrollHeight; };
  const onChatScroll=()=>{ const el=chatRef.current; if(el) atBottomRef.current=(el.scrollHeight-el.scrollTop-el.clientHeight)<80; };
  // A product image in the thread has no reserved height, so it loads AFTER the
  // first paint and grows the thread — which is what actually made the view jump
  // "up and down": we scrolled to a bottom that then moved. Re-pin to the bottom
  // as content grows, but ONLY while the reader is already at the bottom.
  const onImgLoad=()=>{ if(atBottomRef.current) pinBottom(false); };
  // Opening (or switching to) a conversation lands on the latest message
  // instantly, no animation — keyed on the shown conversation's id.
  useEffect(()=>{ if(!hasSel && isMobile) return; atBottomRef.current=true; pinBottom(false); },[c?.id]);
  // When the full history arrives it adds OLDER messages above; jump straight to
  // the bottom (the latest) instead of smooth-scrolling through all of it.
  useEffect(()=>{ if(thread && threadId===(c?.id) && atBottomRef.current) pinBottom(false); },[thread]);
  // A NEW message scrolls down smoothly, but only if they were at the bottom.
  useEffect(()=>{ if(atBottomRef.current) pinBottom(true); },[msgCount]);
  // Fill the chat list from its own top to the bottom of the visible screen.
  // Re-measured on resize (a phone's address bar hiding fires it) and whenever
  // what sits above the list can change (the filter row appears, a banner shows).
  useEffect(()=>{
    if(!isMobile||hasSel){ setFitH(null); return; }
    const measure=()=>{ const r=listRef.current?.getBoundingClientRect(); if(r) setFitH(Math.max(280,Math.round(window.innerHeight-r.top-8))); };
    measure();
    const t=setTimeout(measure,150);
    window.addEventListener("resize",measure);
    return ()=>{ clearTimeout(t); window.removeEventListener("resize",measure); };
  },[isMobile,hasSel,allConvos.length,avail.length,tagData?.available?.length]);

  const toggle=async(sender_id,val,isGlobal)=>{
    pendingRef.current[isGlobal?"global":sender_id]=Date.now()+8000;
    if(isGlobal) setGlobalBot(val);
    else setContacts(p=>({...p,[sender_id]:{...p[sender_id],sender_id,bot_enabled:val}}));
    // If the save fails, put the switch back and say so — a switch that shows
    // a value the server refused is worse than an error message.
    const r=await api("/api/contacts",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(isGlobal?{global:true,bot_enabled:val}:{sender_id,bot_enabled:val})}).catch(()=>null);
    if(!r||!r.ok){
      delete pendingRef.current[isGlobal?"global":sender_id];
      if(isGlobal) setGlobalBot(!val);
      else setContacts(p=>({...p,[sender_id]:{...p[sender_id],sender_id,bot_enabled:!val}}));
      alert("Could not save the bot switch. Please check your connection and try again.");
    }
  };

  const filtered = chFilter!=="all"||tagFilter!=="all"||!!q;
  if(!convos.length&&!filtered) return <Card style={{textAlign:"center",padding:"48px 24px"}}>
    <i className="ti ti-inbox" style={{fontSize:32,color:T.textDim}}/>
    <div style={{fontSize:15,fontWeight:600,color:T.text,margin:"14px 0 7px"}}>No conversations yet</div>
    <div style={{fontSize:13.5,color:T.textMuted,lineHeight:1.65,maxWidth:320,margin:"0 auto"}}>
      As soon as someone writes to your Facebook, Instagram, WhatsApp or website, the chat appears here.
    </div>
  </Card>;
  // `c` (the shown conversation) is computed near the top; it is empty whenever a
  // filter matches nothing, and everything below survives that (the crash was
  // reading c.sender on an empty list).
  const ct=(c&&contacts[c.id])||{};
  const cname=ct.name||c?.sender||"";
  const showList=!isMobile||!hasSel;
  const showChat=(!isMobile||hasSel)&&!!c;

  const send=async()=>{
    const text=input.trim();
    if(!text||sending) return;
    setSending(true); setInput("");
    const r=await apiJson("/api/send-message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_id:c.id,text})});
    setSending(false);
    if(r.error) alert("Send failed: "+r.error);
    else refresh&&refresh(true);
  };

  const Toggle=({on,onClick,label})=><Switch on={on} onClick={onClick} label={label} size="sm"/>;

  return <div ref={listRef} style={{display:isMobile?"block":"grid",gridTemplateColumns:"320px minmax(0,1fr)",gap:16,height:isMobile?(hasSel?"100%":(fitH?fitH+"px":"calc(100dvh - 190px)")):"calc(100vh - 130px)"}}>
    {showList&&<Card style={{overflow:"auto",padding:0,height:"100%"}}>
      <div style={{padding:"12px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:500,color:T.textMuted}}>CHATS</span>
        {globalBot===null
          ?<span style={{fontSize:11,color:T.textDim}}><i className="ti ti-loader-2" style={{marginRight:5}}/>Loading…</span>
          :<Toggle on={globalBot} onClick={()=>toggle(null,!globalBot,true)} label={globalBot?"Bot ON":"Bot OFF"}/>}
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
      {/* flex:"0 1 auto" on both — an equal flex-basis (both used to say
          "1 1 140px") assumes both labels need the same room, and these two
          never do: "All channels (N)" runs longer than "All tags". At a
          phone's width that mismatch was not just a wasted-space issue —
          the channel button's own text needed more than its allotted half,
          and a plain button is not itself a flex participant, so it kept its
          full content width regardless of the box drawn around it and drew a
          measured 4px into the tag filter beside it. "auto" sizes each to
          its own content first and only shrinks either one, gracefully, if
          both truly cannot fit — see the Select button's own maxWidth fix in
          ui.js, which is what makes shrinking (rather than overflowing)
          possible at all. */}
      {(avail.length>1||!!tagData?.available?.length)&&
        <div style={{display:"flex",gap:8,padding:"10px 12px",borderBottom:`1px solid ${T.border}`,flexWrap:"wrap"}}>
          {avail.length>1&&
            <Select value={chFilter} onChange={setChFilter} style={{flex:"0 1 auto",minWidth:0}}
              // "All channels" used to carry allConvos.length — the number of
              // CHATS, not channels, so a client with 4 connected channels and
              // 6 open chats saw "All channels (6)" and reasonably read that
              // as a wrong channel count. The connected-channel total here is
              // the same number the Channels tab shows, so the two can never
              // disagree; each entry below counts its own conversations, which
              // is the number a filter's label is actually for.
              options={[{value:"all",label:`All channels (${channels.filter(c=>c.status==="connected").length})`,icon:"ti-inbox"},
                ...avail.flatMap(f=>[
                  {value:f,label:`${cap(f)} (${allConvos.filter(c=>(c.platform||"facebook")===f).length})`,icon:CH_ICON[f]||"ti-message"},
                  ...(((perPlatform[f]||[]).length>1)?(perPlatform[f]||[]).map(ch=>({value:`${f}|${ch.page_id}`,
                    label:`— ${ch.name||"…"+String(ch.page_id||"").slice(-4)} (${allConvos.filter(c=>(c.platform||"facebook")===f&&String(c.page_id||"")===String(ch.page_id||"")).length})`,
                    icon:CH_ICON[f]||"ti-message"})):[]),
                ])]}/>}
          {!!tagData?.available?.length&&
            <Select value={tagFilter} onChange={setTagFilter} style={{flex:"0 1 auto",minWidth:0}}
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
        const on=String(selId)===String(cv.id);
        // Messenger's rule: a chat whose newest message is the customer's and
        // has had NO reply yet — not from the bot, not from you, not from the
        // Messenger app — is shown bold, with a dot. The moment any reply
        // lands it goes back to normal weight. This is the same set the
        // sidebar's Inbox badge counts, so the number and the bold rows
        // always agree.
        const waiting=cv.status==="active";
        return <div key={cv.id} onClick={()=>setSelId(cv.id)} title={waiting?"Waiting for a reply":undefined} style={{padding:"14px 16px",cursor:"pointer",borderBottom:`0.5px solid ${T.border}`,background:on?T.goldBg:"transparent",borderLeft:on?`3px solid ${T.gold}`:"3px solid transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:waiting?700:500,color:T.text,display:"flex",alignItems:"center",gap:6,minWidth:0}}>
              <i className={`ti ${CH_ICON[cv.platform]||"ti-message"}`} style={{fontSize:13,color:T.textMuted,flexShrink:0}}/>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cvt.name||cv.sender}</span>
            </span>
            <span style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
              <span style={{fontSize:10.5,color:waiting?T.text:T.textDim,fontWeight:waiting?600:400}}>{ago(cv.time)}</span>
              {ctLoaded&&<Badge color={cvt.bot_enabled===false?T.warn:T.success}>{cvt.bot_enabled===false?"manual":"bot"}</Badge>}
              {waiting&&<span aria-label="Waiting for a reply" style={{width:9,height:9,borderRadius:"50%",background:T.gold,flexShrink:0,display:"inline-block"}}/>}
            </span>
          </div>
          <span style={{fontSize:12,color:waiting?T.text:T.textMuted,fontWeight:waiting?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{cv.lastMsg}</span>
          {(multi&&cv.page_id)||tagsOf(cv.id).length?<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6,alignItems:"center"}}>
            {multi&&cv.page_id&&<span style={{fontSize:10.5,padding:"2px 8px",borderRadius:10,background:T.bgAlt,color:T.textDim,border:`0.5px solid ${T.border}`,display:"inline-flex",alignItems:"center",gap:4}}><i className="ti ti-arrow-narrow-right" style={{fontSize:11}}/>{acctName(cv.platform,cv.page_id)}</span>}
            {tagsOf(cv.id).map(t=><span key={t} style={{fontSize:10.5,padding:"2px 8px",borderRadius:10,background:t===tagData?.complaint_tag?T.dangerBg:T.bgAlt,color:t===tagData?.complaint_tag?T.danger:T.textMuted,border:`0.5px solid ${t===tagData?.complaint_tag?T.danger+"40":T.border}`}}>{t}</span>)}
          </div>:null}
        </div>;
      })}
    </Card>}
    {showChat&&<Card style={{display:"flex",flexDirection:"column",padding:0,overflow:"hidden",height:"100%"}}>
      {/* The chat header, shaped the way a messaging app shapes it: who you
          are talking to, where the conversation lives, and the one control
          that matters — is the bot answering, or are you. The tag picker used
          to sit inline in the middle of the platform line; on a phone it grew
          until the switch was pushed on top of it. It now has its own quiet
          row below, at both widths, so nothing competes for the name row. */}
      <div style={{borderBottom:`0.5px solid ${T.border}`}}>
        <div style={{padding:isMobile?"10px 10px 10px 6px":"12px 16px",display:"flex",alignItems:"center",gap:isMobile?6:10}}>
          {isMobile&&<button onClick={()=>setSelId(null)} aria-label="Back" className="ui-sq"
            style={{background:"none",border:"none",cursor:"pointer",color:T.text,fontSize:21,padding:0,flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-chevron-left"/></button>}
          <div aria-hidden style={{width:36,height:36,borderRadius:"50%",background:T.goldBg,color:T.gold,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,flexShrink:0}}>
            {(cname||"C").trim().charAt(0).toUpperCase()}
          </div>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:15,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cname||"Customer"}</div>
            <div style={{fontSize:11.5,color:T.textMuted,display:"flex",alignItems:"center",gap:5,minWidth:0}}>
              <i className={`ti ${PICON[c.platform]||"ti-message"}`} style={{fontSize:12,flexShrink:0}}/>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {cap(c.platform)}{(perPlatform[c.platform]||[]).length>1&&c.page_id?` · ${acctName(c.platform,c.page_id)}`:""}
              </span>
            </div>
          </div>
          {!ctLoaded
            ?<span style={{fontSize:11,color:T.textDim,flexShrink:0}}><i className="ti ti-loader-2" style={{marginRight:5}}/>Loading…</span>
            :<Toggle on={ct.bot_enabled!==false} onClick={()=>toggle(c.id,ct.bot_enabled===false,false)} label={ct.bot_enabled===false?"Manual":"Live"}/>}
          <button onClick={deleteChat} title="Delete chat" aria-label="Delete chat" className="ui-sq"
            style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:17,padding:0,flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-trash"/></button>
        </div>
        {!!tagData?.available?.length&&<div style={{padding:isMobile?"0 12px 10px":"0 16px 10px",display:"flex",alignItems:"center",gap:8}}>
          <Select value={tagsOf(c.id)[0]||""} placeholder="Tag this chat…" style={{fontSize:11.5}}
            options={tagData.available.map(t=>({value:t,label:t,icon:"ti-tag"}))}
            onChange={async t=>{
              if(!t) return;
              await api("/api/tags",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_id:c.id,tag:t})});
              loadTags();
            }}/>
        </div>}
      </div>
      <div ref={chatRef} onScroll={onChatScroll} style={{flex:1,overflow:"auto",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch",padding:20,display:"flex",flexDirection:"column",gap:12}}>
        {shownMsgs.map((m,i)=>{
          const mine=m.role!=="customer";
          return <div key={i} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start"}}>
          <div style={{maxWidth:"70%"}}>
            {(m.attachments||[]).length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:4,alignItems:mine?"flex-end":"flex-start"}}>
              {m.attachments.map((u,j)=><img key={j} src={u} alt="" onLoad={onImgLoad} style={{maxWidth:220,borderRadius:16,display:"block"}} onError={e=>{e.target.style.display="none"}}/>)}
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
        {/* Every round button here carries "ui-sq": without it, a phone's
            touch rule (buttons want to be at least 44px tall) raised only the
            HEIGHT of these — min-height beats an inline height, but nothing
            beats the inline width sitting right next to it — so a 34px
            circle became a 34x44 oval. "ui-sq" grows both dimensions
            together on a touch screen, so every one of these stays a true
            circle, just a bigger one where a thumb needs it. */}
        {/* The extra bottom pad is the phone's safe area: installed as an app
            (no browser bar), this chat fills the screen edge-to-edge, so without
            it the composer slides under the Android/iOS navigation bar. It is
            0 in a normal browser, so nothing changes there. */}
        <div style={{padding:"8px 8px calc(8px + env(safe-area-inset-bottom)) 8px",display:"flex",gap:4,alignItems:"center"}}>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e=>{sendMedia(e.target.files[0],"image");e.target.value="";}}/>
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={e=>{sendMedia(e.target.files[0],"image");e.target.value="";}}/>
          <button onClick={()=>cameraRef.current?.click()} title="Camera" aria-label="Camera" className="ui-sq"
            style={{width:36,height:36,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",color:"#0084ff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><i className="ti ti-camera"/></button>
          <button onClick={()=>galleryRef.current?.click()} title="Photo" aria-label="Photo" className="ui-sq"
            style={{width:36,height:36,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",color:"#0084ff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><i className="ti ti-photo"/></button>
          <button onClick={toggleRec} title="Voice" aria-label="Voice" className="ui-sq"
            style={{width:36,height:36,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",color:recording?T.danger:"#0084ff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,animation:recording?"pulse 1s infinite":"none"}}><i className={`ti ${recording?"ti-player-stop-filled":"ti-microphone"}`}/></button>
          <div style={{flex:1,display:"flex",alignItems:"center",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:20,padding:"0 4px 0 12px",minWidth:0}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message" style={{flex:1,background:"none",border:"none",padding:"10px 0",color:T.text,fontSize:13,outline:"none",minWidth:0}}/>
            <button onClick={()=>setShowEmoji(s=>!s)} title="Emoji" aria-label="Emoji" className="ui-sq"
              style={{width:30,height:30,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>😊</button>
          </div>
          <button onClick={send} disabled={sending} aria-label="Send" className="ui-sq"
            style={{width:36,height:36,borderRadius:"50%",border:"none",cursor:"pointer",background:"#0084ff",display:"flex",alignItems:"center",justifyContent:"center",opacity:sending?.6:1,flexShrink:0}}><i className="ti ti-send" style={{fontSize:16,color:"#fff"}}/></button>
        </div>
      </div>
    </Card>}
  </div>;
}
