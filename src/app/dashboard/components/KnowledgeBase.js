"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn } from "./ui.js";
import { api } from "./session.js";

// The KnowledgeBase tab, moved out of dashboard-client.js unchanged.

export default function KnowledgeBase() {
  const [files,setFiles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [uploading,setUploading]=useState(false);
  const [msg,setMsg]=useState("");
  const fileRef=useRef(null);

  const load=async()=>{
    setLoading(true);
    const d=await api("/api/knowledge").then(r=>r.json()).catch(()=>[]);
    if(Array.isArray(d)) setFiles(d);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const upload=async(file)=>{
    if(!file) return;
    setUploading(true); setMsg("Uploading and analyzing "+file.name+"...");
    const fd=new FormData(); fd.append("file",file);
    const r=await api("/api/knowledge",{method:"POST",body:fd}).then(r=>r.json()).catch(()=>({error:"network"}));
    setUploading(false);
    if(r.error){setMsg("Failed: "+r.error);}
    else {setMsg(`Added ${file.name} — ${r.chunks} chunks indexed`); load();}
    if(fileRef.current) fileRef.current.value="";
  };

  const del=async(file_id)=>{
    await api("/api/knowledge",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({file_id})});
    load();
  };

  return <div>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv" hidden onChange={e=>{upload(e.target.files[0]);}}/>
      <Btn gold onClick={()=>fileRef.current?.click()} disabled={uploading}><i className="ti ti-upload" style={{marginRight:6}}/>{uploading?"Uploading...":"Upload document"}</Btn>
      <Btn onClick={load}><i className="ti ti-refresh" style={{marginRight:6}}/>Refresh</Btn>
    </div>
    <div style={{fontSize:11.5,color:T.textMuted,marginBottom:12}}>Upload PDF, Word (DOCX) or text files. Their content becomes your bot's knowledge base — the bot answers customer questions using only this information.</div>
    {msg&&<div style={{fontSize:12,color:msg.startsWith("Failed")?T.danger:T.success,marginBottom:12}}>{msg}</div>}
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {loading?<Card style={{textAlign:"center",color:T.textDim,padding:30}}>Loading...</Card>:files.length===0?<Card style={{textAlign:"center",color:T.textDim,padding:40}}>No documents yet. Upload your first file to build the knowledge base.</Card>:files.map(f=><Card key={f.file_id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
          <i className={`ti ${/pdf/i.test(f.file_type||"")?"ti-file-type-pdf":/word|docx?/i.test(f.file_type||f.file_name||"")?"ti-file-type-docx":"ti-file-text"}`} style={{fontSize:24,color:T.gold,flexShrink:0}}/>
          <div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.file_name}</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{f.chunks||0} chunks indexed</div></div>
        </div>
        <button onClick={()=>del(f.file_id)} title="Delete" style={{background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:18,padding:4,flexShrink:0}}><i className="ti ti-trash"/></button>
      </Card>)}
    </div>
  </div>;
}
