"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Badge, useIsMobile, Select, Switch, Segmented, taka, shortDate } from "./ui.js";
import { api, getSb, apiJson } from "./session.js";
import { useBackClose } from "./back.js";
import { useConvoRead, markConvoSeen } from "./convo-read.js";
import { useT } from "./i18n.js";
import { groupThread } from "@/lib/thread-groups.js";

// The Inbox. Laid out the way the owner's design deck draws it (2026-09-20):
// four numbers across the top, the list with an avatar and a channel dot per
// chat, the open chat with a "Bot replying / Take over" control, a product
// card wherever the bot showed one, and the customer panel on a wide screen.

const CH_ICON = { facebook:"ti-brand-messenger", instagram:"ti-brand-instagram",
  whatsapp:"ti-brand-whatsapp", website:"ti-world" };
// The channel's own colour, as the dot on an avatar (the same three the
// Overview uses); the website widget has no brand colour and stays grey.
const PCOLOR = { facebook:"#1877f2", instagram:"#e1306c", whatsapp:"#25d366" };
const initialsOf = (s) => (String(s||"?").trim().replace(/^\+/,"").split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"?");
// A WhatsApp sender id is the customer's phone number; the chat header shows
// it the way the deck does — the country and the first digits, then dots.
const maskPhone = (sid) => { const d=String(sid||"").replace(/\D/g,""); return "+"+d.slice(0,3)+" "+d.slice(3,7)+" ······"; };
// "Today, 2:14 pm" above the first message of each day.
const dayLabel = (x, t) => {
  const d=new Date(x), n=new Date(), y=new Date(); y.setDate(n.getDate()-1);
  const same=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  const day=same(d,n)?t("inbox.today"):same(d,y)?t("inbox.yesterday"):d.toLocaleDateString("en-GB",{day:"numeric",month:"short"});
  return `${day}, ${d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}).toLowerCase()}`;
};

// One picture, or a grid of them: two side by side, three and more as small
// squares in rows of three, a "+N" over the ninth when there are more. Each
// opens the viewer.
function ImageGroup({urls,mine,onOpen,onLoad}){
  const n=urls.length;
  if(n===1) return <button type="button" onClick={()=>onOpen(0)} aria-label="Open image" style={{padding:0,border:"none",background:"none",cursor:"zoom-in",display:"block",borderRadius:16,overflow:"hidden"}}>
    <img src={urls[0]} alt="" onLoad={onLoad} style={{maxWidth:220,maxHeight:300,borderRadius:16,display:"block",objectFit:"cover"}} onError={e=>{e.target.style.display="none"}}/>
  </button>;
  const cols=n===2||n===4?2:3, size=cols===2?112:84, shown=urls.slice(0,9), more=n-shown.length;
  return <div style={{display:"grid",gridTemplateColumns:`repeat(${cols}, ${size}px)`,gap:3,borderRadius:14,overflow:"hidden",justifyContent:mine?"end":"start"}}>
    {shown.map((u,i)=><button key={i} type="button" onClick={()=>onOpen(i)} aria-label={`Open image ${i+1} of ${n}`}
      style={{position:"relative",padding:0,border:"none",background:T.inset,cursor:"zoom-in",width:size,height:size,minHeight:0,display:"block"}}>
      <img src={u} alt="" onLoad={onLoad} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.target.style.visibility="hidden"}}/>
      {more>0&&i===shown.length-1&&<span style={{position:"absolute",inset:0,background:"rgba(11,11,14,.55)",color:"#fff",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+{more}</span>}
    </button>)}
  </div>;
}

// The picture, full screen, the way Messenger opens one: dark backdrop, the
// image fitted to the screen, arrows and a counter when it came in a group,
// and a link to the original. Escape, the backdrop, the X and the phone's
// back button all close it.
function ImageViewer({urls,index,onIndex,onClose}){
  const n=urls.length;
  const go=(d)=>onIndex((index+d+n)%n);
  useEffect(()=>{
    const k=(e)=>{ if(e.key==="Escape") onClose(); else if(e.key==="ArrowRight"&&n>1) go(1); else if(e.key==="ArrowLeft"&&n>1) go(-1); };
    window.addEventListener("keydown",k);
    return ()=>window.removeEventListener("keydown",k);
  }); // eslint-disable-line
  const sq={width:44,height:44,borderRadius:"50%",border:"none",cursor:"pointer",background:"rgba(255,255,255,.14)",color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0};
  // A finger swipe moves between the pictures of a group, as it does in Messenger.
  const touch=useRef(null);
  const onTouchStart=(e)=>{ const p=e.touches[0]; touch.current={x:p.clientX,y:p.clientY}; };
  const onTouchEnd=(e)=>{ const s0=touch.current; touch.current=null; if(!s0||n<2) return; const p=e.changedTouches[0]; const dx=p.clientX-s0.x, dy=p.clientY-s0.y;
    if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.5) go(dx<0?1:-1); };
  return <div role="dialog" aria-modal="true" aria-label="Image" onClick={onClose} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
    style={{position:"fixed",inset:0,height:"100dvh",zIndex:95,background:"rgba(11,11,14,.94)",display:"flex",flexDirection:"column",
      paddingTop:"env(safe-area-inset-top)",paddingBottom:"env(safe-area-inset-bottom)"}}>
    <div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 12px",flexShrink:0}}>
      <span style={{color:"#fff",fontSize:13,fontWeight:600,fontVariantNumeric:"tabular-nums",minWidth:44}}>{n>1?`${index+1} / ${n}`:""}</span>
      <span style={{display:"flex",gap:8}}>
        <a href={urls[index]} target="_blank" rel="noopener noreferrer" aria-label="Open original" title="Open original" className="ui-sq" style={{...sq,textDecoration:"none"}}><i className="ti ti-external-link"/></a>
        <button type="button" onClick={onClose} aria-label="Close" className="ui-sq" style={sq}><i className="ti ti-x"/></button>
      </span>
    </div>
    <div style={{flex:1,minHeight:0,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"0 8px 12px"}}>
      {n>1&&<button type="button" onClick={e=>{e.stopPropagation();go(-1);}} aria-label="Previous image" className="ui-sq" style={sq}><i className="ti ti-chevron-left"/></button>}
      <img src={urls[index]} alt="" onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"100%",minWidth:0,objectFit:"contain",borderRadius:8,flex:"0 1 auto"}}/>
      {n>1&&<button type="button" onClick={e=>{e.stopPropagation();go(1);}} aria-label="Next image" className="ui-sq" style={sq}><i className="ti ti-chevron-right"/></button>}
    </div>
  </div>;
}

