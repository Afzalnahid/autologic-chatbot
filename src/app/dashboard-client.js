"use client";
import { createClient as createSb } from "@/utils/supabase/client";
import { useState, useEffect, useRef } from "react";

let _sbi=null;
let AUTH_TOKEN="";
let _sessionPromise=null;
function getSb(){ if(!_sbi) _sbi=createSb(); return _sbi; }

function getSessionOnce(){
  if(!_sessionPromise){
    _sessionPromise=getSb().auth.getSession().finally(()=>{ _sessionPromise=null; });
  }
  return _sessionPromise;
}

async function api(url,opts={}){
  try{
    const {data:{session}}=await getSessionOnce();
    if(session) AUTH_TOKEN=session.access_token;
  }catch{}
  let res=await fetch(url,{...opts,cache:"no-store",headers:{...(opts.headers||{}),"Cache-Control":"no-cache","Authorization":"Bearer "+AUTH_TOKEN}});
  if(res.status===401){
    try{
      const {data:{session}}=await getSb().auth.refreshSession();
      if(session){
        AUTH_TOKEN=session.access_token;
        res=await fetch(url,{...opts,cache:"no-store",headers:{...(opts.headers||{}),"Cache-Control":"no-cache","Authorization":"Bearer "+AUTH_TOKEN}});
      }
    }catch{}
  }
  return res;
}

const T = {
  bg: "#05080f", bgAlt: "#080e1a", card: "#0d1529",
  gold: "#f0c040", goldDim: "#c4982e", goldBg: "rgba(240,192,64,0.08)",
  text: "#e8e8ec", textMuted: "#7a8db0", textDim: "#4a5a7a",
  border: "#1a2744", danger: "#ef4444", success: "#22c55e", info: "#3b82f6", warn: "#f59e0b", purple: "#8b5cf6",
};
const PAGES = ["analytics","conversations","inventory","orders","channels","settings","profile","demo"];
const ICONS = ["ti-chart-bar","ti-messages","ti-package","ti-shopping-cart","ti-plug","ti-settings","ti-user","ti-robot"];
const LABELS = ["Analytics","Conversations","Inventory","Orders","Channels","Settings","Profile","Demo"];
const ITEM_WORDS = { ecommerce:{item:"Product",inv:"Inventory",order:"Orders"}, agency:{item:"Service",inv:"Services",order:"Inquiries"}, restaurant:{item:"Menu item",inv:"Menu",order:"Orders"}, education:{item:"Course",inv:"Courses",order:"Enrollments"}, realestate:{item:"Listing",inv:"Listings",order:"Inquiries"}, other:{item:"Item",inv:"Catalog",order:"Requests"} };
function words(bt){ return ITEM_WORDS[bt] || ITEM_WORDS.other; }

