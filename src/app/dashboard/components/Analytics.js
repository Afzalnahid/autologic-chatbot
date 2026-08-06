"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Badge, words, KStat, Spark, BarList, fmtNum, fmtMoney } from "./ui.js";
import { api } from "./session.js";

// The Analytics tab, moved out of dashboard-client.js unchanged.

export default function Analytics({isAgency}) {
  const [days,setDays]=useState(30);
  const [d,setD]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");

  const load=useCallback(async(silent)=>{
    if(!silent) setLoading(true);
    try{
      const res=await api(`/api/analytics?days=${days}&t=${Date.now()}`,{cache:"no-store"});
      const j=await res.json();
      if(j.error) setErr(j.error); else {setD(j);setErr("");}
    }catch{setErr("Could not load analytics");}
    setLoading(false);
  },[days]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{const t=setInterval(()=>load(true),60000);return()=>clearInterval(t);},[load]);

  if(loading&&!d) return <div style={{padding:40,textAlign:"center",color:T.textMuted,fontSize:13}}>Loading analytics...</div>;
  if(err&&!d) return <Card style={{textAlign:"center",color:T.textDim,padding:40}}>{err}</Card>;
  if(!d) return null;

  const k=d.kpi, g=d.growth, c=d.conversations;
  const fmtDay=s=>{const p=String(s).split("-");return `${p[2]}/${p[1]}`;};
  const first=d.daily[0]?.date, last=d.daily[d.daily.length-1]?.date;
  const noData=k.total_messages===0;
  const PICON={facebook:"ti-brand-facebook",instagram:"ti-brand-instagram",whatsapp:"ti-brand-whatsapp"};
  const PNAME={facebook:"Facebook",instagram:"Instagram",whatsapp:"WhatsApp"};
  const PCOLOR={facebook:"#3b82f6",instagram:"#e1306c",whatsapp:"#25d366"};
  const maxCh=Math.max(1,...d.channels.map(x=>x.total));
  const maxHr=Math.max(1,...d.hours.map(h=>h.count));
  const hourLabel=h=>{const a=h<12?"AM":"PM";const hh=h%12===0?12:h%12;return `${hh}${a}`;};
  const totalCust=k.unique_contacts||0;
  const newPct=totalCust?Math.round((k.new_contacts/totalCust)*100):0;
  const SCOLOR={Pending:T.warn,Shipped:T.info,Delivered:T.success,Cancelled:T.danger,confirmed:T.success};

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
      {[7,30,90].map(n=><button key={n} onClick={()=>setDays(n)} style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:500,background:days===n?T.gold:T.card,color:days===n?"#0a0a0a":T.textMuted}}>{n} days</button>)}
      <span style={{fontSize:11,color:T.textDim,marginLeft:"auto"}}>vs previous {days} days · updated {new Date(d.generated_at).toLocaleTimeString()}</span>
    </div>

    {noData&&<Card style={{marginBottom:18,textAlign:"center",padding:"28px 20px"}}>
      <i className="ti ti-chart-line" style={{fontSize:30,color:T.textDim}}/>
      <div style={{fontSize:14,fontWeight:500,marginTop:10}}>No activity in this period</div>
      <div style={{fontSize:12.5,color:T.textMuted,marginTop:5}}>Connect a channel and start receiving customer messages — your analytics will appear here.</div>
    </Card>}

    {/* KPI row */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(158px,1fr))",gap:12,marginBottom:16}}>
      <KStat icon="ti-messages" label="Messages" value={fmtNum(k.total_messages)} sub={`${k.messages_today} today`} color={T.info} trend={g.messages}/>
      <KStat icon="ti-users" label="Customers" value={fmtNum(k.unique_contacts)} sub={`${k.new_contacts} new · ${k.returning_contacts} returning`} color={T.success} trend={g.contacts}/>
      <KStat icon="ti-message-2" label="Conversations" value={fmtNum(c.total)} sub={`${c.avg_messages} msgs each`} color={T.purple} trend={g.conversations}/>
      <KStat icon="ti-robot" label="Bot resolved" value={c.bot_resolved_pct===null?"—":`${c.bot_resolved_pct}%`} sub={`${c.handoff} needed a human`} color={T.gold} trend={g.bot_handled_points} trendUnit="pp"/>
      {isAgency
        ? <KStat icon="ti-calendar-event" label="Bookings" value={fmtNum(k.bookings)} sub={k.conversion_pct===null?"no data":`${k.conversion_pct}% of customers`} color={T.gold} trend={g.conversions}/>
        : <KStat icon="ti-cash" label="Revenue" value={fmtMoney(k.revenue)} sub={`${k.orders} orders · avg ${fmtMoney(k.avg_order_value)}`} color={T.gold} trend={g.revenue}/>}
    </div>

    {/* Volume */}
    <Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:500}}>Message volume</div>
        <div style={{display:"flex",gap:14,fontSize:11.5,color:T.textMuted}}>
          <span><span style={{display:"inline-block",width:9,height:2.5,background:T.gold,marginRight:5,verticalAlign:"middle"}}/>Customers ({fmtNum(k.customer_messages)})</span>
          <span><span style={{display:"inline-block",width:9,height:2.5,background:T.info,marginRight:5,verticalAlign:"middle"}}/>Bot ({fmtNum(k.bot_messages)})</span>
        </div>
      </div>
      <Spark data={d.daily} keys={["customer","bot"]} colors={[T.gold,T.info]} labels={[fmtDay(first),fmtDay(last)]}/>
    </Card>

    {/* Conversation health + customer mix */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Conversation health</div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:16}}>How well the bot is handling customers on its own</div>
        {[
          {label:"Handled by bot alone",value:c.bot_resolved,color:T.success},
          {label:"Needed a human agent",value:c.handoff,color:T.warn},
          {label:"Never answered",value:c.unanswered,color:T.danger},
        ].map((r,i)=>{const pct=c.total?Math.round((r.value/c.total)*100):0;return <div key={i} style={{marginBottom:13}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:5}}>
            <span style={{color:T.textMuted}}>{r.label}</span>
            <span><strong style={{color:T.text}}>{r.value}</strong> <span style={{color:T.textDim,fontSize:11}}>({pct}%)</span></span>
          </div>
          <div style={{height:5,background:T.bgAlt,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:r.color,borderRadius:3}}/></div>
        </div>;})}
        {c.unanswered>0&&<div style={{fontSize:11.5,color:T.warn,marginTop:12,display:"flex",gap:6,alignItems:"flex-start"}}>
          <i className="ti ti-alert-triangle" style={{fontSize:13,marginTop:1}}/>
          <span>{c.unanswered} conversation{c.unanswered>1?"s":""} got no reply — check that your channel is connected and the bot is not paused.</span>
        </div>}
      </Card>

      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Customer mix</div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:16}}>New people vs people who came back</div>
        <div style={{display:"flex",height:9,borderRadius:5,overflow:"hidden",background:T.bgAlt,marginBottom:14}}>
          <div style={{width:`${newPct}%`,background:T.gold}}/>
          <div style={{width:`${100-newPct}%`,background:T.info}}/>
        </div>
        <div style={{display:"flex",gap:16}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11.5,color:T.textMuted,marginBottom:3}}><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:T.gold,marginRight:6}}/>New</div>
            <div style={{fontSize:20,fontWeight:600}}>{k.new_contacts}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11.5,color:T.textMuted,marginBottom:3}}><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:T.info,marginRight:6}}/>Returning</div>
            <div style={{fontSize:20,fontWeight:600}}>{k.returning_contacts}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:16,paddingTop:14,borderTop:`0.5px solid ${T.border}`}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}><i className="ti ti-photo" style={{marginRight:4}}/>Photos received</div>
            <div style={{fontSize:16,fontWeight:600}}>{k.image_messages}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}><i className="ti ti-microphone" style={{marginRight:4}}/>Voice messages</div>
            <div style={{fontSize:16,fontWeight:600}}>{k.voice_messages}</div>
          </div>
        </div>
      </Card>
    </div>

    {/* Channels + hours */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>Channels</div>
        {d.channels.length?d.channels.map(ch=><div key={ch.platform} style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <i className={`ti ${PICON[ch.platform]||"ti-message"}`} style={{fontSize:15,color:PCOLOR[ch.platform]||T.textMuted}}/>
            <span style={{fontSize:13,flex:1}}>{PNAME[ch.platform]||ch.platform}</span>
            <span style={{fontSize:11.5,color:T.textMuted}}>{ch.contacts||0} customers</span>
            <span style={{fontSize:13,fontWeight:600,minWidth:30,textAlign:"right"}}>{fmtNum(ch.total)}</span>
          </div>
          <div style={{height:5,background:T.bgAlt,borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${(ch.total/maxCh)*100}%`,background:PCOLOR[ch.platform]||T.gold,borderRadius:3}}/>
          </div>
        </div>):<div style={{fontSize:12.5,color:T.textDim}}>No channel activity yet</div>}
      </Card>

      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4,gap:8}}>
          <div style={{fontSize:14,fontWeight:500}}>When customers message</div>
          {k.peak_hour!==null&&<span style={{fontSize:11.5,color:T.gold}}>peak {hourLabel(k.peak_hour)}</span>}
        </div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:14}}>Bangladesh time — plan your team around this</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:2,height:88}}>
          {d.hours.map(h=><div key={h.hour} title={`${hourLabel(h.hour)} — ${h.count}`} style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",height:"100%"}}>
            <div style={{height:`${Math.max(h.count?8:2,(h.count/maxHr)*100)}%`,background:h.hour===k.peak_hour?T.gold:T.info,opacity:h.count?1:0.25,borderRadius:2}}/>
          </div>)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.textDim,marginTop:6}}>
          <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
        </div>
      </Card>
    </div>

    {/* Queries + business-specific */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>What customers ask about</div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:14}}>Most frequent words in customer messages</div>
        <BarList items={d.top_queries} empty="Not enough customer messages yet"/>
      </Card>

      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>{isAgency?"Most requested services":"Best selling products"}</div>
        <div style={{fontSize:11.5,color:T.textDim,marginBottom:14}}>{isAgency?"From confirmed bookings":"From confirmed orders"}</div>
        <BarList items={isAgency?d.top_services:d.top_products} color={T.success}
          empty={isAgency?"No bookings in this period":"No orders in this period"}/>
      </Card>
    </div>

    {/* Conversions over time + status */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14,gap:8}}>
          <div style={{fontSize:14,fontWeight:500}}>{isAgency?"Bookings":"Orders"} over time</div>
          {k.conversion_pct!==null&&<span style={{fontSize:11.5,color:T.textMuted}}>{k.conversion_pct}% conversion</span>}
        </div>
        <Spark data={d.conversions_daily} keys={[isAgency?"bookings":"orders"]} colors={[T.success]} height={92} labels={[fmtDay(first),fmtDay(last)]}/>
      </Card>

      <Card>
        <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>{isAgency?"Booking summary":"Order status"}</div>
        {isAgency
          ? <div style={{display:"flex",gap:16}}>
              <div style={{flex:1}}><div style={{fontSize:11.5,color:T.textMuted,marginBottom:4}}>Total bookings</div><div style={{fontSize:22,fontWeight:600}}>{k.bookings}</div></div>
              <div style={{flex:1}}><div style={{fontSize:11.5,color:T.textMuted,marginBottom:4}}>Previous period</div><div style={{fontSize:22,fontWeight:600,color:T.textMuted}}>{g.previous.conversions}</div></div>
            </div>
          : d.order_status.length
            ? d.order_status.map(s=><div key={s.status} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <Badge color={SCOLOR[s.status]||T.textMuted}>{s.status}</Badge>
                <div style={{flex:1,height:5,background:T.bgAlt,borderRadius:3}}><div style={{height:"100%",width:`${(s.count/Math.max(1,k.orders))*100}%`,background:SCOLOR[s.status]||T.textMuted,borderRadius:3}}/></div>
                <span style={{fontSize:13,fontWeight:600,minWidth:22,textAlign:"right"}}>{s.count}</span>
              </div>)
            : <div style={{fontSize:12.5,color:T.textDim}}>No orders in this period</div>}
      </Card>
    </div>
  </div>;
}
