"use client";
import { useState, useEffect, useRef } from "react";

const T = {
  bg: "#05080f", bgAlt: "#080e1a", card: "#0d1529",
  gold: "#f0c040", goldDim: "#c4982e", goldBg: "rgba(240,192,64,0.08)",
  text: "#e8e8ec", textMuted: "#7a8db0", textDim: "#4a5a7a",
  border: "#1a2744", danger: "#ef4444", success: "#22c55e", info: "#3b82f6", warn: "#f59e0b", purple: "#8b5cf6",
};
const PAGES = ["analytics","conversations","inventory","orders","channels","settings","demo"];
const ICONS = ["ti-chart-bar","ti-messages","ti-package","ti-shopping-cart","ti-plug","ti-settings","ti-robot"];
const LABELS = ["Analytics","Conversations","Inventory","Orders","Channels","Settings","Demo"];

const useIsMobile = () => {
  const [m,setM]=useState(false);
  useEffect(()=>{
    const check=()=>setM(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);
  return m;
};

const Btn = ({children,gold,danger,small,style,...p}) => <button {...p} style={{padding:small?"6px 14px":"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:small?12:13,fontWeight:500,background:danger?T.danger:gold?T.gold:"rgba(240,192,64,0.12)",color:danger?"#fff":gold?"#0a0a0a":T.gold,...style}}>{children}</button>;
const Badge = ({children,color=T.gold}) => <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,background:`${color}18`,color}}>{children}</span>;
const Card = ({children,style,...p}) => <div {...p} style={{background:T.card,borderRadius:12,border:`0.5px solid ${T.border}`,padding:"1.25rem",...style}}>{children}</div>;
const Inp = ({label,textarea,style,...p}) => <div style={{marginBottom:16,...style}}>{label&&<label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{label}</label>}{textarea?<textarea {...p} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,resize:"vertical",minHeight:100,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>:<input {...p} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>}</div>;
const StatCard = ({icon,label,value,sub,color=T.gold}) => <Card style={{flex:1,minWidth:140}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:36,height:36,borderRadius:10,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`ti ${icon}`} style={{fontSize:18,color}}/></div><span style={{fontSize:12,color:T.textMuted,textTransform:"uppercase",letterSpacing:.8}}>{label}</span></div><div style={{fontSize:28,fontWeight:600,color:T.text}}>{value}</div>{sub&&<div style={{fontSize:12,color:T.textMuted,marginTop:4}}>{sub}</div>}</Card>;

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

function Conversations({convos,refresh}) {
  const isMobile=useIsMobile();
  const [sel,setSel]=useState(-1);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [contacts,setContacts]=useState({});
  const [globalBot,setGlobalBot]=useState(true);
  const chatRef=useRef(null);

  const loadContacts=async()=>{
    try{
      const d=await fetch("/api/contacts").then(r=>r.json());
      if(d.contacts) setContacts(Object.fromEntries(d.contacts.map(c=>[c.sender_id,c])));
      if(typeof d.global_bot_enabled==="boolean") setGlobalBot(d.global_bot_enabled);
    }catch{}
  };
  useEffect(()=>{loadContacts();},[]);
  useEffect(()=>{
    const t=setInterval(()=>refresh&&refresh(true),4000);
    return ()=>clearInterval(t);
  },[refresh]);
  useEffect(()=>{chatRef.current?.scrollTo(0,chatRef.current.scrollHeight);},[convos,sel]);

  const toggle=async(sender_id,val,isGlobal)=>{
    if(isGlobal) setGlobalBot(val);
    else setContacts(p=>({...p,[sender_id]:{...p[sender_id],sender_id,bot_enabled:val}}));
    await fetch("/api/contacts",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(isGlobal?{global:true,bot_enabled:val}:{sender_id,bot_enabled:val})});
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
    const r=await fetch("/api/send-message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_id:c.id,text})}).then(r=>r.json()).catch(()=>({error:"network"}));
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

  return <div style={{display:isMobile?"block":"grid",gridTemplateColumns:"320px 1fr",gap:16,height:isMobile?"calc(100dvh - 190px)":"calc(100vh - 130px)"}}>
    {showList&&<Card style={{overflow:"auto",padding:0,height:"100%"}}>
      <div style={{padding:"12px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:500,color:T.textMuted}}>CHATS</span>
        <Toggle on={globalBot} onClick={()=>toggle(null,!globalBot,true)} label={globalBot?"Bot ON":"Bot OFF"}/>
      </div>
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
          <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cname}</div><div style={{fontSize:12,color:T.textMuted}}>{c.platform}</div></div>
        </div>
        <Toggle on={ct.bot_enabled!==false} onClick={()=>toggle(c.id,ct.bot_enabled===false,false)} label={ct.bot_enabled===false?"Bot OFF (manual)":"Bot ON"}/>
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
      <div style={{padding:"12px 16px",borderTop:`0.5px solid ${T.border}`,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type a message to customer..." style={{flex:1,background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.text,fontSize:13,outline:"none"}}/>
        <button onClick={send} disabled={sending} style={{width:40,height:40,borderRadius:10,border:"none",cursor:"pointer",background:T.gold,display:"flex",alignItems:"center",justifyContent:"center",opacity:sending?.6:1,flexShrink:0}}><i className="ti ti-send" style={{fontSize:18,color:"#0a0a0a"}}/></button>
      </div>
    </Card>}
  </div>;
}

function Inventory({products,refresh}) {
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [np,setNp]=useState({product_id:"",product_name:"",category:"",sale_price:"",regular_price:"",image_url:"",description:""});
  const [adding,setAdding]=useState(false);
  const filtered = products.filter(p=>(p.product_name||p.name||"").toLowerCase().includes(search.toLowerCase())||(p.category||"").toLowerCase().includes(search.toLowerCase()));
  const del = async(id)=>{ await fetch("/api/products",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}); refresh(); };
  const add = async()=>{
    if(!np.product_id||!np.product_name) return;
    setAdding(true);
    await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(np)});
    setAdding(false); setShowAdd(false);
    setNp({product_id:"",product_name:"",category:"",sale_price:"",regular_price:"",image_url:"",description:""});
    refresh();
  };
  return <div style={{display:"flex",flexDirection:"column",gap:16,height:"calc(100vh - 130px)"}}>
    <div style={{display:"flex",gap:12}}>
      <div style={{position:"relative",flex:1}}><input placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",background:T.card,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"8px 12px 8px 36px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
      <Btn gold onClick={()=>setShowAdd(!showAdd)}><i className="ti ti-plus" style={{marginRight:6}}/>Add</Btn>
      <Btn onClick={refresh}><i className="ti ti-refresh" style={{marginRight:6}}/>Sync</Btn>
    </div>
    {showAdd&&<Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Inp label="Product code" value={np.product_id} onChange={e=>setNp({...np,product_id:e.target.value})}/>
        <Inp label="Name" value={np.product_name} onChange={e=>setNp({...np,product_name:e.target.value})}/>
        <Inp label="Category" value={np.category} onChange={e=>setNp({...np,category:e.target.value})}/>
        <Inp label="Sale price" value={np.sale_price} onChange={e=>setNp({...np,sale_price:e.target.value})}/>
        <Inp label="Regular price" value={np.regular_price} onChange={e=>setNp({...np,regular_price:e.target.value})}/>
        <Inp label="Image URL" value={np.image_url} onChange={e=>setNp({...np,image_url:e.target.value})}/>
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
  const update=async(id,status)=>{await fetch("/api/orders",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})}); refresh();};
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

function Settings({settings,setSettings}) {
  const [s,setS]=useState(settings);
  const [saved,setSaved]=useState(false);
  const save=async()=>{setSettings(s); await fetch("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}); setSaved(true); setTimeout(()=>setSaved(false),2000);};
  useEffect(()=>{setS(settings);},[settings]);
  return <div style={{maxWidth:700}}>
    <Card style={{marginBottom:16}}><div style={{fontSize:15,fontWeight:500,marginBottom:16}}>General</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Inp label="Bot name" value={s.botName||""} onChange={e=>setS({...s,botName:e.target.value})}/>
        <Inp label="Business name" value={s.businessName||""} onChange={e=>setS({...s,businessName:e.target.value})}/>
      </div>
      <Inp label="Greeting" value={s.greeting||""} onChange={e=>setS({...s,greeting:e.target.value})}/>
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
  const ref=useRef(null);
  useEffect(()=>{if(settings.greeting) setMsgs([{role:"bot",text:settings.greeting}]);},[]);

  const send=async()=>{
    if(!input.trim()||loading) return;
    const text=input.trim(); setInput(""); setMsgs(p=>[...p,{role:"user",text}]); setLoading(true);
    try {
      const history = msgs.filter((_,i)=>i>0).map(m=>({role:m.role==="bot"?"assistant":"user",content:m.text}));
      const res = await fetch("/api/demo-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...history,{role:"user",content:text}],systemPrompt:settings.systemPrompt})});
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
      <div style={{padding:"12px 16px",borderTop:`0.5px solid ${T.border}`,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type your message..." style={{flex:1,background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.text,fontSize:13,outline:"none"}}/>
        <button onClick={send} disabled={loading} style={{width:40,height:40,borderRadius:10,border:"none",cursor:"pointer",background:T.gold,display:"flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-send" style={{fontSize:18,color:"#0a0a0a"}}/></button>
      </div>
    </Card>
  </div>;
}

function Channels() {
  const [channels,setChannels]=useState([]);
  const load=()=>fetch("/api/channels").then(r=>r.json()).then(d=>Array.isArray(d)&&setChannels(d)).catch(()=>{});
  useEffect(()=>{load();},[]);
  const icons={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp",website:"ti-world"};
  return <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:700}}>
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

function Login({onOk}) {
  const [pw,setPw]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  const go=async()=>{
    if(!pw||busy) return;
    setBusy(true); setErr("");
    const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pw})}).catch(()=>null);
    setBusy(false);
    if(r&&r.ok){sessionStorage.setItem("auth","1");onOk();}
    else setErr("Wrong password");
  };
  return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <Card style={{width:320,textAlign:"center",padding:"2.5rem 2rem"}}>
      <div style={{width:56,height:56,borderRadius:16,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:`1px solid ${T.gold}30`}}><i className="ti ti-lock" style={{fontSize:26,color:T.gold}}/></div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:4}}>Chatbot Dashboard</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:24}}>Enter password to continue</div>
      <Inp type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Password"/>
      <Btn gold onClick={go} style={{width:"100%"}}>{busy?"Checking...":"Login"}</Btn>
      {err&&<div style={{fontSize:12,color:T.danger,marginTop:10}}>{err}</div>}
    </Card>
  </div>;
}

export default function Dashboard() {
  const isMobile=useIsMobile();
  const [page,setPage]=useState("analytics");
  const [products,setProducts]=useState([]);
  const [convos,setConvos]=useState([]);
  const [orders,setOrders]=useState([]);
  const [settings,setSettings]=useState({botName:"Autologic Bot",businessName:"My Business",systemPrompt:"You are a helpful sales assistant.",greeting:"Hello! How can I help?"});
  const [collapsed,setCollapsed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [authed,setAuthed]=useState(false);
  const [authChecked,setAuthChecked]=useState(false);

  useEffect(()=>{
    setAuthed(sessionStorage.getItem("auth")==="1");
    setAuthChecked(true);
  },[]);

  const load=async(silent)=>{
    if(!silent)setLoading(true);
    try {
      const [pr,cv,or,st]=await Promise.all([
        fetch("/api/products").then(r=>r.json()).catch(()=>[]),
        fetch("/api/conversations").then(r=>r.json()).catch(()=>[]),
        fetch("/api/orders").then(r=>r.json()).catch(()=>[]),
        fetch("/api/settings").then(r=>r.json()).catch(()=>({})),
      ]);
      if(Array.isArray(pr)) setProducts(pr);
      if(Array.isArray(cv)) setConvos(cv);
      if(Array.isArray(or)) setOrders(or);
      if(st&&Object.keys(st).length) setSettings(s=>({...s,...st}));
    } catch {}
    setLoading(false);
  };

  useEffect(()=>{if(authed)load();},[authed]);
  useEffect(()=>{
    if(!authed) return;
    const t=setInterval(()=>load(true),10000);
    return ()=>clearInterval(t);
  },[authed]);

  if(!authChecked) return null;
  if(!authed) return <Login onOk={()=>setAuthed(true)}/>;

  return <div style={{display:"flex",height:isMobile?"100dvh":"100vh",overflow:"hidden",flexDirection:isMobile?"column":"row"}}>
    {!isMobile&&<div style={{width:collapsed?64:220,background:T.card,borderRight:`0.5px solid ${T.border}`,display:"flex",flexDirection:"column",transition:"width 0.2s",flexShrink:0,overflow:"hidden"}}>
      <div style={{padding:collapsed?"20px 12px":"20px 20px",display:"flex",alignItems:"center",gap:12,borderBottom:`0.5px solid ${T.border}`}}>
        <div style={{width:36,height:36,borderRadius:10,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${T.gold}30`}}><i className="ti ti-bolt" style={{fontSize:18,color:T.gold}}/></div>
        {!collapsed&&<div><div style={{fontSize:15,fontWeight:600}}>Autologic</div><div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:1.5}}>chatbot</div></div>}
      </div>
      <nav style={{flex:1,padding:"12px 8px"}}>
        {PAGES.map((p,i)=><div key={p} onClick={()=>setPage(p)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,cursor:"pointer",marginBottom:2,background:page===p?T.goldBg:"transparent",borderLeft:page===p?`3px solid ${T.gold}`:"3px solid transparent",color:page===p?T.gold:T.textMuted}}>
          <i className={`ti ${ICONS[i]}`} style={{fontSize:18,flexShrink:0}}/>
          {!collapsed&&<span style={{fontSize:13,fontWeight:page===p?500:400}}>{LABELS[i]}</span>}
          {!collapsed&&p==="conversations"&&convos.some(c=>c.status==="active")&&<div style={{marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:T.success,animation:"pulse 2s infinite"}}/>}
        </div>)}
      </nav>
      <div style={{padding:"12px 8px",borderTop:`0.5px solid ${T.border}`}}>
        <div onClick={()=>setCollapsed(!collapsed)} style={{display:"flex",alignItems:"center",justifyContent:collapsed?"center":"flex-start",gap:12,padding:"10px 14px",borderRadius:8,cursor:"pointer",color:T.textDim}}>
          <i className={`ti ${collapsed?"ti-chevron-right":"ti-chevron-left"}`} style={{fontSize:16}}/>
          {!collapsed&&<span style={{fontSize:12}}>Collapse</span>}
        </div>
      </div>
    </div>}

    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
      <div style={{padding:isMobile?"12px 16px":"16px 28px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:isMobile?16:18,fontWeight:600}}>{LABELS[PAGES.indexOf(page)]}</div>{!isMobile&&<div style={{fontSize:12,color:T.textDim}}>{settings.businessName} - {products.length} products synced</div>}</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Btn small onClick={load}><i className="ti ti-refresh" style={{marginRight:4}}/>Sync</Btn>
          <div style={{width:34,height:34,borderRadius:10,background:T.goldBg,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${T.gold}30`}}><i className="ti ti-user" style={{fontSize:16,color:T.gold}}/></div>
        </div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:isMobile?12:24,minHeight:0}}>
        {loading?<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60,flexDirection:"column",gap:16}}><div style={{width:32,height:32,border:`3px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontSize:13,color:T.textMuted}}>Loading from Supabase...</span></div>:(
          <>
            {page==="analytics"&&<Analytics products={products} convos={convos} orders={orders} msgCount={convos.reduce((a,c)=>a+c.messages.length,0)}/>}
            {page==="conversations"&&<Conversations convos={convos} refresh={load}/>}
            {page==="inventory"&&<Inventory products={products} refresh={load}/>}
            {page==="orders"&&<Orders orders={orders} refresh={load}/>}
            {page==="channels"&&<Channels/>}
            {page==="settings"&&<Settings settings={settings} setSettings={setSettings}/>}
            {page==="demo"&&<Demo settings={settings}/>}
          </>
        )}
      </div>
      {isMobile&&<div className="safe-bottom" style={{display:"flex",background:T.card,borderTop:`0.5px solid ${T.border}`,flexShrink:0}}>
        {PAGES.map((p,i)=><div key={p} onClick={()=>setPage(p)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"10px 0 8px",cursor:"pointer",color:page===p?T.gold:T.textDim}}>
          <i className={`ti ${ICONS[i]}`} style={{fontSize:20}}/>
          <span style={{fontSize:9}}>{LABELS[i]}</span>
        </div>)}
      </div>}
    </div>
  </div>;
}
