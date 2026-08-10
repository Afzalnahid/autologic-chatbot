"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn, Badge, Accordion, Select } from "./ui.js";
import { api } from "./session.js";

// The Bookings tab, moved out of dashboard-client.js unchanged.


// meeting_date and meeting_time are whatever the bot wrote — "2026-08-06" in one
// row, "Tuesday, August 11th, 2026" in another. meeting_datetime is always a real
// timestamp, so everything reads from that and falls back only if it is missing.
const DHAKA = "Asia/Dhaka";

// Which inbox this came from. With four channels live, "who booked" is only half
// the answer — the owner needs to know where to reply.
const CH = {
  facebook:  { icon: "ti-brand-messenger",  label: "Messenger" },
  instagram: { icon: "ti-brand-instagram",  label: "Instagram" },
  whatsapp:  { icon: "ti-brand-whatsapp",   label: "WhatsApp" },
  website:   { icon: "ti-world",            label: "Website" },
};
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


// A month at a glance. Every booking already carries a real timestamp, so the
// grid is built from that — a dot for a meeting, a tick once it is done, a ring
// on today. Tapping a day filters the list below to that day.
function MonthGrid({ bookings, selected, onSelect }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [open, setOpen] = useState(false);
  const inner = useRef(null);
  const [h, setH] = useState(0);
  useEffect(() => { if (inner.current) setH(inner.current.scrollHeight); }, [open, cursor, bookings.length]);

  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = first.getDay();                       // Sunday-first, as Bangladesh reads it
  const todayKey = keyOf(new Date());

  // Group by day in Dhaka time, so a 4 PM meeting never lands on the wrong date.
  const byDay = {};
  bookings.forEach((b) => {
    if (!b.meeting_datetime) return;
    const d = new Date(b.meeting_datetime);
    if (isNaN(d)) return;
    const k = keyOf(d);
    (byDay[k] = byDay[k] || []).push(b);
  });

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(y, m, day));

  const monthName = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const shift = (n) => setCursor(new Date(y, m + n, 1));

  const total = bookings.filter(b=>b.meeting_datetime).length;
  const label = selected
    ? new Date(selected+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})
    : `${monthName} · ${total} meeting${total===1?"":"s"}`;

  return (
    <Card style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}>
      {/* Folded by default: a month grid is useful on demand, not permanently
          occupying the top half of a phone screen. */}
      <button onClick={()=>setOpen(v=>!v)} className="ui-btn"
        style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"12px 16px",
          background:"transparent", border:"none", cursor:"pointer", color:T.text, fontFamily:"inherit" }}>
        <i className="ti ti-calendar-month" style={{ fontSize:18, color:T.gold }}/>
        <span style={{ fontSize:13.5, fontWeight:600 }}>{label}</span>
        <i className="ti ti-chevron-down" style={{ marginLeft:"auto", fontSize:17, color:T.textDim,
          transform: open?"rotate(180deg)":"none", transition:"transform .22s cubic-bezier(.16,1,.3,1)" }}/>
      </button>

      <div style={{ height: open?h:0, overflow:"hidden", transition:"height .26s cubic-bezier(.16,1,.3,1)" }}>
        <div ref={inner} style={{ padding:"0 16px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Btn small onClick={() => shift(-1)} title="Previous month"><i className="ti ti-chevron-left"/></Btn>
        <div style={{ fontSize: 14.5, fontWeight: 600, flex: 1, textAlign: "center" }}>{monthName}</div>
        <Btn small onClick={() => shift(1)} title="Next month"><i className="ti ti-chevron-right"/></Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
        {["S","M","T","W","T","F","S"].map((d, i) =>
          <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 600, color: T.textDim,
            letterSpacing: .5, padding: "2px 0" }}>{d}</div>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, maxWidth: 340 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={"x"+i} />;
          const k = keyOf(d);
          const items = byDay[k] || [];
          const live = items.filter((b) => b.status === "Confirmed");
          const done = items.filter((b) => b.status === "Completed");
          const off  = items.filter((b) => b.status === "Cancelled");
          const isToday = k === todayKey;
          const isSel = k === selected;

          return (
            <button key={k} onClick={() => onSelect(isSel ? null : k)}
              className="ui-btn"
              style={{ position: "relative", aspectRatio: "1", minHeight: 32, maxHeight: 44, borderRadius: 8, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                background: isSel ? T.gold : items.length ? T.goldBg : "transparent",
                border: `1px solid ${isSel ? T.gold : isToday ? T.gold : "transparent"}`,
                color: isSel ? "#0A0D14" : items.length ? T.text : T.textDim,
                fontSize: 12.5, fontWeight: isToday || items.length ? 600 : 400, fontFamily: "inherit" }}>
              {d.getDate()}
              <span style={{ display: "flex", gap: 2, height: 6, alignItems: "center" }}>
                {done.length > 0 &&
                  <i className="ti ti-check" style={{ fontSize: 11, lineHeight: 1,
                    color: isSel ? "#0A0D14" : T.success }} />}
                {live.map((_, n) => n < 3 &&
                  <span key={n} style={{ width: 4, height: 4, borderRadius: "50%",
                    background: isSel ? "#0A0D14" : T.gold }} />)}
                {off.length > 0 && live.length === 0 && done.length === 0 &&
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: T.textDim }} />}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14, paddingTop: 12,
        borderTop: `1px solid ${T.border}`, fontSize: 11.5, color: T.textMuted }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold }} />Meeting booked</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-check" style={{ fontSize: 12, color: T.success }} />Done</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, border: `1px solid ${T.gold}` }} />Today</span>
      </div>
        </div>
      </div>
    </Card>
  );
}

