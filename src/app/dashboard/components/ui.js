"use client";
import { useState, useEffect } from "react";

// Shared presentational building blocks. Each tab imports from here, so the
// design tokens have exactly one definition.

// Design tokens. Every component reads from here, so the whole surface
// re-skins by editing this object alone. Key names are kept from the previous
// palette so no component needs touching; `gold` is now the periwinkle
// primary, and the amber it used to hold lives on in `warn`.
export const T = {
  bg: "#0A0D14", bgAlt: "#0D1119", card: "#0F1420", cardAlt: "#151B2A", inset: "#1C2436",
  gold: "#5B8CFF", goldDim: "#3D6FE0", goldBg: "rgba(91,140,255,0.12)",
  text: "#E7EAF2", textMuted: "#98A3BA", textDim: "#5E6B85",
  border: "#1F2839", borderStrong: "#2C374D",
  danger: "#FF5A5F", success: "#2ED3A7", info: "#5B8CFF", warn: "#F0B429", purple: "#8b5cf6",
  live: "#2ED3A7", liveBg: "rgba(46,211,167,0.11)", warnBg: "rgba(240,180,41,0.11)", dangerBg: "rgba(255,90,95,0.11)",
};

export const ITEM_WORDS = { ecommerce:{item:"Product",inv:"Inventory",order:"Orders"}, agency:{item:"Service",inv:"Services",order:"Inquiries"}, other:{item:"Item",inv:"Catalog",order:"Requests"} };
export function words(bt){ return ITEM_WORDS[bt] || ITEM_WORDS.other; }

export function useIsMobile(){
  const [m,setM]=useState(false);
  useEffect(()=>{
    const check=()=>setM(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);
  return m;
}

export function Btn({children,gold,danger,small,style,...p}){ return <button {...p} style={{padding:small?"6px 14px":"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:small?12:13,fontWeight:500,background:danger?T.danger:gold?T.gold:"rgba(240,192,64,0.12)",color:danger?"#fff":gold?"#0a0a0a":T.gold,...style}}>{children}</button>; }
export function Badge({children,color=T.gold}){ return <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,background:`${color}18`,color}}>{children}</span>; }
export function Card({children,style,...p}){ return <div {...p} style={{background:T.card,borderRadius:12,border:`0.5px solid ${T.border}`,padding:"1.25rem",...style}}>{children}</div>; }
export function Inp({label,textarea,style,inputStyle,...p}){ return <div style={{marginBottom:16,...style}}>{label&&<label style={{display:"block",fontSize:12,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{label}</label>}{textarea?<textarea {...p} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,resize:"vertical",minHeight:100,outline:"none",fontFamily:"inherit",boxSizing:"border-box",...inputStyle}}/>:<input {...p} style={{width:"100%",background:T.bgAlt,border:`0.5px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",...inputStyle}}/>}</div>; }

// Plan catalogue and formatting used by several tabs.
export const PLAN_META={
  trial:{name:"Free Trial",color:T.info},
  starter:{name:"Starter",color:T.success},
  pro:{name:"Pro",color:T.gold},
  agency:{name:"Agency",color:T.purple},
  none:{name:"No plan",color:T.textDim},
};
export const PLAN_LIST=[
  {id:"starter",name:"Starter",monthly:1500,yearly:15000,tagline:"For small shops getting started",
   features:["3,000 messages / month","1 channel","AI replies in Bangla & English","Product catalogue & orders","Analytics dashboard"]},
  {id:"pro",name:"Pro",monthly:3500,yearly:35000,highlight:true,tagline:"For growing businesses",
   features:["15,000 messages / month","All 3 channels","Photo product matching","Knowledge Base upload","Voice messages","Everything in Starter"]},
  {id:"agency",name:"Agency",monthly:6000,yearly:60000,tagline:"For service providers & agencies",
   features:["Unlimited messages","Google Calendar booking","Automatic Meet links","Priority support","Everything in Pro"]},
];
export const taka=n=>"\u09F3"+Number(n||0).toLocaleString("en-IN");
export const shortDate=d=>d?new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"—";
