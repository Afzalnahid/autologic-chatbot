"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn, Inp, Badge, Select } from "./ui.js";
import { api, getSb, setAuthToken, apiJson } from "./session.js";
import PushToggle from "./PushToggle.js";

// The Profile tab, moved out of dashboard-client.js unchanged.

// Label left, value right. A long value (an address, a website) used to crowd
// the label until the two ran together, so the label never shrinks, the value
// wraps inside its own column, and both align to the top of the row.
function Row({k,v}) {
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:18,
    padding:"11px 0",borderBottom:`0.5px solid ${T.border}`,fontSize:13,lineHeight:1.6}}>
    <span style={{color:T.textMuted,flexShrink:0,whiteSpace:"nowrap"}}>{k}</span>
    <span style={{minWidth:0,textAlign:"right",wordBreak:"break-word",overflowWrap:"anywhere"}}>{v}</span>
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

  // The package this account runs on: name, expiry and live limits from
  // /api/billing (the same numbers the bot enforces), and the feature list
  // from the public catalogue so the owner sees what their plan includes.
  const [bill,setBill]=useState(null);
  const [features,setFeatures]=useState([]);
  useEffect(()=>{(async()=>{
    const b=await api("/api/billing").then(r=>r.json()).catch(()=>null);
    if(b&&!b.error){
      setBill(b);
      const pl=await fetch("/api/plans").then(r=>r.json()).catch(()=>null);
      const f=pl?.plans?.find(x=>x.id===b.plan)?.features;
      if(Array.isArray(f)&&f.length) setFeatures(f);
    }
  })();},[]);

  const uploadLogo=async(file)=>{
    if(!file) return;
    setLogoBusy(true);
    const fd=new FormData(); fd.append("logo",file);
    const r=await apiJson("/api/profile-logo",{method:"POST",body:fd});
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
    const r=await apiJson("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    setSaving(false);
    if(r.error){setMsg("Failed: "+r.error);return;}
    await load();
    setEditing(false);
    setMsg("");
  };

  if(loadErr) return <Card style={{color:T.textDim}}>Could not load profile.<Btn gold onClick={()=>load(0)} style={{marginLeft:10}}>Retry</Btn></Card>;
  if(!p) return <Card style={{color:T.textDim}}>Loading...</Card>;
  const planColor=p.plan==="pro"?T.success:p.plan==="trial"?T.gold:T.textDim;

  return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(280px,100%),1fr))",gap:16,alignItems:"start"}}>
    <PushToggle/>
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
      <Row k="Plan" v={<Badge color={planColor}>{bill?.plan_name||p.plan}</Badge>}/>
      {p.plan==="trial"&&p.trial_end&&<Row k="Trial ends" v={new Date(p.trial_end).toLocaleDateString()}/>}
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
      <Btn danger onClick={async()=>{await getSb().auth.signOut({scope:"local"});try{localStorage.removeItem("gv_app_signed_in");}catch{} setAuthToken("");location.reload();}} style={{width:"100%"}}><i className="ti ti-logout" style={{marginRight:6}}/>Logout</Btn>
    </Card>
    <Card>
      <div style={{fontSize:14,fontWeight:600,marginBottom:6}}><i className="ti ti-package" style={{marginRight:6,color:T.gold}}/>Your package</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>What this account runs on — the same limits the bot enforces.</div>
      {!bill?<div style={{fontSize:13,color:T.textDim}}>Loading…</div>:<>
        <Row k="Package" v={<Badge color={bill.active?T.success:T.danger}>{bill.plan_name||bill.plan}</Badge>}/>
        <Row k="Status" v={<span style={{color:bill.active?T.success:T.danger,fontWeight:600}}>{bill.active?"Active":"Expired"}</span>}/>
        {bill.plan==="trial"&&bill.trial_end&&<Row k="Trial ends" v={new Date(bill.trial_end).toLocaleDateString()}/>}
        {bill.plan!=="trial"&&bill.plan_expires_at&&<Row k="Valid until" v={new Date(bill.plan_expires_at).toLocaleDateString()}/>}
        <Row k="Messages today" v={`${bill.usage?.today??0}${bill.usage?.daily_limit?` / ${bill.usage.daily_limit}`:""}`}/>
        <Row k="Messages this month" v={`${bill.usage?.month??0}${bill.usage?.monthly_limit?` / ${bill.usage.monthly_limit}`:" · unlimited"}`}/>
        {features.length>0&&<>
          <div style={{fontSize:12.5,fontWeight:600,margin:"14px 0 8px"}}>What's included</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:4}}>
            {features.map((f,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:12.5,color:T.textMuted,lineHeight:1.5}}>
              <i className="ti ti-check" style={{color:T.success,fontSize:14,marginTop:2,flexShrink:0}}/>{f}
            </div>)}
          </div>
        </>}
        <div style={{height:14}}/>
        <Btn gold style={{width:"100%"}} onClick={()=>window.dispatchEvent(new CustomEvent("al-goto",{detail:"billing"}))}>
          <i className="ti ti-arrow-up-circle" style={{marginRight:6}}/>{bill.plan==="trial"?"Choose a package":"Manage / upgrade package"}
        </Btn>
      </>}
    </Card>
  </div>;
}
