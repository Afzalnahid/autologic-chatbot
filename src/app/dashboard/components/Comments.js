"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Badge } from "./ui.js";
import { api } from "./session.js";

// The Comments tab, moved out of dashboard-client.js unchanged.

export default function Comments() {
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("All");

  const load=async()=>{
    setLoading(true);
    const d=await api("/api/comments").then(r=>r.json()).catch(()=>[]);
    if(Array.isArray(d)) setRows(d);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  // Removes the record from the dashboard only — the comment itself stays on
  // Facebook or Instagram. Clients need this to clear failed or test entries.
  const remove=async(id)=>{
    if(!confirm("Remove this comment from your dashboard? It will stay on Facebook.")) return;
    setRows(rs=>rs.filter(r=>r.id!==id));
    try{ await api(`/api/comments?id=${encodeURIComponent(id)}`,{method:"DELETE"}); }
    catch{ load(); }
  };

  const dmFailed = rows.filter(r=>r.dm_error).length;
  const filters=["All","Replied","Sent to inbox","Needs attention"];
  const filtered = rows.filter(r=>{
    if(filter==="Replied") return r.replied;
    if(filter==="Sent to inbox") return r.dm_sent;
    if(filter==="Needs attention") return r.reply_error||r.dm_error;
    return true;
  });

  const ago=(t)=>{
    const d=Math.floor((Date.now()-new Date(t))/1000);
    if(d<60) return "just now";
    if(d<3600) return Math.floor(d/60)+"m ago";
    if(d<86400) return Math.floor(d/3600)+"h ago";
    return Math.floor(d/86400)+"d ago";
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:16,fontWeight:600}}>Post comments</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Comments on your Facebook posts and how the bot handled them</div>
      </div>
      <Btn small onClick={load}><i className="ti ti-refresh" style={{marginRight:5}}/>Refresh</Btn>
    </div>

    {dmFailed>0&&<Card style={{marginBottom:14,borderColor:`color-mix(in srgb, ${T.danger} 25%, transparent)`,background:`color-mix(in srgb, ${T.danger} 5%, transparent)`}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <i className="ti ti-alert-triangle" style={{fontSize:17,color:T.danger,flexShrink:0,marginTop:1}}/>
        <div style={{fontSize:12.5,lineHeight:1.6}}>
          <strong>{dmFailed} inbox message{dmFailed>1?"s":""} could not be delivered.</strong> Facebook blocks a private reply when the
          comment came from a Page instead of a personal profile, when the person's privacy settings disallow it, when one was already
          sent for that comment, or when the comment is over 7 days old. The reason for each is shown below.
        </div>
      </div>
    </Card>}

    <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
      {filters.map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,background:filter===f?T.gold:T.goldBg,color:filter===f?"#0a0a0a":T.textMuted}}>{f}</button>)}
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {loading?<Card style={{textAlign:"center",color:T.textDim,padding:30}}>Loading...</Card>
      :filtered.length===0?<Card style={{textAlign:"center",color:T.textDim,padding:40}}>
        {rows.length===0?"No comments yet. When someone comments on your Facebook post, it will appear here.":"Nothing matches this filter"}
      </Card>
      :filtered.map(c=><Card key={c.id}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600}}>{c.commenter_name||"Someone"}</div>
            <div style={{fontSize:11.5,color:T.textDim,marginTop:1}}><i className="ti ti-brand-facebook" style={{marginRight:4}}/>{ago(c.created_at)}</div>
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <Badge color={c.replied?T.success:T.textDim}>{c.replied?"Replied":"Not replied"}</Badge>
            <Badge color={c.dm_sent?T.success:(c.dm_error?T.danger:T.textDim)}>{c.dm_sent?"Sent to inbox":(c.dm_error?"Inbox failed":"No inbox msg")}</Badge>
            <button onClick={()=>remove(c.id)} title="Remove from dashboard" style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,padding:"2px 4px",fontSize:15,lineHeight:1}}><i className="ti ti-trash"/></button>
          </div>
        </div>

        <div style={{background:T.bgAlt,borderRadius:9,padding:"10px 12px",marginBottom:10,border:`0.5px solid ${T.border}`}}>
          <div style={{fontSize:11,color:T.textDim,marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>Their comment</div>
          <div style={{fontSize:13.5,lineHeight:1.55}}>{c.comment_text||<span style={{color:T.textDim}}>(no text — photo or sticker)</span>}</div>
        </div>

        {c.reply_text&&<div style={{background:`color-mix(in srgb, ${T.gold} 5%, transparent)`,borderRadius:9,padding:"10px 12px",border:`0.5px solid color-mix(in srgb, ${T.gold} 15%, transparent)`}}>
          <div style={{fontSize:11,color:T.gold,marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>Bot reply</div>
          <div style={{fontSize:13.5,lineHeight:1.55}}>{c.reply_text}</div>
        </div>}

        {(c.reply_error||c.dm_error)&&<div style={{marginTop:10,fontSize:12,color:T.danger,lineHeight:1.55}}>
          {c.reply_error&&<div><i className="ti ti-alert-circle" style={{marginRight:5}}/>Public reply: {c.reply_error}</div>}
          {c.dm_error&&<div><i className="ti ti-alert-circle" style={{marginRight:5}}/>Inbox message: {c.dm_error}</div>}
        </div>}
      </Card>)}
    </div>
  </div>;
}