function useIsMobile(){
  const [m,setM]=useState(false);
  useEffect(()=>{
    const check=()=>setM(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);
  return m;
}

function Btn({children,gold,danger,small,style,...p}){ return <button {...p} style={{padding:small?"6px 14px":"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:small?12:13,fontWeight:500,background:danger?T.danger:gold?T.gold:"rgba(240,192,64,0.12)",color:danger?"#fff":gold?"#0a0a0a":T.gold,...style}}>{children}</button>; }
function Badge({children,color=T.gold}){ return <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,background:`${color}18`,color}}>{children}</span>; }
function Card({children,style,...p}){ return <div {...p} style={{background:T.card,borderRadius:12,border:`0.5px solid ${T.border}`,padding:"1.25rem",...style}}>{children}</div>; }
function Inp({label,textarea,style,...p}){ return <div style={{marginBottom:16,...style}}>{label&&<label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{label}</label>}{textarea?<textarea {...p} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,resize:"vertical",minHeight:100,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>:<input {...p} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>}</div>; }
function StatCard({icon,label,value,sub,color=T.gold}){ return <Card style={{flex:1,minWidth:140}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:36,height:36,borderRadius:10,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`ti ${icon}`} style={{fontSize:18,color}}/></div><span style={{fontSize:12,color:T.textMuted,textTransform:"uppercase",letterSpacing:.8}}>{label}</span></div><div style={{fontSize:28,fontWeight:600,color:T.text}}>{value}</div>{sub&&<div style={{fontSize:12,color:T.textMuted,marginTop:4}}>{sub}</div>}</Card>; }

function Analytics({products,convos,orders,msgCount}) {
  const active = convos.filter(c=>c.status==="active").length;
  const pending = orders.filter(o=>o.status==="Pending").length;
  const cats = {};
  products.forEach(p=>{const c=p.category||p.metadata?.category||"Other";cats[c]=(cats[c]||0)+1;});
  const sorted = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxC = sorted[0]?.[1]||1;
  return <div>
    <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:24}}>
      <StatCard icon="ti-messages" label="Messages" value={msgCount} sub="From message buffer" color={T.info}/>
      <StatCard icon="ti-users" label="Active Chats" value={active} sub={`${convos.length} total`} color={T.success}/>
      <StatCard icon="ti-package" label="Products" value={products.length} sub="In Supabase" color={T.purple}/>
      <StatCard icon="ti-shopping-cart" label="Pending" value={pending} sub={`${orders.length} total orders`} color={T.gold}/>
    </div>
    <Card><div style={{fontSize:14,fontWeight:500,marginBottom:16}}>Product categories</div>
      {sorted.map(([n,c],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
        <span style={{fontSize:12,color:T.textMuted,width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n}</span>
        <div style={{flex:1,height:6,background:T.bgAlt,borderRadius:3}}><div style={{height:"100%",width:`${(c/maxC)*100}%`,background:T.gold,borderRadius:3}}/></div>
        <span style={{fontSize:12,fontWeight:500,width:24,textAlign:"right"}}>{c}</span>
      </div>)}
    </Card>
  </div>;
}

function Conversations({convos:allConvos,refresh,onChatOpen}) {
  const [chFilter,setChFilter]=useState("all");
  const convos=chFilter==="all"?allConvos:allConvos.filter(c=>(c.platform||"facebook")===chFilter);
  const PICON={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp"};
  const avail=[...new Set(allConvos.map(c=>c.platform||"facebook"))];
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
    const t=setInterval(()=>{refresh&&refresh(true);loadContacts();},15000);
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
      {avail.length>1&&<div style={{display:"flex",gap:6,padding:"0 4px 10px"}}>
        {["all",...avail].map(f=><div key={f} onClick={()=>{setChFilter(f);}} style={{padding:"5px 12px",borderRadius:14,fontSize:11.5,cursor:"pointer",textTransform:"capitalize",background:chFilter===f?T.goldBg:T.bgAlt,color:chFilter===f?T.gold:T.textMuted,border:`0.5px solid ${chFilter===f?T.gold+"50":T.border}`}}>{f}</div>)}
      </div>}
      {convos.map((cv,i)=>{
        const cvt=contacts[cv.id]||{};
        return <div key={cv.id} onClick={()=>setSel(i)} style={{padding:"14px 16px",cursor:"pointer",borderBottom:`0.5px solid ${T.border}`,background:sel===i?T.goldBg:"transparent",borderLeft:sel===i?`3px solid ${T.gold}`:"3px solid transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:500}}>{cvt.name||cv.sender}</span>
            <Badge color={cvt.bot_enabled===false?T.warn:T.success}>{cvt.bot_enabled===false?"manual":"bot"}</Badge>
          </div>
          <span style={{fontSize:12,color:T.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{cv.lastMsg}</span>
        </div>;
      })}
    </Card>}
    {showChat&&<Card style={{display:"flex",flexDirection:"column",padding:0,overflow:"hidden",height:"100%"}}>
      <div style={{padding:"14px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          {isMobile&&<button onClick={()=>setSel(-1)} style={{background:"none",border:"none",cursor:"pointer",color:T.gold,fontSize:20,padding:0,flexShrink:0}}><i className="ti ti-chevron-left"/></button>}
          <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cname}</div><div style={{fontSize:12,color:T.textMuted,display:"flex",alignItems:"center",gap:4}}><i className={`ti ${PICON[c.platform]||"ti-message"}`} style={{fontSize:13}}/>{c.platform}</div></div>
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

function Inventory({products,refresh}) {
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [imgFile,setImgFile]=useState(null);
  const addFileRef=useRef(null);
  const add=async()=>{
    if(!np.product_name||adding) return;
    setAdding(true);
    const fd=new FormData();
    fd.append("product_code",np.product_id||"");
    fd.append("product_name",np.product_name);
    fd.append("category",np.category||"");
    fd.append("regular_price",np.regular_price||"");
    fd.append("sale_price",np.sale_price||"");
    fd.append("description",np.description||"");
    if(imgFile) fd.append("image",imgFile);
    else if(np.image_url) fd.append("image_url",np.image_url);
    const r=await api("/api/add-product",{method:"POST",body:fd}).then(r=>r.json()).catch(()=>({error:"network"}));
    setAdding(false);
    if(r.error){setUrlMsg("Failed: "+r.error);return;}
    setNp({product_id:"",product_name:"",category:"",regular_price:"",sale_price:"",image_url:"",description:""});
    setImgFile(null); if(addFileRef.current) addFileRef.current.value="";
    setUrlMsg(r.analyzed?"Product added and image analyzed":r.image_url?("Product added but image analysis failed"+(r.analyzeError?": "+r.analyzeError:"")):"Product added");
    refresh();
  };
  const [urlInput,setUrlInput]=useState("");
  const [urlBusy,setUrlBusy]=useState(false);
  const [urlMsg,setUrlMsg]=useState("");
  const scrapeUrl=async()=>{
    if(!urlInput||urlBusy) return;
    setUrlBusy(true); setUrlMsg("Scraping product, please wait...");
    const r=await api("/api/import-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:urlInput})}).then(r=>r.json()).catch(()=>({error:"network"}));
    setUrlBusy(false);
    if(r.error){setUrlMsg("Failed: "+r.error);return;}
    setUrlMsg(`Added: ${r.name}`); setUrlInput(""); refresh();
  };
  const [showImport,setShowImport]=useState(false);
  const [imp,setImp]=useState({siteUrl:"",ck:"",cs:""});
  const [importing,setImporting]=useState(false);
  const [impMsg,setImpMsg]=useState("");
  const runImport=async()=>{
    if(!imp.siteUrl||!imp.ck||!imp.cs||importing) return;
    setImporting(true); setImpMsg("Fetching product list...");
    const r=await api("/api/import-products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(imp)}).then(r=>r.json()).catch(()=>({error:"network"}));
    if(r.error){setImpMsg("Failed: "+r.error);setImporting(false);return;}
    const list=r.products||[];
    let done=0,fail=0;
    for(const prod of list){
      setImpMsg(`Importing ${done+fail+1}/${list.length}: ${prod.product_name}`);
      const one=await api("/api/import-one",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(prod)}).then(r=>r.json()).catch(()=>({error:1}));
      if(one.error) fail++; else done++;
      await new Promise(r=>setTimeout(r,300));
    }
    setImporting(false);
    setImpMsg(`Done: ${done} imported${fail?`, ${fail} failed`:""}`);
    refresh();
  };
  const [np,setNp]=useState({product_id:"",product_name:"",category:"",sale_price:"",regular_price:"",image_url:"",description:""});
  const [adding,setAdding]=useState(false);
  const filtered = products.filter(p=>(p.product_name||p.name||"").toLowerCase().includes(search.toLowerCase())||(p.category||"").toLowerCase().includes(search.toLowerCase()));
  const del = async(id)=>{ await api("/api/products",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}); refresh(); };
  return <div style={{display:"flex",flexDirection:"column",gap:16,height:"calc(100vh - 130px)"}}>
    <div style={{display:"flex",gap:12}}>
      <div style={{position:"relative",flex:1}}><input placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",background:T.card,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"8px 12px 8px 36px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
      <Btn gold onClick={()=>{setShowAdd(!showAdd);setShowImport(false);}}><i className="ti ti-plus" style={{marginRight:6}}/>Add</Btn>
      <Btn onClick={()=>{setShowImport(!showImport);setShowAdd(false);}}><i className="ti ti-world-download" style={{marginRight:6}}/>Website</Btn>
      <Btn onClick={refresh}><i className="ti ti-refresh" style={{marginRight:6}}/>Sync</Btn>
    </div>
    {showImport&&<Card>
      <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>Import from your website (WooCommerce)</div>
      <div style={{fontSize:11.5,color:T.textMuted,marginBottom:12}}>WooCommerce &gt; Settings &gt; Advanced &gt; REST API &gt; Add key (Read) to get Consumer key and secret. All published products will be imported into your inventory.</div>
      <Inp label="Website URL" value={imp.siteUrl} onChange={e=>setImp({...imp,siteUrl:e.target.value})} placeholder="https://yourshop.com"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Inp label="Consumer key" value={imp.ck} onChange={e=>setImp({...imp,ck:e.target.value})} placeholder="ck_..."/>
        <Inp label="Consumer secret" value={imp.cs} onChange={e=>setImp({...imp,cs:e.target.value})} placeholder="cs_..."/>
      </div>
      <Btn gold onClick={runImport} disabled={importing}>{importing?"Importing...":"Import products"}</Btn>
      {impMsg&&<div style={{fontSize:12,color:T.textMuted,marginTop:10}}>{impMsg}</div>}
    </Card>}
    {showAdd&&<Card>
      <div style={{display:"flex",gap:8,marginBottom:14,paddingBottom:14,borderBottom:`0.5px solid ${T.border}`}}>
        <Inp label="Product URL (auto scrape)" value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://yourshop.com/product/..." style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"flex-end"}}>
          <Btn gold onClick={scrapeUrl} disabled={urlBusy}>{urlBusy?"Scraping...":"Fetch"}</Btn>
        </div>
      </div>
      {urlMsg&&<div style={{fontSize:12,color:T.textMuted,marginBottom:10}}>{urlMsg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Inp label="Product code" value={np.product_id} onChange={e=>setNp({...np,product_id:e.target.value})}/>
        <Inp label="Name" value={np.product_name} onChange={e=>setNp({...np,product_name:e.target.value})}/>
        <Inp label="Category" value={np.category} onChange={e=>setNp({...np,category:e.target.value})}/>
        <Inp label="Sale price" value={np.sale_price} onChange={e=>setNp({...np,sale_price:e.target.value})}/>
        <Inp label="Regular price" value={np.regular_price} onChange={e=>setNp({...np,regular_price:e.target.value})}/>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Product image</label>
        <input ref={addFileRef} type="file" accept="image/*" onChange={e=>setImgFile(e.target.files[0]||null)} style={{fontSize:13,color:T.text}}/>
        {imgFile&&<div style={{fontSize:11,color:T.textMuted,marginTop:4}}>{imgFile.name}</div>}
      </div>
      <Inp label="Description" textarea value={np.description} onChange={e=>setNp({...np,description:e.target.value})}/>
      <Btn gold onClick={add} disabled={adding}>{adding?"Saving + embedding...":"Save product"}</Btn>
    </Card>}
    <Card style={{flex:1,overflow:"auto",padding:0}}>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:560,borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:`0.5px solid ${T.border}`}}>
          {["ID","Product","Category","Price","Stock",""].map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",color:T.textMuted,fontWeight:500,fontSize:11,textTransform:"uppercase",letterSpacing:.8}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(p=><tr key={p.id} style={{borderBottom:`0.5px solid ${T.border}08`}}>
          <td style={{padding:"12px 16px",color:T.textDim,fontFamily:"monospace",fontSize:12}}>{p.product_id||p.id}</td>
          <td style={{padding:"12px 16px",fontWeight:500}}>{p.product_name||p.name||"Unnamed"}</td>
          <td style={{padding:"12px 16px"}}><Badge>{p.category||"N/A"}</Badge></td>
          <td style={{padding:"12px 16px",color:T.gold,fontWeight:500}}>{p.sale_price||p.regular_price||"-"}</td>
          <td style={{padding:"12px 16px"}}><Badge color={p.stock_status==="instock"?T.success:T.danger}>{p.stock_status||"?"}</Badge></td>
          <td style={{padding:"12px 16px"}}><button onClick={()=>del(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:16}}><i className="ti ti-trash"/></button></td>
        </tr>)}</tbody>
      </table></div>
      {filtered.length===0&&<div style={{padding:40,textAlign:"center",color:T.textDim}}>No products</div>}
    </Card>
  </div>;
}

function Orders({orders,refresh}) {
  const [filter,setFilter]=useState("All");
  const sts=["All","Pending","Shipped","Delivered","Cancelled"];
  const filtered = filter==="All"?orders:orders.filter(o=>o.status===filter);
  const update=async(id,status)=>{await api("/api/orders",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})}); refresh();};
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:20}}>{sts.map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,background:filter===s?T.gold:"rgba(240,192,64,0.08)",color:filter===s?"#0a0a0a":T.textMuted}}>{s}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {filtered.map(o=><Card key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:14,fontWeight:600,color:T.gold,fontFamily:"monospace"}}>{o.id}</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{o.customer_name||o.customer} - {o.product_name||o.products}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Badge color={o.status==="Pending"?T.warn:o.status==="Shipped"?T.info:o.status==="Delivered"?T.success:T.danger}>{o.status}</Badge>
          {o.status==="Pending"&&<Btn small onClick={()=>update(o.id,"Shipped")}>Ship</Btn>}
          {o.status==="Shipped"&&<Btn small onClick={()=>update(o.id,"Delivered")}>Deliver</Btn>}
        </div>
      </Card>)}
      {filtered.length===0&&<Card style={{textAlign:"center",color:T.textDim,padding:40}}>No orders</Card>}
    </div>
  </div>;
}

function Profile() {
  const [p,setP]=useState(null);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({business_name:"",phone:"",address:"",website:"",business_type:"ecommerce",item_label:""});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const BIZ_LABEL={ecommerce:"E-commerce / Online shop",agency:"Agency / Service provider",restaurant:"Restaurant / Food",education:"Education / Coaching",realestate:"Real estate",other:"Other"};
  const AUTO_ITEM={ecommerce:"product",agency:"service",restaurant:"menu item",education:"course",realestate:"listing",other:"item"};

  const [loadErr,setLoadErr]=useState(false);
  const [logoBusy,setLogoBusy]=useState(false);
  const logoRef=useRef(null);

  const uploadLogo=async(file)=>{
    if(!file) return;
    setLogoBusy(true);
    const fd=new FormData(); fd.append("logo",file);
    const r=await api("/api/profile-logo",{method:"POST",body:fd}).then(r=>r.json()).catch(()=>({error:"network"}));
    setLogoBusy(false);
    if(r.error){setMsg("Logo failed: "+r.error);return;}
    await load();
    if(typeof window!=="undefined") window.dispatchEvent(new Event("logo-updated"));
  };
  const removeLogo=async()=>{
    setLogoBusy(true);
    await api("/api/profile-logo",{method:"DELETE"}).catch(()=>{});
    setLogoBusy(false);
    await load();
    if(typeof window!=="undefined") window.dispatchEvent(new Event("logo-updated"));
  };

  const load=async(attempt=0)=>{
    setLoadErr(false);
    const d=await api("/api/profile?t="+Date.now()).then(r=>r.json()).catch(()=>null);
    if(!d||d.error){
      if(attempt<3){ setTimeout(()=>load(attempt+1),1000*(attempt+1)); return; }
      setLoadErr(true);
      return;
    }
    setP(d);
    setForm({business_name:d.business_name||"",phone:d.phone||"",address:d.address||"",website:d.website||"",business_type:d.business_type||"ecommerce",item_label:d.item_label||""});
  };
  useEffect(()=>{load();},[]);

  const save=async()=>{
    setSaving(true); setMsg("");
    const payload={...form,item_label:AUTO_ITEM[form.business_type]||"item"};
    const r=await api("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}).then(r=>r.json()).catch(()=>({error:"network"}));
    setSaving(false);
    if(r.error){setMsg("Failed: "+r.error);return;}
    await load();
    setEditing(false);
    setMsg("");
  };

  if(loadErr) return <Card style={{color:T.textDim}}>Could not load profile.<Btn gold onClick={()=>load(0)} style={{marginLeft:10}}>Retry</Btn></Card>;
  if(!p) return <Card style={{color:T.textDim}}>Loading...</Card>;
  const planColor=p.plan==="pro"?T.success:p.plan==="trial"?T.gold:T.textDim;

  return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,alignItems:"start"}}>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,paddingBottom:16,borderBottom:`0.5px solid ${T.border}`}}>
        <div style={{width:64,height:64,borderRadius:14,overflow:"hidden",flexShrink:0,background:T.bgAlt,border:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {p.logo_url?<img src={p.logo_url} alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<i className="ti ti-building-store" style={{fontSize:26,color:T.textDim}}/>}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:6}}>Business logo <span style={{color:T.textDim,fontWeight:400}}>(optional)</span></div>
          <input ref={logoRef} type="file" accept="image/*" hidden onChange={e=>{uploadLogo(e.target.files[0]);e.target.value="";}}/>
          <div style={{display:"flex",gap:8}}>
            <Btn small gold onClick={()=>logoRef.current?.click()} disabled={logoBusy}>{logoBusy?"Uploading...":(p.logo_url?"Change":"Upload")}</Btn>
            {p.logo_url&&<Btn small onClick={removeLogo} disabled={logoBusy}>Remove</Btn>}
          </div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:600}}>Business information</div>
        {!editing&&<i onClick={()=>setEditing(true)} className="ti ti-pencil" title="Edit" style={{fontSize:17,color:T.gold,cursor:"pointer"}}/>}
      </div>

      {!editing?<>
        <Row k="Business name" v={p.business_name||"-"}/>
        <Row k="Phone" v={p.phone||"-"}/>
        <Row k="Address" v={p.address||"-"}/>
        <Row k="Website" v={p.website||"-"}/>
        <Row k="Business type" v={BIZ_LABEL[p.business_type]||p.business_type||"-"}/>
      </>:<>
        <Inp label="Business name" value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})}/>
        <Inp label="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
        <Inp label="Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
        <Inp label="Website" value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/>
        <label style={{display:"block",fontSize:12,color:T.textMuted,margin:"4px 0 6px",textTransform:"uppercase",letterSpacing:1}}>Business type</label>
        <select value={form.business_type} onChange={e=>setForm({...form,business_type:e.target.value})} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:13,marginBottom:12}}>
          {Object.entries(BIZ_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Btn gold onClick={save} disabled={saving}>{saving?"Saving...":"Save changes"}</Btn>
          <Btn onClick={()=>{setEditing(false);load();}}>Cancel</Btn>
          {msg&&<span style={{fontSize:12,color:T.textMuted}}>{msg}</span>}
        </div>
      </>}
    </Card>
    <Card>
      <div style={{fontSize:14,fontWeight:600,marginBottom:16}}>Account</div>
      <Row k="Email" v={p.email}/>
      <Row k="Plan" v={<Badge color={planColor}>{p.plan}</Badge>}/>
      {p.plan==="trial"&&p.trial_end&&<Row k="Trial ends" v={new Date(p.trial_end).toLocaleDateString()}/>}
      {p.plan==="trial"&&<Row k="Today usage" v={`${p.usage?.today??0} / 30 msgs`}/>}
      <Row k="Joined" v={p.created_at?new Date(p.created_at).toLocaleDateString():"-"}/>
      <div style={{height:12}}/>
      <div style={{fontSize:14,fontWeight:600,margin:"8px 0 12px"}}>Resources</div>
      <Row k="Products" v={p.usage?.products??0}/>
      <Row k="Orders" v={p.usage?.orders??0}/>
      <Row k="Channels" v={p.usage?.channels??0}/>
      <div style={{height:16}}/>
      <Btn danger onClick={async()=>{await getSb().auth.signOut();AUTH_TOKEN="";location.reload();}} style={{width:"100%"}}><i className="ti ti-logout" style={{marginRight:6}}/>Logout</Btn>
    </Card>
  </div>;
}

