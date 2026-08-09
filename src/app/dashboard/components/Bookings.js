"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Badge, Accordion } from "./ui.js";
import { api } from "./session.js";

// The Bookings tab, moved out of dashboard-client.js unchanged.


// meeting_date and meeting_time are whatever the bot wrote — "2026-08-06" in one
// row, "Tuesday, August 11th, 2026" in another. meeting_datetime is always a real
// timestamp, so everything reads from that and falls back only if it is missing.
const DHAKA = "Asia/Dhaka";
function when(b) {
  const raw = b.meeting_datetime;
  if (!raw) return { text: [b.meeting_date, b.meeting_time].filter(Boolean).join(" ") || "—", ts: 0 };
  const d = new Date(raw);
  if (isNaN(d)) return { text: [b.meeting_date, b.meeting_time].filter(Boolean).join(" ") || "—", ts: 0 };
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: DHAKA });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DHAKA });
  return { text: `${day} · ${time}`, ts: d.getTime() };
}
function group(ts) {
  if (!ts) return "later";
  const now = Date.now();
  if (ts < now) return "past";
  const end = new Date(); end.setHours(23, 59, 59, 999);
  if (ts <= end.getTime()) return "today";
  if (ts <= now + 7 * 864e5) return "week";
  return "later";
}

export default function Bookings({calConnected,clientId}) {
  const [bookings,setBookings]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("All");
  // Ask the calendar itself rather than trusting a flag /api/me never sends.
  // The prop is kept only as a first guess while the check is in flight.
  const [calOk,setCalOk]=useState(!!calConnected);
  const [calEmail,setCalEmail]=useState("");
  const [note,setNote]=useState("");

  // Cancelling reaches Google as well, so the customer's invitation disappears
  // instead of leaving them waiting on a Meet link.
  const cancel=async(b)=>{
    const inCal=!!b.calendar_event_id;
    if(!confirm(inCal
      ? "Cancel this booking?\n\nThe event will be removed from your Google Calendar and the customer will be told by Google."
      : "Cancel this booking?")) return;
    const r=await api("/api/bookings",{method:"PUT",body:JSON.stringify({id:b.id,status:"Cancelled"})})
      .then(x=>x.json()).catch(()=>null);
    setNote(r?.calendar==="failed"
      ? "Booking cancelled, but the calendar event could not be removed — please delete it in Google Calendar."
      : r?.calendar ? "Booking cancelled and removed from your calendar." : "Booking cancelled.");
    load();
    setTimeout(()=>setNote(""),6000);
  };
  const sts=["All","Confirmed","Completed","Cancelled"];

  const load=async()=>{
    setLoading(true);
    const d=await api("/api/bookings").then(r=>r.json()).catch(()=>[]);
    if(Array.isArray(d)) setBookings(d);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      const d=await api("/api/gcal/status").then(r=>r.json()).catch(()=>null);
      if(alive&&d){ setCalOk(!!d.connected); setCalEmail(d.email||""); }
    })();
    return ()=>{alive=false;};
  },[calConnected]);
  const update=async(id,status)=>{await api("/api/bookings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})}); load();};

  const connectCal=()=>{
    const w=window.open(`/api/gcal/login?client_id=${clientId}`,"gcal","width=520,height=640");
    if(!w) window.location.href=`/api/gcal/login?client_id=${clientId}`;
    const h=async e=>{if(e.data==="gcal-connected"){window.removeEventListener("message",h);const d=await api("/api/gcal/status").then(r=>r.json()).catch(()=>null);setCalOk(d?!!d.connected:true);setCalEmail(d?.email||"");}};
    window.addEventListener("message",h);
  };

  const filtered = (filter==="All"?bookings:bookings.filter(b=>b.status===filter))
    .map(b=>({...b,_w:when(b)}))
    .sort((a,c)=>{
      const ap=a._w.ts<Date.now(), cp=c._w.ts<Date.now();
      if(ap!==cp) return ap?1:-1;          // upcoming first, past below
      return ap ? c._w.ts-a._w.ts : a._w.ts-c._w.ts;
    });
  return <div>
    {!calOk&&<Card style={{background:`color-mix(in srgb, ${T.gold} 5%, transparent)`,border:`1px solid color-mix(in srgb, ${T.gold} 21%, transparent)`,marginBottom:16,display:"flex",alignItems:"center",gap:12,padding:"12px 16px",flexWrap:"wrap"}}>
      <i className="ti ti-calendar-exclamation" style={{fontSize:22,color:T.gold,flexShrink:0}}/>
      <div style={{flex:1,minWidth:180}}>
        <div style={{fontSize:13,fontWeight:600,color:T.gold}}>Google Calendar not connected</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Bookings are saved but Meet links won't be generated until you connect.</div>
      </div>
      <Btn gold small onClick={connectCal}><i className="ti ti-brand-google" style={{marginRight:5}}/>Connect now</Btn>
    </Card>}

    {/* Written for someone doing this for the first time, on a phone, who has
        never seen an OAuth screen. Step 3 is the one that stops people: Google
        shows a warning for apps it has not finished reviewing, and without
        being told what to do there, most people close the window. */}
    {calOk&&calEmail&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,fontSize:12.5,color:T.textMuted}}>
      <i className="ti ti-circle-check" style={{color:T.success,fontSize:15}}/>
      Calendar connected · <span style={{color:T.text}}>{calEmail}</span>
    </div>}
    {!calOk&&<Accordion icon="ti-help-circle" title="How to connect your calendar"
      subtitle="Takes about a minute — nothing to install">
      <ol style={{margin:0,paddingLeft:20,fontSize:13.5,lineHeight:1.85,color:T.textMuted}}>
        <li><b style={{color:T.text}}>Press “Connect now”.</b> A Google window opens. If nothing appears, your
          browser blocked the pop-up — allow pop-ups for this site and press again.</li>
        <li><b style={{color:T.text}}>Choose the Google account</b> that owns the calendar you take meetings in.
          Use the business account, not a personal one you do not check.</li>
        <li><b style={{color:T.text}}>If Google warns that the app is not verified</b>, press
          <i style={{color:T.text}}> Advanced</i> then <i style={{color:T.text}}>Go to Autologic</i>.
          The warning appears because our Google review is still in progress. Nothing is wrong with your account.</li>
        <li><b style={{color:T.text}}>Press Continue</b> on the permissions screen. Autologic asks for two things
          only: to see when you are free, and to create meetings for you.</li>
        <li><b style={{color:T.text}}>The window closes by itself.</b> This banner disappears and the bot starts
          offering real times to customers.</li>
      </ol>

      <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
        <div style={{fontSize:12.5,fontWeight:600,color:T.text,marginBottom:8}}>If something goes wrong</div>
        <ul style={{margin:0,paddingLeft:20,fontSize:13,lineHeight:1.8,color:T.textMuted}}>
          <li>Nothing happened — the pop-up was blocked. Allow pop-ups, or open this page on a computer.</li>
          <li>Wrong account connected — press Connect again and pick the right one. The old one is replaced.</li>
          <li>You want to disconnect — remove Autologic from your Google account at
            <span style={{color:T.gold}}> myaccount.google.com → Security → Third-party access</span>. Bookings keep
            working, but Meet links stop.</li>
        </ul>
      </div>

      <div style={{marginTop:14,fontSize:12,color:T.textDim,lineHeight:1.7}}>
        <i className="ti ti-lock" style={{marginRight:5}}/>
        Autologic never reads what is in your meetings — only whether a slot is free, and it only writes
        the bookings your customers make. <a href="/google-calendar" target="_blank" rel="noopener"
        style={{color:T.gold}}>What we access and why</a>
      </div>
    </Accordion>}
    {note&&<div style={{marginBottom:14,padding:"11px 14px",borderRadius:10,fontSize:13,
      background:T.goldBg,border:`1px solid ${T.gold}`,color:T.text}}>{note}</div>}
    <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>{sts.map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,background:filter===s?T.gold:"rgba(240,192,64,0.08)",color:filter===s?"#0a0a0a":T.textMuted}}>{s}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {loading?<Card style={{textAlign:"center",color:T.textDim,padding:30}}>Loading...</Card>:filtered.length===0?<Card style={{textAlign:"center",color:T.textDim,padding:40}}>No bookings yet</Card>:filtered.map(b=><Card key={b.id}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600}}>{b.customer_name||"—"} <span style={{fontSize:12,color:T.textMuted,fontWeight:400}}>· {b.service_want||""}</span></div>
            <div style={{fontSize:12.5,color:T.text,marginTop:5,fontWeight:500}}>
              <i className="ti ti-calendar" style={{marginRight:5,color:T.gold}}/>{b._w.text}
              {group(b._w.ts)==="today"&&b.status==="Confirmed"&&
                <span style={{marginLeft:8,fontSize:10.5,fontWeight:700,letterSpacing:.6,color:T.gold,
                  background:T.goldBg,padding:"2px 7px",borderRadius:5}}>TODAY</span>}
              {group(b._w.ts)==="past"&&b.status==="Confirmed"&&
                <span style={{marginLeft:8,fontSize:10.5,fontWeight:700,letterSpacing:.6,color:T.warn}}>TIME PASSED</span>}
            </div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}><i className="ti ti-mail" style={{marginRight:4}}/>{b.email||"—"} · <i className="ti ti-phone" style={{margin:"0 4px"}}/>{b.phone||"—"}</div>
            {b.meeting_link
              ? <a href={b.meeting_link} target="_blank" rel="noreferrer" className="ui-btn"
                  style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:10,padding:"8px 13px",
                    borderRadius:9,background:T.goldBg,border:`1px solid ${T.gold}`,color:T.gold,
                    fontSize:12.5,fontWeight:600,textDecoration:"none"}}>
                  <i className="ti ti-video"/>Join meeting
                </a>
              : b.status==="Confirmed"&&<div style={{fontSize:11.5,color:T.textDim,marginTop:8}}>
                  <i className="ti ti-video-off" style={{marginRight:4}}/>No Meet link — booked before the calendar was connected
                </div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0}}>
            <Badge color={b.status==="Confirmed"?T.success:b.status==="Completed"?T.info:T.danger}>{b.status}</Badge>
            {b.status==="Confirmed"&&<Btn small onClick={()=>update(b.id,"Completed")}>Mark done</Btn>}
            {b.status==="Confirmed"&&<Btn small danger onClick={()=>cancel(b)}>Cancel</Btn>}
          </div>
        </div>
      </Card>)}
    </div>
  </div>;
}
