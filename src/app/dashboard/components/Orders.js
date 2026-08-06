"use client";
import { useState } from "react";
import { T, Card, Btn, Badge } from "./ui.js";
import { api } from "./session.js";

// The Orders tab, moved out of dashboard-client.js unchanged.

export default function Orders({orders,refresh}) {
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
