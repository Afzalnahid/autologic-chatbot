"use client";
import { useState, useEffect, useRef } from "react";
import { T } from "./ui.js";
import { api } from "./session.js";

// The Demo tab, moved out of dashboard-client.js unchanged.

export default function Demo({onBack}) {
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [showEmoji,setShowEmoji]=useState(false);
  const [img,setImg]=useState(null); // {dataUrl, base64, mime}
  const [rec,setRec]=useState(false);
  const recRef=useRef(null);
  const chunksRef=useRef([]);
  const ref=useRef(null);
  const fileRef=useRef(null);
  const EMOJIS=["😀","😂","❤️","👍","🙏","😍","🔥","🎉","😢","😮","💯","✅"];
  const DEMO_NAME="Autologic Demo Bot";
  const DEMO_GREETING="Hi! I'm the Autologic Demo Bot 🤖 — your product expert. Ask me anything about Autologic: features, pricing, setup guide, how the AI answers customers, Google Calendar booking, or anything else. You can also send an image or a voice message to try those features!";
  const clearChat=()=>setMsgs([{role:"bot",text:DEMO_GREETING}]);
  useEffect(()=>{clearChat();},[]);
  const scrollDown=()=>setTimeout(()=>ref.current?.scrollTo({top:ref.current.scrollHeight,behavior:"smooth"}),80);

  const callApi=async(payload,userBubble)=>{
    setMsgs(p=>[...p,userBubble]); setLoading(true); scrollDown();
    try {
      const history=msgs.filter((_,i)=>i>0).map(m=>({role:m.role==="bot"?"assistant":"user",content:m.text||""}));
      const res=await api("/api/demo-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...history,{role:"user",content:payload.text||""}],...payload.extra})});
      const data=await res.json();
      if(data.transcript){ setMsgs(p=>p.map((m,i)=>i===p.length-1&&m.voice?{...m,text:data.transcript}:m)); }
      setMsgs(p=>[...p,{role:"bot",text:data.reply||"Error"}]);
    } catch { setMsgs(p=>[...p,{role:"bot",text:"Connection error."}]); }
    setLoading(false); scrollDown();
  };

  const send=async()=>{
    if(loading) return;
    const text=input.trim();
    if(!text&&!img) return;
    setInput(""); setShowEmoji(false);
    const extra=img?{imageBase64:img.base64,imageMime:img.mime}:{};
    const bubble={role:"user",text,image:img?.dataUrl};
    setImg(null);
    await callApi({text,extra},bubble);
  };

  const pickImage=(e)=>{
    const file=e.target.files?.[0]; e.target.value="";
    if(!file) return;
    if(file.size>4*1024*1024){alert("Image too large (max 4MB)");return;}
    const r=new FileReader();
    r.onload=()=>{const dataUrl=r.result;setImg({dataUrl,base64:dataUrl.split(",")[1],mime:file.type||"image/jpeg"});};
    r.readAsDataURL(file);
  };

  const toggleRec=async()=>{
    if(rec){ recRef.current?.stop(); return; }
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);
      chunksRef.current=[];
      mr.ondataavailable=e=>chunksRef.current.push(e.data);
      mr.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop()); setRec(false);
        const blob=new Blob(chunksRef.current,{type:mr.mimeType||"audio/webm"});
        if(blob.size<1000) return;
        const r=new FileReader();
        r.onload=async()=>{
          const b64=r.result.split(",")[1];
          await callApi({text:"",extra:{audioBase64:b64,audioMime:blob.type}},{role:"user",voice:true,text:"🎤 Voice message..."});
        };
        r.readAsDataURL(blob);
      };
      mr.start(); recRef.current=mr; setRec(true);
    } catch { alert("Microphone access denied"); }
  };

  return <div style={{position:"fixed",inset:0,zIndex:70,background:T.bg,display:"flex",flexDirection:"column",height:"100dvh"}}>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`0.5px solid ${T.border}`,background:T.card,flexShrink:0}}>
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:T.text,fontSize:20,padding:6}}><i className="ti ti-arrow-left"/></button>
      <div style={{width:38,height:38,borderRadius:11,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid color-mix(in srgb, ${T.gold} 19%, transparent)`,flexShrink:0}}><i className="ti ti-robot" style={{fontSize:20,color:T.gold}}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{DEMO_NAME}</div>
        <div style={{fontSize:11,color:T.success,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:T.success,display:"inline-block"}}/>Product expert · online</div>
      </div>
      <button onClick={clearChat} title="Clear chat" style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:17,padding:6}}><i className="ti ti-refresh"/></button>
    </div>

    {/* Messages */}
    <div ref={ref} style={{flex:1,overflowY:"auto",padding:"14px 12px",display:"flex",flexDirection:"column",gap:10,WebkitOverflowScrolling:"touch"}}>
      {msgs.map((m,i)=><div key={i} style={{display:"flex",justifyContent:m.role==="bot"?"flex-start":"flex-end"}}>
        <div style={{maxWidth:"82%",borderRadius:14,fontSize:13.5,lineHeight:1.65,whiteSpace:"pre-wrap",background:m.role==="bot"?T.bgAlt:T.gold,color:m.role==="bot"?T.text:"#0a0a0a",borderBottomLeftRadius:m.role==="bot"?3:14,borderBottomRightRadius:m.role==="bot"?14:3,overflow:"hidden"}}>
          {m.image&&<img src={m.image} alt="" style={{display:"block",maxWidth:"100%",maxHeight:220,objectFit:"cover"}}/>}
          {(m.text||m.voice)&&<div style={{padding:"10px 14px"}}>{m.voice&&<i className="ti ti-microphone" style={{marginRight:6,fontSize:13}}/>}{m.text}</div>}
        </div>
      </div>)}
      {loading&&<div style={{display:"flex",gap:4,padding:"10px 14px",background:T.bgAlt,borderRadius:14,width:"fit-content",borderBottomLeftRadius:3}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.textDim,animation:`dotPulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>}
    </div>

    {/* Composer */}
    <div style={{borderTop:`0.5px solid ${T.border}`,background:T.card,flexShrink:0,position:"relative",paddingBottom:"env(safe-area-inset-bottom)"}}>
      {showEmoji&&<div style={{position:"absolute",bottom:"100%",right:12,background:T.card,border:`0.5px solid ${T.border}`,borderRadius:12,padding:8,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,zIndex:5}}>
        {EMOJIS.map(e=><span key={e} onClick={()=>{setInput(p=>p+e);setShowEmoji(false);}} style={{fontSize:20,cursor:"pointer",padding:4}}>{e}</span>)}
      </div>}
      {img&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px 0"}}>
        <img src={img.dataUrl} alt="" style={{width:46,height:46,borderRadius:8,objectFit:"cover",border:`1px solid ${T.border}`}}/>
        <span style={{fontSize:12,color:T.textMuted,flex:1}}>Image attached</span>
        <button onClick={()=>setImg(null)} style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:16}}><i className="ti ti-x"/></button>
      </div>}
      {rec&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px 0",color:T.danger,fontSize:12.5}}><span style={{width:8,height:8,borderRadius:"50%",background:T.danger,animation:"pulse 1s infinite"}}/>Recording... tap mic to stop & send</div>}
      <div style={{padding:"10px 8px",display:"flex",gap:4,alignItems:"center"}}>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{display:"none"}}/>
        <button onClick={()=>fileRef.current?.click()} title="Send image" style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:19,padding:6,flexShrink:0}}><i className="ti ti-photo"/></button>
        <button onClick={toggleRec} title={rec?"Stop & send":"Voice message"} style={{background:rec?T.danger:"none",border:"none",cursor:"pointer",color:rec?"#fff":T.textMuted,fontSize:19,padding:6,borderRadius:"50%",flexShrink:0,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`ti ${rec?"ti-player-stop":"ti-microphone"}`}/></button>
        <div style={{flex:1,display:"flex",alignItems:"center",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:20,padding:"0 4px 0 12px",minWidth:0}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} onFocus={scrollDown} placeholder="Ask about Autologic..." style={{flex:1,background:"none",border:"none",padding:"11px 0",color:T.text,fontSize:14,outline:"none",minWidth:0}}/>
          <button onClick={()=>setShowEmoji(x=>!x)} title="Emoji" style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"4px 2px",flexShrink:0}}>😊</button>
        </div>
        <button onClick={send} disabled={loading} style={{width:38,height:38,borderRadius:"50%",border:"none",cursor:"pointer",background:T.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:loading?0.6:1}}><i className="ti ti-send" style={{fontSize:16,color:"#0a0a0a"}}/></button>
      </div>
    </div>
  </div>;
}