function Row({k,v}) {
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`0.5px solid ${T.border}`,fontSize:13}}>
    <span style={{color:T.textMuted}}>{k}</span><span>{v}</span>
  </div>;
}

function Settings({settings,setSettings}) {
  const [s,setS]=useState(settings);
  const [saved,setSaved]=useState(false);
  const [bizDesc,setBizDesc]=useState("");
  const [gen,setGen]=useState(false);
  const [genMsg,setGenMsg]=useState("");
  const save=async()=>{setSettings(s); await api("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}); setSaved(true); setTimeout(()=>setSaved(false),2000);};
  useEffect(()=>{setS(settings);},[settings]);
  const generate=async()=>{
    if(!bizDesc.trim()||gen) return;
    setGen(true); setGenMsg("Generating prompt...");
    const r=await api("/api/generate-prompt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:bizDesc})}).then(r=>r.json()).catch(()=>({error:"network"}));
    setGen(false);
    if(r.error){setGenMsg("Failed: "+r.error);return;}
    setS(v=>({...v,systemPrompt:r.prompt})); setGenMsg("Prompt generated. Review below and Save.");
  };
  return <div style={{maxWidth:700}}>
    <Card style={{marginBottom:16}}><div style={{fontSize:15,fontWeight:500,marginBottom:16}}>General</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Inp label="Bot name" value={s.botName||""} onChange={e=>setS({...s,botName:e.target.value})}/>
        <Inp label="Business name" value={s.businessName||""} onChange={e=>setS({...s,businessName:e.target.value})}/>
      </div>
      <Inp label="Greeting" value={s.greeting||""} onChange={e=>setS({...s,greeting:e.target.value})}/>
    </Card>
    <Card style={{marginBottom:16}}>
      <div style={{fontSize:15,fontWeight:500,marginBottom:6}}>AI prompt generator</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>Describe your business, products, prices, delivery and policies. AI will write a complete system prompt for you.</div>
      <Inp textarea value={bizDesc} onChange={e=>setBizDesc(e.target.value)} placeholder="e.g. We sell handmade leather bags for men and women. Prices 1500 to 5000 tk. Delivery 80 tk in Dhaka, 130 outside. Cash on delivery. 7 day return." style={{marginBottom:10}}/>
      <Btn gold onClick={generate} disabled={gen}><i className="ti ti-sparkles" style={{marginRight:6}}/>{gen?"Generating...":"Generate prompt"}</Btn>
      {genMsg&&<span style={{fontSize:12,color:T.textMuted,marginLeft:10}}>{genMsg}</span>}
    </Card>
    <Card style={{marginBottom:16}}><div style={{fontSize:15,fontWeight:500,marginBottom:16}}>AI system prompt</div>
      <Inp textarea value={s.systemPrompt||""} onChange={e=>setS({...s,systemPrompt:e.target.value})} style={{marginBottom:0}}/>
    </Card>
    <Btn gold onClick={save}><i className="ti ti-check" style={{marginRight:6}}/>{saved?"Saved!":"Save settings"}</Btn>
  </div>;
}

function Demo({settings}) {
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [showEmoji,setShowEmoji]=useState(false);
  const ref=useRef(null);
  const EMOJIS=["😀","😂","❤️","👍","🙏","😍","🔥","🎉","😢","😮","💯","✅"];
  const clearChat=()=>setMsgs(settings.greeting?[{role:"bot",text:settings.greeting}]:[]);
  useEffect(()=>{if(settings.greeting) setMsgs([{role:"bot",text:settings.greeting}]);},[]);

  const send=async()=>{
    if(!input.trim()||loading) return;
    const text=input.trim(); setInput(""); setMsgs(p=>[...p,{role:"user",text}]); setLoading(true);
    try {
      const history = msgs.filter((_,i)=>i>0).map(m=>({role:m.role==="bot"?"assistant":"user",content:m.text}));
      const res = await api("/api/demo-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...history,{role:"user",content:text}],systemPrompt:settings.systemPrompt})});
      const data = await res.json();
      setMsgs(p=>[...p,{role:"bot",text:data.reply||"Error"}]);
    } catch { setMsgs(p=>[...p,{role:"bot",text:"Connection error."}]); }
    setLoading(false);
    setTimeout(()=>ref.current?.scrollTo(0,ref.current.scrollHeight),100);
  };

  return <div style={{maxWidth:480,margin:"0 auto",height:"calc(100vh - 130px)",display:"flex",flexDirection:"column"}}>
    <div style={{textAlign:"center",marginBottom:16}}>
      <div style={{width:56,height:56,borderRadius:16,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",border:`1px solid ${T.gold}30`}}><i className="ti ti-robot" style={{fontSize:28,color:T.gold}}/></div>
      <div style={{fontSize:18,fontWeight:600}}>{settings.botName||"Autologic Bot"}</div>
      <div style={{fontSize:13,color:T.textMuted}}>Try our AI assistant live</div>
    </div>
    <Card style={{flex:1,display:"flex",flexDirection:"column",padding:0,overflow:"hidden"}}>
      <div ref={ref} style={{flex:1,overflow:"auto",padding:16,display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map((m,i)=><div key={i} style={{display:"flex",justifyContent:m.role==="bot"?"flex-start":"flex-end"}}>
          <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:14,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap",background:m.role==="bot"?T.bgAlt:T.gold,color:m.role==="bot"?T.text:"#0a0a0a",borderBottomLeftRadius:m.role==="bot"?2:14,borderBottomRightRadius:m.role==="bot"?14:2}}>{m.text}</div>
        </div>)}
        {loading&&<div style={{display:"flex",gap:4,padding:"10px 14px",background:T.bgAlt,borderRadius:14,width:"fit-content",borderBottomLeftRadius:2}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.textDim,animation:`dotPulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>}
      </div>
      <div style={{borderTop:`0.5px solid ${T.border}`,position:"relative"}}>
        {showEmoji&&<div style={{position:"absolute",bottom:"100%",right:12,background:T.card,border:`0.5px solid ${T.border}`,borderRadius:12,padding:8,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,zIndex:5}}>
          {EMOJIS.map(e=><span key={e} onClick={()=>{setInput(p=>p+e);setShowEmoji(false);}} style={{fontSize:20,cursor:"pointer",padding:4}}>{e}</span>)}
        </div>}
        <div style={{padding:"10px 8px",display:"flex",gap:2,alignItems:"center"}}>
          <button onClick={clearChat} title="Clear chat" style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:18,padding:4,flexShrink:0}}><i className="ti ti-trash"/></button>
          <div style={{flex:1,display:"flex",alignItems:"center",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:20,padding:"0 4px 0 12px",minWidth:0}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message" style={{flex:1,background:"none",border:"none",padding:"10px 0",color:T.text,fontSize:13,outline:"none",minWidth:0}}/>
            <button onClick={()=>setShowEmoji(s=>!s)} title="Emoji" style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"4px 2px",flexShrink:0}}>😊</button>
          </div>
          <button onClick={send} disabled={loading} style={{width:34,height:34,borderRadius:"50%",border:"none",cursor:"pointer",background:T.gold,display:"flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-send" style={{fontSize:16,color:"#0a0a0a"}}/></button>
        </div>
      </div>
    </Card>
  </div>;
}

function Channels({onConnect}) {
  const [channels,setChannels]=useState([]);
  const load=()=>api("/api/channels").then(r=>r.json()).then(d=>Array.isArray(d)&&setChannels(d)).catch(()=>{});
  useEffect(()=>{load();},[]);
  const icons={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp",website:"ti-world"};
  return <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:700}}>
    <Btn gold onClick={onConnect} style={{alignSelf:"flex-start"}}><i className="ti ti-plus" style={{marginRight:6}}/>Connect new channel</Btn>
    {channels.map(ch=><Card key={ch.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:40,height:40,borderRadius:10,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`ti ${icons[ch.platform]||"ti-plug"}`} style={{fontSize:20,color:T.gold}}/></div>
        <div><div style={{fontSize:14,fontWeight:500,textTransform:"capitalize"}}>{ch.platform}</div><div style={{fontSize:12,color:T.textMuted,fontFamily:"monospace"}}>{ch.page_id||"-"}</div></div>
      </div>
      <Badge color={ch.status==="connected"?T.success:T.textDim}>{ch.status}</Badge>
    </Card>)}
    {channels.length===0&&<Card style={{textAlign:"center",color:T.textDim,padding:40}}>No channels configured</Card>}
  </div>;
}


function AuthGate({onReady}) {
  const [mode,setMode]=useState("signin");
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [biz,setBiz]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  const go=async()=>{
    if(!email||!pw||busy) return;
    setBusy(true); setErr("");
    try{
      let res;
      if(mode==="signup") res=await getSb().auth.signUp({email,password:pw});
      else res=await getSb().auth.signInWithPassword({email,password:pw});
      if(res.error) throw res.error;
      const session=res.data.session;
      if(!session){setErr("Check your email to confirm, then sign in.");setBusy(false);return;}
      AUTH_TOKEN=session.access_token;
      if(mode==="signup") await api("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"register",business_name:biz||email.split("@")[0]})});
      onReady();
    }catch(e){setErr(e.message||"Failed");}
    setBusy(false);
  };
  return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <Card style={{width:340,textAlign:"center",padding:"2.5rem 2rem"}}>
      <div style={{width:56,height:56,borderRadius:16,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:`1px solid ${T.gold}30`}}><i className="ti ti-robot" style={{fontSize:26,color:T.gold}}/></div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:4}}>Chatbot Platform</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:20}}>{mode==="signin"?"Sign in to your dashboard":"Create your account"}</div>
      {mode==="signup"&&<Inp value={biz} onChange={e=>setBiz(e.target.value)} placeholder="Business name"/>}
      <Inp type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/>
      <Inp type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Password"/>
      <Btn gold onClick={go} style={{width:"100%"}}>{busy?"Please wait...":(mode==="signin"?"Sign In":"Sign Up")}</Btn>
      {err&&<div style={{fontSize:12,color:T.danger,marginTop:10}}>{err}</div>}
      <div style={{fontSize:12,color:T.textMuted,marginTop:16,cursor:"pointer"}} onClick={()=>{setMode(m=>m==="signin"?"signup":"signin");setErr("");}}>
        {mode==="signin"?"New here? Create account":"Already have an account? Sign in"}
      </div>
    </Card>
  </div>;
}

function Onboarding({me,onTrial,onDemo}) {
  const [busy,setBusy]=useState(false);
  const startTrial=async()=>{
    setBusy(true);
    await api("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"start_trial"})});
    setBusy(false);
    onTrial();
  };
  return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{maxWidth:640,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:20,fontWeight:600}}>Welcome, {me?.client?.business_name}</div>
        <div style={{fontSize:13,color:T.textMuted}}>Choose how you want to start</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>
        <Card style={{textAlign:"center",padding:"2rem 1.5rem",cursor:"pointer"}} onClick={onDemo}>
          <i className="ti ti-message-chatbot" style={{fontSize:34,color:T.gold}}/>
          <div style={{fontSize:16,fontWeight:600,margin:"12px 0 6px"}}>Try Demo</div>
          <div style={{fontSize:12.5,color:T.textMuted}}>Chat with the AI assistant instantly. No setup needed.</div>
        </Card>
        <Card style={{textAlign:"center",padding:"2rem 1.5rem",cursor:"pointer",border:`1px solid ${T.gold}50`}} onClick={startTrial}>
          <i className="ti ti-rocket" style={{fontSize:34,color:T.gold}}/>
          <div style={{fontSize:16,fontWeight:600,margin:"12px 0 6px"}}>{busy?"Starting...":"Start 3-Day Free Trial"}</div>
          <div style={{fontSize:12.5,color:T.textMuted}}>All features unlocked. 30 messages/day. Connect Facebook, Instagram or WhatsApp.</div>
        </Card>
      </div>
    </div>
  </div>;
}

function ConnectChannel({onDone,clientId}) {
  useEffect(()=>{
    const h=e=>{if(e.data==="fb_connected")onDone();};
    window.addEventListener("message",h);
    return ()=>window.removeEventListener("message",h);
  },[]);
  const fbConnect=()=>{
    const w=520,ht=650;
    const left=(window.screen.width-w)/2,top=(window.screen.height-ht)/2;
    window.open(`/api/fb/login?client_id=${clientId}`,"fbconnect",`width=${w},height=${ht},left=${left},top=${top}`);
  };
  const [platform,setPlatform]=useState(null);
  const [pageId,setPageId]=useState("");
  const [token,setToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const opts=[
    {id:"facebook",icon:"ti-brand-facebook",label:"Facebook Page",hint:"One click connect with Facebook login"},
    {id:"instagram",icon:"ti-brand-instagram",label:"Instagram Business",hint:"IG Business Account ID + Access Token (linked FB Page)"},
    {id:"whatsapp",icon:"ti-brand-whatsapp",label:"WhatsApp Business",hint:"Phone Number ID + WhatsApp Cloud API Token"},
  ];
  const connect=async()=>{
    if(!pageId||!token||busy) return;
    setBusy(true); setErr("");
    const r=await api("/api/channels",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform,page_id:pageId,access_token:token})}).then(r=>r.json()).catch(()=>({error:"network"}));
    setBusy(false);
    if(r.error) setErr(r.error);
    else onDone();
  };
  return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{maxWidth:560,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:18,fontWeight:600}}>Connect a channel</div>
        <div style={{fontSize:12.5,color:T.textMuted}}>Your bot will reply to customers on this channel</div>
      </div>
      {!platform?<div style={{display:"flex",flexDirection:"column",gap:12}}>
        {opts.map(o=><Card key={o.id} style={{display:"flex",alignItems:"center",gap:14,cursor:"pointer",padding:"1rem 1.2rem"}} onClick={()=>o.id==="facebook"?fbConnect():setPlatform(o.id)}>
          <i className={`ti ${o.icon}`} style={{fontSize:26,color:T.gold}}/>
          <div><div style={{fontSize:14,fontWeight:500}}>{o.label}</div><div style={{fontSize:11.5,color:T.textMuted}}>{o.hint}</div></div>
        </Card>)}
        <div style={{textAlign:"center",fontSize:12,color:T.textMuted,cursor:"pointer",marginTop:8}} onClick={onDone}>Skip for now</div>
      </div>:<Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:12,textTransform:"capitalize"}}>{platform} connection</div>
        <Inp value={pageId} onChange={e=>setPageId(e.target.value)} placeholder={platform==="whatsapp"?"Phone Number ID":"Page / Account ID"}/>
        <Inp value={token} onChange={e=>setToken(e.target.value)} placeholder="Access Token"/>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={()=>setPlatform(null)}>Back</Btn>
          <Btn gold onClick={connect} style={{flex:1}}>{busy?"Connecting...":"Connect"}</Btn>
        </div>
        {err&&<div style={{fontSize:12,color:T.danger,marginTop:10}}>{err}</div>}
      </Card>}
    </div>
  </div>;
}

export default function Dashboard() {
  const isMobile=useIsMobile();
  const [chatOpen,setChatOpen]=useState(false);
  const [page,setPageRaw]=useState("analytics");
  const setPage=(p)=>{
    setPageRaw(p);
    if(typeof window!=="undefined") window.history.pushState({page:p},"","#"+p);
  };
  useEffect(()=>{
    const onPop=(e)=>{ if(e.state?.page) setPageRaw(e.state.page); };
    window.addEventListener("popstate",onPop);
    const h=window.location.hash.replace("#","");
    if(h) setPageRaw(h);
    window.history.replaceState({page:window.location.hash.replace("#","")||"analytics"},"","");
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);
  const [products,setProducts]=useState([]);
  const [convos,setConvos]=useState([]);
  const [orders,setOrders]=useState([]);
  const [settings,setSettings]=useState({botName:"Autologic Bot",businessName:"My Business",systemPrompt:"You are a helpful sales assistant.",greeting:"Hello! How can I help?"});
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [authed,setAuthed]=useState(false);
  const [authChecked,setAuthChecked]=useState(false);
  const [me,setMe]=useState(null);
  const [stage,setStage]=useState("loading");
  const bt=me?.client?.business_type||"ecommerce";
  const navLabel=(i)=>{
    const p=PAGES[i];
    if(p==="inventory") return words(bt).inv;
    if(p==="orders") return words(bt).order;
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
      if(session){AUTH_TOKEN=session.access_token;setAuthed(true);await loadMe();}
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
      const [pr,cv,or,st]=await Promise.all([
        api("/api/products").then(r=>r.json()).catch(()=>[]),
        api("/api/conversations").then(r=>r.json()).catch(()=>[]),
        api("/api/orders").then(r=>r.json()).catch(()=>[]),
        api("/api/settings").then(r=>r.json()).catch(()=>({})),
      ]);
      if(Array.isArray(pr)) setProducts(pr);
      if(Array.isArray(cv)) setConvos(cv);
      if(Array.isArray(or)) setOrders(or);
      if(st&&Object.keys(st).length) setSettings(s=>({...s,...st}));
    } catch {}
    setLoading(false);
  };

  useEffect(()=>{if(authed&&stage==="app")load();},[authed,stage]);
  useEffect(()=>{
    if(!authed||stage!=="app") return;
    const t=setInterval(()=>load(true),10000);
    return ()=>clearInterval(t);
  },[authed,stage]);

  if(!authChecked||stage==="loading") return null;
  if(stage==="auth") return <AuthGate onReady={async()=>{setAuthed(true);await loadMe();}}/>;
  if(stage==="onboarding") return <Onboarding me={me} onDemo={()=>{setStage("app");setPage("demo");}} onTrial={async()=>{await loadMe();setStage("connect");}}/>;
  if(stage==="connect") return <ConnectChannel clientId={me?.client?.id} onDone={async()=>{await loadMe();setStage("app");}}/>;

  return <div style={{display:"flex",height:isMobile?"100dvh":"100vh",overflow:"hidden"}}>
    {sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:40}}/>}
    <div style={{position:isMobile?"fixed":"relative",zIndex:50,height:"100%",width:240,background:T.card,borderRight:`0.5px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,transform:sidebarOpen?"translateX(0)":"translateX(-100%)",transition:"transform 0.25s ease",left:0,top:0}}>
      <div style={{padding:"20px",display:"flex",alignItems:"center",gap:12,borderBottom:`0.5px solid ${T.border}`}}>
        <div style={{width:36,height:36,borderRadius:10,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${T.gold}30`,overflow:"hidden"}}>{me?.client?.logo_url?<img src={me.client.logo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<i className="ti ti-bolt" style={{fontSize:18,color:T.gold}}/>}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{me?.client?.business_name||"Autologic"}</div><div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:1.5}}>chatbot</div></div>
        <i onClick={()=>setSidebarOpen(false)} className="ti ti-x" style={{fontSize:18,color:T.textDim,cursor:"pointer"}}/>
      </div>
      <nav style={{flex:1,padding:"12px 8px",overflowY:"auto"}}>
        {PAGES.map((p,i)=><div key={p} onClick={()=>{setPage(p);if(isMobile)setSidebarOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:8,cursor:"pointer",marginBottom:2,background:page===p?T.goldBg:"transparent",borderLeft:page===p?`3px solid ${T.gold}`:"3px solid transparent",color:page===p?T.gold:T.textMuted}}>
          <i className={`ti ${ICONS[i]}`} style={{fontSize:18,flexShrink:0}}/>
          <span style={{fontSize:13.5,fontWeight:page===p?500:400}}>{navLabel(i)}</span>
          {p==="conversations"&&convos.some(c=>c.status==="active")&&<div style={{marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:T.success,animation:"pulse 2s infinite"}}/>}
        </div>)}
      </nav>
    </div>

    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
      {!(isMobile&&chatOpen)&&<div style={{padding:isMobile?"12px 16px":"14px 24px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:14,minWidth:0}}>
          <i onClick={()=>setSidebarOpen(true)} className="ti ti-menu-2" style={{fontSize:22,color:T.text,cursor:"pointer",flexShrink:0}}/>
          <div style={{minWidth:0}}><div style={{fontSize:isMobile?16:18,fontWeight:600}}>{navLabel(PAGES.indexOf(page))}</div>{!isMobile&&<div style={{fontSize:12,color:T.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{me?.client?.business_name} - {me?.client?.plan==='trial'?`Trial: ${me?.usage?.today??0}/30 msgs today`:`${products.length} ${words(bt).item.toLowerCase()}s`}</div>}</div>
        </div>
        <Btn small onClick={()=>load(false)} disabled={loading}><i className="ti ti-refresh" style={{marginRight:4,display:"inline-block",animation:loading?"spin 0.8s linear infinite":"none"}}/>{loading?"Syncing":"Sync"}</Btn>
      </div>
      }<div style={{flex:1,overflow:"auto",padding:isMobile&&chatOpen?0:(isMobile?12:24),minHeight:0}}>
        {loading?<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60,flexDirection:"column",gap:16}}><div style={{width:32,height:32,border:`3px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontSize:13,color:T.textMuted}}>Loading from Supabase...</span></div>:(
          <>
            {page==="analytics"&&<Analytics products={products} convos={convos} orders={orders} msgCount={convos.reduce((a,c)=>a+c.messages.length,0)}/>}
            {page==="conversations"&&<Conversations convos={convos} refresh={load} onChatOpen={setChatOpen}/>}
            {page==="inventory"&&<Inventory products={products} refresh={load}/>}
            {page==="orders"&&<Orders orders={orders} refresh={load}/>}
            {page==="channels"&&<Channels onConnect={()=>setStage("connect")}/>}
            {page==="profile"&&<Profile/>}
            {page==="settings"&&<Settings settings={settings} setSettings={setSettings}/>}
            {page==="demo"&&<Demo settings={settings}/>}
          </>
        )}
      </div>
    </div>
  </div>;
}