// Day key in Dhaka time, so grouping matches what the owner sees on the clock.
function keyOf(d) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });   // YYYY-MM-DD
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
  const [chFilter,setChFilter]=useState("all");
  const [day,setDay]=useState(null);

  const load=async()=>{
    setLoading(true);
    // The timestamp makes every request unique, so no cache anywhere can answer it.
    const d=await api(`/api/bookings/list?t=${Date.now()}`).then(r=>r.json()).catch(()=>null);
    // The new endpoint answers with an object so an empty list and a failed
    // request stop looking identical.
    if(d&&Array.isArray(d.bookings)) setBookings(d.bookings);
    else if(Array.isArray(d)) setBookings(d);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  // The list used to load once and then sit there, so a booking made while the
  // tab was open never appeared — it looked like the booking had failed. Reload
  // whenever the tab comes back into view, and every couple of minutes.
  useEffect(()=>{
    const onFocus=()=>{ if(document.visibilityState==="visible") load(); };
    document.addEventListener("visibilitychange",onFocus);
    window.addEventListener("focus",onFocus);
    const t=setInterval(()=>{ if(document.visibilityState==="visible") load(); },120000);
    return ()=>{
      document.removeEventListener("visibilitychange",onFocus);
      window.removeEventListener("focus",onFocus);
      clearInterval(t);
    };
  },[]);
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

  const byDay = day ? bookings.filter(b=>b.meeting_datetime&&keyOf(new Date(b.meeting_datetime))===day) : bookings;
  const byCh = chFilter==="all"?byDay:byDay.filter(b=>b.platform===chFilter);
  const filtered = (filter==="All"?byCh:byCh.filter(b=>b.status===filter))
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
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <Btn small onClick={load} disabled={loading}>
        <i className="ti ti-refresh" style={{marginRight:5}}/>{loading?"Refreshing":"Refresh"}
      </Btn>
      <span style={{fontSize:12,color:T.textDim}}>{bookings.length} booking{bookings.length===1?"":"s"}</span>
    </div>
    {bookings.length>0&&<MonthGrid bookings={bookings} selected={day} onSelect={setDay}/>}

    {day&&<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"9px 13px",
      borderRadius:10,background:T.goldBg,border:`1px solid ${T.gold}`,fontSize:13}}>
      <i className="ti ti-calendar-event" style={{color:T.gold}}/>
      Showing {new Date(day+"T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
      <button onClick={()=>setDay(null)} className="ui-btn" style={{marginLeft:"auto",background:"transparent",
        border:"none",color:T.gold,cursor:"pointer",fontSize:12.5,fontWeight:600}}>Show all</button>
    </div>}

    {bookings.length>0&&<div style={{marginBottom:14,maxWidth:260}}>
      <Select value={chFilter} onChange={setChFilter}
        options={[{value:"all",label:`All channels (${bookings.length})`,icon:"ti-inbox"},
          ...Object.entries(CH)
            .filter(([k])=>bookings.some(b=>b.platform===k))
            .map(([k,v])=>({value:k,label:`${v.label} (${bookings.filter(b=>b.platform===k).length})`,icon:v.icon}))]}/>
    </div>}
    <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>{sts.map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,background:filter===s?T.gold:"rgba(240,192,64,0.08)",color:filter===s?"#0a0a0a":T.textMuted}}>{s}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {loading?<Card style={{textAlign:"center",color:T.textDim,padding:30}}>Loading...</Card>:filtered.length===0?<Card style={{textAlign:"center",color:T.textDim,padding:40}}>No bookings yet</Card>:filtered.map(b=><Card key={b.id}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div style={{minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:14,fontWeight:600}}>{b.customer_name||"—"}</span>
              {b.platform&&<span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,
                fontWeight:600,padding:"3px 9px",borderRadius:6,background:T.goldBg,color:T.gold}}>
                <i className={`ti ${CH[b.platform]?.icon||"ti-message"}`} style={{fontSize:13}}/>
                {CH[b.platform]?.label||b.platform}
              </span>}
            </div>
            {b.service_want&&<div style={{fontSize:12.5,color:T.textMuted,marginTop:3}}>{b.service_want}</div>}
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