// The four numbers above the inbox. Conversations today and the first-reply
// time come from the chats already loaded (a customer message followed by the
// bot's bubble is one reply; the median of a week of those); the bot's share
// and the week's orders are the same figures Analytics shows for 7 days.
function InboxStats({convos,an,isAgency,isMobile,t}){
  const now=Date.now(), day=86400000;
  const start=new Date(); start.setHours(0,0,0,0); const t0=start.getTime();
  const wrote=(c,a,b)=>(c.messages||[]).some(m=>{ if(m.role!=="customer") return false; const x=new Date(m.time).getTime(); return x>=a&&x<b; });
  const today=convos.filter(c=>wrote(c,t0,now)).length;
  const yday=convos.filter(c=>wrote(c,t0-day,t0)).length;
  const pct=(a,b)=>b?Math.round(((a-b)/b)*100):(a?100:null);
  const replies=(a,b)=>{ const out=[]; for(const c of convos){ const ms=c.messages||[]; for(let i=1;i<ms.length;i++){
    if(ms[i].role==="bot"&&ms[i-1].role==="customer"){ const x=new Date(ms[i].time).getTime(); if(x>=a&&x<b){ const s=(x-new Date(ms[i-1].time).getTime())/1000; if(s>=0&&s<=3600) out.push(s); } } } } return out; };
  const median=(xs)=>{ if(!xs.length) return null; const s=[...xs].sort((p,q)=>p-q); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
  const r1=median(replies(now-7*day,now)), r0=median(replies(now-14*day,now-7*day));
  const secs=(s)=>s==null?"—":s<90?`${Math.round(s)} s`:s<3600?`${(s/60).toFixed(s<600?1:0)} min`:`${(s/3600).toFixed(1)} h`;
  const cv=an?.conversations, k=an?.kpi, g=an?.growth;
  const items=[
    {label:t("inbox.kpi.today"),value:String(today),delta:pct(today,yday),unit:"%"},
    {label:t("inbox.kpi.bot"),value:cv&&cv.bot_resolved_pct!=null?`${cv.bot_resolved_pct}%`:"—",delta:g?.bot_handled_points??null,unit:" pts"},
    isAgency?{label:t("inbox.kpi.bookings"),value:k?String(k.bookings??"—"):"—",delta:g?.conversions??null,unit:"%"}
            :{label:t("inbox.kpi.value"),value:k?taka(k.revenue||0):"—",delta:g?.revenue??null,unit:"%"},
    {label:t("inbox.kpi.reply"),value:secs(r1),delta:r1!=null&&r0?Math.round(((r1-r0)/r0)*100):null,unit:"%",lowerIsBetter:true},
  ];
  const shown=isMobile?items.slice(0,2):items;
  return <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,minmax(0,1fr))",gap:isMobile?8:12,flexShrink:0}}>
    {shown.map((it,i)=>{
      const good=it.delta==null?null:(it.lowerIsBetter?it.delta<0:it.delta>0);
      const bad=it.delta==null?null:(it.lowerIsBetter?it.delta>0:it.delta<0);
      return <Card key={i} style={{padding:isMobile?"12px 14px":"14px 16px",minWidth:0}}>
        <div style={{fontSize:12,color:T.textMuted,lineHeight:1.3,...(isMobile?{}:{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"})}}>{it.label}</div>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:6,minWidth:0}}>
          <span style={{fontSize:isMobile?20:24,fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.05,color:T.text,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{it.value}</span>
          {it.delta!=null&&it.delta!==0&&<span style={{fontSize:12,fontWeight:600,color:good?T.success:bad?T.danger:T.textDim,whiteSpace:"nowrap"}}>{it.delta>0?"+":"−"}{Math.abs(it.delta)}{it.unit}</span>}
        </div>
      </Card>;
    })}
  </div>;
}

// A product the bot showed in the chat, as a card: the bot sends the
// product's own image, so the picture's address finds the product.
function ProductCard({p,t,onLoad}){
  const img=p.image_url||p.images?.[0]||"";
  const out=p.stock_status==="outofstock";
  const qty=p.stock_qty===null||p.stock_qty===undefined||p.stock_qty===""?null:Number(p.stock_qty);
  const price=Number(p.sale_price)>0?p.sale_price:p.regular_price;
  return <div style={{display:"flex",gap:12,alignItems:"center",padding:10,borderRadius:12,border:`1px solid ${T.border}`,background:T.card,maxWidth:300}}>
    <span style={{width:56,height:56,borderRadius:10,background:T.inset,flexShrink:0,overflow:"hidden",display:"block"}}>
      {img&&<img src={img} alt="" onLoad={onLoad} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.target.style.display="none"}}/>}
    </span>
    <span style={{minWidth:0}}>
      <span style={{display:"block",fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.product_name}</span>
      <span style={{display:"block",fontSize:11.5,color:out?T.danger:T.textMuted,marginTop:2}}>{out?t("inbox.outOfStock"):Number.isFinite(qty)?t("inbox.inStock",{n:qty}):t("inbox.inStockNoQty")}</span>
      <span style={{display:"block",fontSize:13,fontWeight:700,color:T.gold,marginTop:3}}>{taka(price)}</span>
    </span>
  </div>;
}

// What the Inbox shows while a lapsed plan has it locked: the reason, how many
// customers have written since, that nothing is lost, and the way out.
function InboxLocked({info,onRenew,t}){
  const since=info?.since?new Date(info.since).toLocaleDateString("en-GB",{day:"numeric",month:"long"}):null;
  return <Card style={{textAlign:"center",padding:"44px 24px"}}>
    <span style={{width:56,height:56,borderRadius:16,background:T.goldBg,color:T.gold,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-lock" style={{fontSize:26}}/></span>
    <div style={{fontSize:17,fontWeight:700,color:T.text,margin:"16px 0 8px",letterSpacing:"-0.01em"}}>{t("inbox.locked.title")}</div>
    <div style={{fontSize:13.5,color:T.textMuted,lineHeight:1.65,maxWidth:440,margin:"0 auto"}}>{t("inbox.locked.body")}</div>
    {typeof info?.waiting==="number"&&info.waiting>0&&<div style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:16,padding:"8px 14px",borderRadius:999,background:T.warnBg,color:T.warn,fontSize:13,fontWeight:600}}>
      <i className="ti ti-messages" style={{fontSize:15}}/>{since?t("inbox.locked.waitingSince",{n:info.waiting,date:since}):t("inbox.locked.waiting",{n:info.waiting})}
    </div>}
    <div style={{marginTop:20}}>
      <button onClick={onRenew} className="ui-btn" style={{display:"inline-flex",alignItems:"center",gap:8,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600,borderRadius:8,height:42,padding:"0 20px",background:T.accGrad,color:T.onGold,boxShadow:T.accGlow}}>
        <i className="ti ti-arrow-up-circle" style={{fontSize:17}}/>{t("inbox.locked.cta")}
      </button>
    </div>
  </Card>;
}

export default function Conversations({convos:allConvos,refresh,onChatOpen,channels=[],focus=null,businessType="ecommerce",products=[],locked=false,lockInfo=null,onRenew}) {
  const cap=(w)=>String(w||"").charAt(0).toUpperCase()+String(w||"").slice(1);
  const t=useT();
  const productFor=(u)=>{ const s=String(u||"").trim(); if(!s) return null; return products.find(p=>p.image_url===s||(p.images||[]).includes(s)||(p.variants||[]).some(v=>v.image_url===s))||null; };
  // The week's figures for the numbers above the list — the same call the
  // Overview makes, refreshed every minute.
  const [an,setAn]=useState(null);
  useEffect(()=>{
    let live=true;
    const go=()=>api(`/api/analytics?days=7&t=${Date.now()}`,{cache:"no-store"}).then(r=>r.json()).then(d=>{ if(live&&d&&!d.error) setAn(d); }).catch(()=>{});
    go(); const iv=setInterval(go,60000);
    return ()=>{ live=false; clearInterval(iv); };
  },[]);
  const [chFilter,setChFilter]=useState("all");
  const [tagFilter,setTagFilter]=useState("all");
  const [search,setSearch]=useState("");
  // The quick view above the list: everything, only unread chats, or only the
  // chats you have taken over (bot paused for that person).
  const [view,setView]=useState("all");
  const [contacts,setContacts]=useState({});
  // Read state is needed by the quick view below, so it is set up before the list
  // is filtered (it used to be read only further down).
  const convoRead=useConvoRead();
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
  const isManual=(cv)=>contacts[cv.id]?.bot_enabled===false;
  // "Needs you": someone asked for a person, a complaint was tagged, or the
  // customer wrote and this device has not looked yet — the Overview's rule.
  const needsMe=(cv)=>!!contacts[cv.id]?.needs_human||(!!tagData?.complaint_tag&&tagsOf(cv.id).includes(tagData.complaint_tag))||convoRead.isUnread(cv);
  const viewMatch=(cv)=>view==="needs"?needsMe(cv):view==="manual"?isManual(cv):true;
  const convos=allConvos.filter(c=>chMatch(c)&&viewMatch(c)
    &&(tagFilter==="all"||tagsOf(c.id).includes(tagFilter))
    &&(!q||(((contacts[c.id]?.name||c.sender||"")+" "+(c.lastMsg||"")).toLowerCase().includes(q))));
  const PICON={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp"};
  const avail=[...new Set([...channels.map(c=>c.platform),...allConvos.map(c=>c.platform||"facebook")].filter(Boolean))];
  // "2m / 3h / 5d" — enough to scan the list; the full date lives in the chat.
  const ago=(t)=>{ if(!t) return ""; const s=(Date.now()-new Date(t).getTime())/1000;
    if(s<60) return "now"; if(s<3600) return Math.floor(s/60)+"m"; if(s<86400) return Math.floor(s/3600)+"h";
    if(s<604800) return Math.floor(s/86400)+"d"; return new Date(t).toLocaleDateString("en-GB",{day:"numeric",month:"short"}); };
  const isMobile=useIsMobile();
  // A wide screen gets a third column: the customer panel. Below 1280px there is
  // not enough room beside the chat, so it stays two columns as before.
  const [wide,setWide]=useState(false);
  useEffect(()=>{
    const check=()=>setWide(window.innerWidth>=1280);
    check(); window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);
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
  // Read state, Messenger's way: the chat on screen is "seen" up to its newest
  // customer message — on open, and again when a new message lands while it is
  // open. Per device (localStorage), shared with the sidebar badge and the
  // bell's Mark-all through useConvoRead.
  const cLastCustomerAt=(c?.messages||[]).reduce((t,m)=>m.role==="customer"?Math.max(t,new Date(m.time).getTime()):t,0);
  useEffect(()=>{ if(c) markConvoSeen(c); },[c?.id,cLastCustomerAt]); // eslint-disable-line
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  // The picture open full screen: the group it came in, and which one.
  const [viewer,setViewer]=useState(null);
  useBackClose(!!viewer,()=>setViewer(null));
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
  // The inbox list's scroll position, kept across the list being unmounted
  // while a chat is open on a phone (see the list markup below).
  const listScrollRef=useRef(null);
  const listScrollTop=useRef(0);
  const listShown=!isMobile||!hasSel;               // same rule as showList below
  useEffect(()=>{
    if(!listShown) return;
    const el=listScrollRef.current;
    if(el && listScrollTop.current) el.scrollTop=listScrollTop.current;
  },[listShown]); // eslint-disable-line
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

  // Voice messages.
  //
  // Inside the installed app the PHONE records (capacitor-voice-recorder → AAC,
  // a format Messenger, Instagram and WhatsApp all accept). Recording through
  // the WebView's getUserMedia/MediaRecorder was what the owner reported on
  // 2026-09-21: the permission was granted and it still said "access denied" —
  // because one catch covered the permission, the recorder's constructor and
  // start(), so ANY failure read as a permission problem. A browser still uses
  // MediaRecorder, with the first container it really supports, and every
  // failure now says what actually went wrong.
  const nativeRecorder=()=>{ try{ return (window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.Plugins?.VoiceRecorder)||null; }catch{ return null; } };
  const fileFromBase64=(b64,mime)=>{
    const bin=atob(b64); const u8=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    const type=mime||"audio/aac";
    const ext=/aac/.test(type)?"aac":/mp4|m4a/.test(type)?"m4a":/ogg/.test(type)?"ogg":/webm/.test(type)?"webm":"m4a";
    return new File([u8],`voice.${ext}`,{type});
  };
  const micMessage=(e)=>{
    const n=e?.name||"";
    if(n==="NotAllowedError"||n==="SecurityError") return "The microphone is blocked for this site. Allow it in your browser's site settings, then try again.";
    if(n==="NotFoundError"||n==="OverconstrainedError") return "No microphone was found on this device.";
    if(n==="NotReadableError"||n==="AbortError") return "The microphone is being used by another app. Close it and try again.";
    return "Could not use the microphone"+(e?.message?": "+e.message:".");
  };
  const toggleRec=async()=>{
    const VR=nativeRecorder();
    if(recording){
      if(recRef.current?.native){
        try{
          const r=await VR.stopRecording();
          const v=r?.value;
          if(v?.recordDataBase64) sendMedia(fileFromBase64(v.recordDataBase64,v.mimeType),"audio");
        }catch(e){ alert("The recording could not be saved"+(e?.message?": "+e.message:".")); }
        recRef.current=null; setRecording(false);
        return;
      }
      recRef.current?.stop();
      return;
    }
    if(VR){
      try{
        const p=await VR.requestAudioRecordingPermission();
        if(!p?.value){ alert("The microphone is switched off for TellMore AI. Open your phone's Settings → Apps → TellMore AI → Permissions → Microphone, choose Allow, then try again."); return; }
        await VR.startRecording();
        recRef.current={native:true}; setRecording(true);
      }catch(e){ alert("The recording could not start"+(e?.message?": "+e.message:".")); }
      return;
    }
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){ alert("This browser cannot record voice messages."); return; }
    let stream;
    try{ stream=await navigator.mediaDevices.getUserMedia({audio:true}); }
    catch(e){ alert(micMessage(e)); return; }
    try{
      const pick=["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"].find(m=>{ try{ return MediaRecorder.isTypeSupported(m); }catch{ return false; } });
      const rec=pick?new MediaRecorder(stream,{mimeType:pick}):new MediaRecorder(stream);
      const chunks=[];
      rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
      rec.onerror=()=>{ stream.getTracks().forEach(t=>t.stop()); setRecording(false); alert("The recording stopped unexpectedly. Please try again."); };
      rec.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());
        setRecording(false);
        const type=(rec.mimeType||pick||"audio/webm").split(";")[0];
        const ext=/mp4/.test(type)?"mp4":/ogg/.test(type)?"ogg":"webm";
        if(chunks.length) sendMedia(new File(chunks,`voice.${ext}`,{type}),"audio");
      };
      recRef.current=rec;
      rec.start();
      setRecording(true);
    }catch(e){
      stream.getTracks().forEach(t=>t.stop());
      alert("This browser could not start a voice recording"+(e?.message?": "+e.message:"."));
    }
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
    // Fill to the bottom of the tab's scroll box ("ui-scroll" in the shell),
    // not the window: a phone has a bar along the bottom of the screen.
    const measure=()=>{ const el=listRef.current; if(!el) return; const r=el.getBoundingClientRect();
      const sc=el.closest(".ui-scroll"); const bottom=sc?sc.getBoundingClientRect().bottom:window.innerHeight;
      setFitH(Math.max(280,Math.round(bottom-r.top-8))); };
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

  // A lapsed plan locks the inbox (src/lib/inbox-lock.js): the server no longer
  // lists or opens chats, so there is nothing to draw but why, and the way out.
  if(locked) return <InboxLocked info={lockInfo} onRenew={onRenew} t={t}/>;
  const filtered = chFilter!=="all"||tagFilter!=="all"||view!=="all"||!!q;
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

  const needsN=allConvos.filter(needsMe).length;
  const manualN=allConvos.filter(isManual).length;
  return <div ref={listRef} style={{display:"flex",flexDirection:"column",gap:isMobile?10:14,height:isMobile?(hasSel?"100%":(fitH?fitH+"px":"calc(100dvh - 190px)")):"calc(100vh - 150px)"}}>
    {(!isMobile||!hasSel)&&<InboxStats convos={allConvos} an={an} isAgency={businessType==="agency"} isMobile={isMobile} t={t}/>}
    <div style={{flex:1,minHeight:0,display:isMobile?"block":"grid",gridTemplateColumns:wide?"320px minmax(0,1fr) 300px":"320px minmax(0,1fr)",gap:16}}>
    {/* On a phone the list is unmounted while a chat is open, so it used to
        come back scrolled to the top — leaving a chat deep in the inbox
        dropped you at the newest conversation. The list scrolls inside its
        own div (not the Card), its position is remembered on every scroll
        and put back the moment the list is shown again. */}
    {showList&&<Card style={{overflow:"hidden",padding:0,height:"100%"}}>
      <div ref={listScrollRef} onScroll={e=>{listScrollTop.current=e.currentTarget.scrollTop;}} style={{overflow:"auto",height:"100%"}}>
      <div style={{padding:"12px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:14,fontWeight:600,color:T.text}}>{t("inbox.title")}</span>
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
      <div style={{padding:"10px 12px 0"}}>
        <Segmented size="sm" value={view} onChange={setView}
          items={[{value:"all",label:t("inbox.all"),badge:allConvos.length||null},{value:"needs",label:t("inbox.needs"),badge:needsN||null},{value:"manual",label:t("inbox.manual"),badge:manualN||null}]}/>
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
          <button onClick={()=>{setChFilter("all");setTagFilter("all");setSearch("");setView("all");}} className="ui-btn"
            style={{padding:"9px 16px",borderRadius:9,border:`1px solid ${T.border}`,background:T.card,
              color:T.text,fontSize:13.5,fontWeight:600,cursor:"pointer"}}>Clear filters</button>}
      </div>}
      {convos.map((cv,i)=>{
        const cvt=contacts[cv.id]||{};
        const multi=(perPlatform[cv.platform]||[]).length>1;
        const on=String(selId)===String(cv.id);
        // Messenger's rule: a chat with a customer message this device has not
        // looked at yet is bold, with a dot. Opening it — or "Mark all as
        // read" in the bell — makes it normal; the next customer message
        // makes it bold again. A bot reply does not make it read. The sidebar
        // Inbox badge counts the same set, so number and bold rows agree.
        const waiting=convoRead.isUnread(cv);
        const manual=ctLoaded&&cvt.bot_enabled===false;
        // The avatar carries the channel as a coloured dot, the way the deck
        // draws it; a chat you have taken over says so with an amber chip.
        return <div key={cv.id} onClick={()=>setSelId(cv.id)} title={waiting?"Unread":undefined} style={{padding:"12px 14px 12px 12px",cursor:"pointer",borderBottom:`0.5px solid ${T.border}`,background:on?T.goldBg:"transparent",borderLeft:on?`3px solid ${T.gold}`:"3px solid transparent",display:"flex",gap:11,alignItems:"flex-start"}}>
          <span aria-hidden style={{position:"relative",width:38,height:38,borderRadius:"50%",background:on?T.card:T.goldBg,color:T.gold,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12.5,fontWeight:700,flexShrink:0,marginTop:1}}>
            {initialsOf(cvt.name||cv.sender)}
            <span title={cap(cv.platform)} style={{position:"absolute",right:-1,bottom:-1,width:11,height:11,borderRadius:"50%",background:PCOLOR[cv.platform]||T.textDim,border:`2px solid ${T.card}`}}/>
          </span>
          <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
            <span style={{fontSize:13.5,fontWeight:waiting?700:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{cvt.name||cv.sender}</span>
            <span style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              <span style={{fontSize:11,color:waiting?T.text:T.textDim,fontWeight:waiting?600:400}}>{ago(cv.time)}</span>
              {waiting&&<span aria-label="Unread" style={{width:8,height:8,borderRadius:"50%",background:T.gold,flexShrink:0,display:"inline-block"}}/>}
            </span>
          </div>
          <span style={{fontSize:12.5,color:waiting?T.text:T.textMuted,fontWeight:waiting?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block",marginTop:2}}>{cv.lastMsg}</span>
          {manual||(multi&&cv.page_id)||tagsOf(cv.id).length?<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6,alignItems:"center"}}>
            {manual&&<span style={{fontSize:10.5,padding:"2px 8px",borderRadius:10,background:T.warnBg,color:T.warn,fontWeight:600}}>{t("inbox.manual")}</span>}
            {multi&&cv.page_id&&<span style={{fontSize:10.5,padding:"2px 8px",borderRadius:10,background:T.bgAlt,color:T.textDim,border:`0.5px solid ${T.border}`,display:"inline-flex",alignItems:"center",gap:4}}><i className="ti ti-arrow-narrow-right" style={{fontSize:11}}/>{acctName(cv.platform,cv.page_id)}</span>}
            {tagsOf(cv.id).map(tg=><span key={tg} style={{fontSize:10.5,padding:"2px 8px",borderRadius:10,background:tg===tagData?.complaint_tag?T.dangerBg:T.bgAlt,color:tg===tagData?.complaint_tag?T.danger:T.textMuted,border:`0.5px solid ${tg===tagData?.complaint_tag?T.danger+"40":T.border}`}}>{tg}</span>)}
          </div>:null}
          </div>
        </div>;
      })}
      </div>
    </Card>}
    {/* The chat column measures itself (a container query below), so the
        "Bot replying" pill gives way to the customer's name when the column
        is narrow — a small laptop with all three columns open. */}
    {showChat&&<Card style={{display:"flex",flexDirection:"column",padding:0,overflow:"hidden",height:"100%",containerType:"inline-size"}}>
      <style dangerouslySetInnerHTML={{__html:`@container (max-width: 560px) { .inbox-pill { display: none !important } }`}}/>
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
          <div aria-hidden style={{position:"relative",width:36,height:36,borderRadius:"50%",background:T.goldBg,color:T.gold,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:12.5,fontWeight:700,flexShrink:0}}>
            {initialsOf(cname||"C")}
            <span style={{position:"absolute",right:-1,bottom:-1,width:11,height:11,borderRadius:"50%",background:PCOLOR[c.platform]||T.textDim,border:`2px solid ${T.card}`}}/>
          </div>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:15,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cname||"Customer"}</div>
            <div style={{fontSize:11.5,color:T.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {[cap(c.platform),
                c.platform==="whatsapp"&&/^\d{6,}$/.test(String(c.id))?maskPhone(c.id)
                :((perPlatform[c.platform]||[]).length>1&&c.page_id?acctName(c.platform,c.page_id):null)].filter(Boolean).join(" · ")}
            </div>
          </div>
          {/* Who is answering this person, and the one button that changes it.
              "Take over" pauses the bot for this chat only; "Hand back to bot"
              resumes it. The pill is dropped on a phone to keep the name row. */}
          {!ctLoaded
            ?<span style={{fontSize:11,color:T.textDim,flexShrink:0}}><i className="ti ti-loader-2" style={{marginRight:5}}/>Loading…</span>
            :<>
              {!isMobile&&<span className="inbox-pill" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:999,background:ct.bot_enabled===false?T.warnBg:T.liveBg,color:ct.bot_enabled===false?T.warn:T.live,fontSize:12,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>
                <span className={ct.bot_enabled===false?"":"ui-live"} style={{width:7,height:7,borderRadius:"50%",background:"currentColor",display:"inline-block"}}/>
                {ct.bot_enabled===false?t("inbox.youReplying"):t("inbox.botReplying")}
              </span>}
              <button onClick={()=>toggle(c.id,ct.bot_enabled===false,false)} className="ui-btn"
                style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${T.borderStrong}`,background:T.card,color:T.text,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>
                {ct.bot_enabled===false?t("inbox.handBack"):t("inbox.takeOver")}
              </button>
            </>}
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
        {groupThread(shownMsgs,productFor).map((g,i,all)=>{
          const m=g.m;
          const mine=m.role!=="customer";
          const prev=i?all[i-1].m:null;
          const dayOf=(x)=>{ const d=new Date(x); return d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate(); };
          const newDay=!prev||dayOf(prev.time)!==dayOf(m.time);
          // The bot's first bubble after a customer's message says how fast it came.
          const secs=m.role==="bot"&&prev&&prev.role==="customer"?Math.round((new Date(m.time)-new Date(prev.time))/1000):null;
          const atts=m.attachments||[];
          const text=g.text;
          return <div key={i}>
          {newDay&&<div style={{textAlign:"center",fontSize:11,color:T.textDim,margin:"2px 0 8px"}}>{dayLabel(m.time,t)}</div>}
          <div style={{display:"flex",justifyContent:mine?"flex-end":"flex-start"}}>
          <div style={{maxWidth:g.imgs.length>1?"86%":"70%"}}>
            {(g.cards.length>0||g.imgs.length>0)&&<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:4,alignItems:mine?"flex-end":"flex-start"}}>
              {g.cards.map((p,j)=><ProductCard key={"c"+j} p={p} t={t} onLoad={onImgLoad}/>)}
              {g.imgs.length>0&&<ImageGroup urls={g.imgs} mine={mine} onLoad={onImgLoad} onOpen={(k)=>setViewer({urls:g.imgs,index:k})}/>}
            </div>}
            {(!atts.length||text)&&<div style={{padding:"9px 14px",borderRadius:18,fontSize:13.5,lineHeight:1.45,whiteSpace:"pre-wrap",color:mine?T.onGold:T.text,background:mine?T.accGrad:T.bgAlt,borderBottomRightRadius:mine?6:18,borderBottomLeftRadius:mine?18:6}}>{text}</div>}
            {mine&&m.role==="agent"&&<div style={{fontSize:10,color:T.textDim,marginTop:2,textAlign:"right"}}>You</div>}
            {m.role==="bot"&&secs!=null&&secs>=0&&secs<=600&&<div style={{fontSize:10,color:T.textDim,marginTop:2,textAlign:"right"}}>TellMore AI · {t("inbox.answeredIn",{s:secs})}</div>}
          </div>
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
            style={{width:36,height:36,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",color:T.gold,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><i className="ti ti-camera"/></button>
          <button onClick={()=>galleryRef.current?.click()} title="Photo" aria-label="Photo" className="ui-sq"
            style={{width:36,height:36,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",color:T.gold,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><i className="ti ti-photo"/></button>
          <button onClick={toggleRec} title="Voice" aria-label="Voice" className="ui-sq"
            style={{width:36,height:36,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",color:recording?T.danger:T.gold,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,animation:recording?"pulse 1s infinite":"none"}}><i className={`ti ${recording?"ti-player-stop-filled":"ti-microphone"}`}/></button>
          <div style={{flex:1,display:"flex",alignItems:"center",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:10,padding:"0 4px 0 12px",minWidth:0}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={t("inbox.placeholder")} style={{flex:1,background:"none",border:"none",padding:"10px 0",color:T.text,fontSize:13,outline:"none",minWidth:0}}/>
            <button onClick={()=>setShowEmoji(s=>!s)} title="Emoji" aria-label="Emoji" className="ui-sq"
              style={{width:30,height:30,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>😊</button>
          </div>
          <button onClick={send} disabled={sending} aria-label="Send" className="ui-sq"
            style={{width:38,height:38,borderRadius:10,border:"none",cursor:"pointer",background:T.accGrad,display:"flex",alignItems:"center",justifyContent:"center",opacity:sending?.6:1,flexShrink:0}}><i className="ti ti-send" style={{fontSize:16,color:T.onGold}}/></button>
        </div>
      </div>
    </Card>}
    {showChat&&wide&&<CustomerPanel c={c} name={cname} ct={ct} ctLoaded={ctLoaded} msgs={shownMsgs}
      channel={cap(c.platform)+((perPlatform[c.platform]||[]).length>1&&c.page_id?` · ${acctName(c.platform,c.page_id)}`:"")}
      icon={PICON[c.platform]||CH_ICON[c.platform]||"ti-message"} tags={tagsOf(c.id)} complaintTag={tagData?.complaint_tag}
      businessType={businessType}/>}
    </div>
    {viewer&&<ImageViewer urls={viewer.urls} index={viewer.index} onIndex={(k)=>setViewer(v=>v?{...v,index:k}:v)} onClose={()=>setViewer(null)}/>}
  </div>;
}

// The third column on a wide screen: who this customer is and what they have
// done with the business, so the owner does not have to leave the chat to find
// out. Everything here is read from data the business already has — nothing is
// guessed or generated. Orders for a shop, bookings for an agency.
function CustomerPanel({c,name,ct,ctLoaded,msgs,channel,icon,tags,complaintTag,businessType}){
  const isAgency=businessType==="agency";
  const [rows,setRows]=useState(null);      // null = loading
  const [err,setErr]=useState(false);
  const [tick,setTick]=useState(0);
  useEffect(()=>{
    if(!c?.id) return;
    let cancelled=false;
    setRows(null); setErr(false);
    api(`/api/${isAgency?"bookings":"orders"}?sender_id=${encodeURIComponent(c.id)}`)
      .then(r=>r.ok?r.json():Promise.reject())
      .then(d=>{ if(!cancelled) setRows(Array.isArray(d)?d:[]); })
      .catch(()=>{ if(!cancelled) setErr(true); });
    return ()=>{ cancelled=true; };
  },[c?.id,isAgency,tick]);

  const times=(msgs||[]).map(m=>new Date(m.time).getTime()).filter(Number.isFinite);
  const firstAt=times.length?Math.min(...times):null;
  const fromCustomer=(msgs||[]).filter(m=>m.role==="customer").length;
  const botOn=ct?.bot_enabled!==false;
  const lbl={fontSize:11.5,fontWeight:600,color:T.textMuted,margin:"0 0 8px"};
  const stat=(k,v)=><div style={{padding:"10px 11px",borderRadius:8,background:T.inset,minWidth:0}}>
    <div style={{fontSize:11.5,color:T.textMuted}}>{k}</div>
    <div style={{fontSize:15,fontWeight:600,color:T.text,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
  </div>;

  let business=null;
  if(err) business=<div style={{fontSize:12.5,color:T.textMuted,lineHeight:1.5}}>
      Could not load {isAgency?"bookings":"orders"}.{" "}
      <button onClick={()=>setTick(t=>t+1)} style={{background:"none",border:"none",padding:0,color:T.gold,fontWeight:600,cursor:"pointer",fontSize:12.5}}>Try again</button>
    </div>;
  else if(rows===null) business=<div style={{fontSize:12.5,color:T.textDim}}><i className="ti ti-loader-2" style={{marginRight:6}}/>Loading…</div>;
  else if(!rows.length) business=<div style={{fontSize:12.5,color:T.textMuted}}>{isAgency?"No bookings yet from this customer.":"No orders yet from this customer."}</div>;
  else if(isAgency){
    const now=Date.now();
    const next=rows.filter(b=>b.status!=="Cancelled"&&b.meeting_datetime&&new Date(b.meeting_datetime).getTime()>now)
      .sort((a,b)=>new Date(a.meeting_datetime)-new Date(b.meeting_datetime))[0];
    const last=rows[0];
    business=<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
        {stat("Bookings",rows.length)}
        {stat("Last status",last.status||"—")}
      </div>
      {next&&<div style={{marginTop:10,padding:"10px 11px",borderRadius:8,border:`1px solid ${T.border}`}}>
        <div style={{fontSize:11.5,color:T.textMuted}}>Next meeting</div>
        <div style={{fontSize:13,fontWeight:600,color:T.text,marginTop:3}}>
          {new Date(next.meeting_datetime).toLocaleString("en-GB",{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}
        </div>
        {next.service_want&&<div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{next.service_want}</div>}
        {next.meeting_link&&<a href={next.meeting_link} target="_blank" rel="noopener noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:6,fontSize:12.5,fontWeight:600,color:T.gold,textDecoration:"none"}}>
          <i className="ti ti-video"/>Open Meet link</a>}
      </div>}
    </>;
  } else {
    const kept=rows.filter(o=>o.status!=="Cancelled"&&o.status!=="Returned");
    const spent=kept.reduce((s,o)=>s+(Number(o.total)||0),0);
    const last=rows[0];
    business=<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
        {stat("Orders",rows.length)}
        {stat("Spent",taka(spent))}
      </div>
      <div style={{marginTop:10,padding:"10px 11px",borderRadius:8,border:`1px solid ${T.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:11.5,color:T.textMuted}}>
          <span>Last order{last.order_code?` · ${last.order_code}`:""}</span><span>{shortDate(last.created_at)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:4,fontSize:13}}>
          <span style={{fontWeight:600,color:T.text}}>{last.status||"Pending"}</span>
          <span style={{fontWeight:600,color:T.text}}>{taka(last.total)}</span>
        </div>
      </div>
    </>;
  }

  return <Card style={{padding:16,height:"100%",overflow:"auto",display:"flex",flexDirection:"column",gap:18}}>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",gap:6,paddingTop:4}}>
      <div aria-hidden style={{width:52,height:52,borderRadius:"50%",background:T.goldBg,color:T.gold,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700}}>
        {initialsOf(name||"C")}
      </div>
      <div style={{fontSize:15,fontWeight:600,color:T.text,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name||"Customer"}</div>
      <div style={{fontSize:12,color:T.textMuted,display:"flex",alignItems:"center",gap:5}}><i className={`ti ${icon}`} style={{fontSize:13}}/>{channel}</div>
      {ctLoaded&&<Badge color={botOn?T.success:T.warn}>{botOn?"Bot is answering":"You are answering"}</Badge>}
    </div>
    <div>
      <div style={lbl}>Conversation</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
        {stat("First message",firstAt?shortDate(firstAt):"—")}
        {stat("Their messages",fromCustomer)}
      </div>
    </div>
    <div>
      <div style={lbl}>{isAgency?"Bookings":"Orders"}</div>
      {business}
    </div>
    {!!tags?.length&&<div>
      <div style={lbl}>Tags</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {tags.map(t=><span key={t} style={{fontSize:11.5,padding:"3px 9px",borderRadius:8,fontWeight:600,
          background:t===complaintTag?T.dangerBg:T.inset,color:t===complaintTag?T.danger:T.textMuted}}>{t}</span>)}
      </div>
    </div>}
  </Card>;
}
