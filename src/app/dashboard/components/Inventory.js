"use client";
import { useState, useRef } from "react";
import { T, Card, Btn, Inp, Badge } from "./ui.js";
import { api } from "./session.js";

// The Inventory tab, moved out of dashboard-client.js unchanged.

export default function Inventory({products,refresh}) {
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
        <tbody>{filtered.map(p=><tr key={p.id} style={{borderBottom:`0.5px solid color-mix(in srgb, ${T.border} 3%, transparent)`}}>
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
