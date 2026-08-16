"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn, Inp, Badge, Select } from "./ui.js";
import { api, getSb, setAuthToken } from "./session.js";

// The Profile tab, moved out of dashboard-client.js unchanged.

function Row({k,v}) {
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`0.5px solid ${T.border}`,fontSize:13}}>
    <span style={{color:T.textMuted}}>{k}</span><span>{v}</span>
  </div>;
}

export default function Profile() {
  const [p,setP]=useState(null);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({business_name:"",phone:"",address:"",website:"",business_type:"ecommerce",item_label:""});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const BIZ_LABEL={ecommerce:"E-commerce / Online shop",agency:"Agency / Service provider"};
  const AUTO_ITEM={ecommerce:"product",agency:"service"};

  const [loadErr,setLoadErr]=useState(false);
  const [logoBusy,setLogoBusy]=useState(false);
  const logoRef=useRef(null);
  const [cal,setCal]=useState({connected:false,email:""});

  const loadCal=async()=>{
    const d=await api("/api/gcal/status").then(r=>r.json()).catch(()=>null);
    if(d) setCal(d);
  };
  useEffect(()=>{loadCal();},[]);
  useEffect(()=>{
    const onMsg=(e)=>{ if(e.data==="gcal-connected") loadCal(); };
    window.addEventListener("message",onMsg);
    return ()=>window.removeEventListener("message",onMsg);
  },[]);
  const connectCal=()=>{
    const w=window.open("/api/gcal/login?client_id="+(p?.client_id||p?.id||""),"gcal","width=520,height=640");
    if(!w) window.location.href="/api/gcal/login?client_id="+(p?.client_id||p?.id||"");
    const iv=setInterval(async()=>{
      const d=await api("/api/gcal/status").then(r=>r.json()).catch(()=>null);
      if(d){ setCal(d); if(d.connected) clearInterval(iv); }
    },4000);
    setTimeout(()=>clearInterval(iv),60000);
  };
  const disconnectCal=async()=>{
    await api("/api/gcal/status",{method:"DELETE"}).catch(()=>{});
    loadCal();
  };

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
        <Select wide value={form.business_type} onChange={v=>setForm({...form,business_type:v})} style={{marginBottom:12}}
          options={[{value:"ecommerce",label:BIZ_LABEL.ecommerce,icon:"ti-shopping-bag"},{value:"agency",label:BIZ_LABEL.agency,icon:"ti-briefcase"}]}/>
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
      {/* A shop counts products and orders; an agency counts knowledge files
          and bookings. Showing "Products 0" to a dental clinic was wrong. */}
      {p.business_type==="agency"
        ?<><Row k="Knowledge files" v={p.usage?.knowledge??0}/><Row k="Bookings" v={p.usage?.bookings??0}/></>
        :<><Row k="Products" v={p.usage?.products??0}/><Row k="Orders" v={p.usage?.orders??0}/></>}
      <Row k="Channels" v={p.usage?.channels??0}/>
      <div style={{height:16}}/>
      <Btn danger onClick={async()=>{await getSb().auth.signOut();setAuthToken("");location.reload();}} style={{width:"100%"}}><i className="ti ti-logout" style={{marginRight:6}}/>Logout</Btn>
    </Card>
    {p.business_type==="agency"&&<Card>
      <div style={{fontSize:14,fontWeight:600,marginBottom:6}}><i className="ti ti-calendar-event" style={{marginRight:6,color:T.gold}}/>Google Calendar</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>Connect your Google Calendar so the bot can check your availability, create meetings, and send Google Meet links to customers automatically.</div>
      {cal.connected?<>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <Badge color={T.success}>Connected</Badge>
          <span style={{fontSize:13,color:T.textMuted,overflow:"hidden",textOverflow:"ellipsis"}}>{cal.email}</span>
        </div>
        <Btn onClick={disconnectCal} style={{width:"100%"}}><i className="ti ti-plug-x" style={{marginRight:6}}/>Disconnect</Btn>
      </>:<Btn gold onClick={connectCal} style={{width:"100%"}}><i className="ti ti-brand-google" style={{marginRight:6}}/>Connect Google Calendar</Btn>}
    </Card>}
  </div>;
}
