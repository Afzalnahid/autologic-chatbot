"use client";
import { T, Segmented, ThemeToggle, Theme, Motion, words } from "./ui.js";
import { BotMark } from "@/lib/brand.js";
import NotificationsBell from "./NotificationsBell.js";
import { LangToggle } from "./i18n.js";

// The dashboard's frame — the sidebar, the top bar and the column the tabs
// render in — moved out of dashboard-client.js text for text (2026-09-20), so
// the screenshot studio can draw it around sample data and a design change to
// the frame can be checked without a login. Every closure variable the frame
// used to read is a prop of the same name; the tab content is `children`.
export default function Shell({isMobile,sidebarOpen,setSidebarOpen,fullBleed,me,settings,groups,PAGES,ICONS,
  page,setPage,HOME,navLabel,t,isAgency,activeCount,onLogout,load,loading,mode,toggleTheme,convos,feed,goTo,
  botLive,initials,products,bt,children}) {
  const GROUPS=groups;
  return <div style={{display:"flex",height:"100dvh",overflow:"hidden",background:T.bg}}>
    <Theme/><Motion/>
    {sidebarOpen&&isMobile&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:40}}/>}

    {/* The sidebar is the reference's neumorphic card: a soft slab floating off
        the page, grouped sections with quiet labels, and one red capsule marking
        where you are. */}
    <div style={{position:"fixed",zIndex:50,top:isMobile?10:14,bottom:isMobile?10:14,left:isMobile?10:14,
      width:isMobile?"min(272px, calc(100vw - 20px))":252,background:T.rail,
      borderRadius:24,boxShadow:sidebarOpen?T.nmOut:"none",display:"flex",flexDirection:"column",flexShrink:0,
      transform:sidebarOpen?"translateX(0)":"translateX(calc(-100% - 60px))",
      // visibility flips after the slide finishes on close (0.28s delay), and
      // at once on open — so the closed sidebar's soft shadow can never bleed
      // onto the page (it did, as a red sliver above the calendar).
      visibility:sidebarOpen?"visible":"hidden",
      transition:sidebarOpen
        ?"transform 0.28s cubic-bezier(.22,.61,.36,1), box-shadow .2s ease-out, visibility 0s"
        :"transform 0.28s cubic-bezier(.22,.61,.36,1), box-shadow .2s ease-out, visibility 0s .28s",
      paddingBottom:"env(safe-area-inset-bottom)"}}>
      <div style={{padding:"20px 18px 14px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:44,height:44,borderRadius:14,background:T.card,boxShadow:T.nmSm,
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
          {me?.client?.logo_url
            ?<img src={me.client.logo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            :<span style={{width:44,height:44,borderRadius:14,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><BotMark size={38}/></span>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:"-0.01em"}}>{me?.client?.business_name||"TellMore AI"}</div>
          <div style={{fontSize:9.5,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.16em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>{settings?.botName||"chatbot"}</div>
        </div>
        <button onClick={()=>setSidebarOpen(false)} className="ui-btn" aria-label="Collapse menu"
          style={{width:28,height:28,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",
            background:"transparent",border:"none",color:T.textDim,cursor:"pointer",padding:0}}>
          <i className={`ti ti-${isMobile?"x":"chevron-left"}`} style={{fontSize:16}}/>
        </button>
      </div>

      <nav style={{flex:1,padding:"4px 12px",overflowY:"auto",minHeight:0}}>
        {GROUPS.map((g,gi)=>(
          <div key={g.title} style={{marginBottom:6,paddingTop:gi?10:0,
            borderTop:gi?`1px solid ${T.border}`:"none"}}>
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",
              color:T.textDim,padding:"0 12px",marginBottom:6}}>{t("group."+g.title)}</div>
            <Segmented vertical value={page} onChange={(p)=>{setPage(p);if(isMobile)setSidebarOpen(false);}}
              items={g.pages.map(p=>{
                const i=PAGES.indexOf(p);
                return {
                  value:p,
                  label:navLabel(i),
                  icon:isAgency&&p==="inventory"?"ti-database":isAgency&&p==="orders"?"ti-calendar-event":ICONS[i],
                  badge:p==="conversations"&&activeCount?String(activeCount):undefined,
                };
              })}/>
          </div>
        ))}
      </nav>

      {/* The bottom of the reference sidebar: parted from the menu, always reachable.
          On a phone this is also where sync and the theme switch live. */}
      <div style={{padding:"10px 12px 14px",borderTop:`1px solid ${T.border}`,display:"flex",
        flexDirection:isMobile?"column":"row",alignItems:isMobile?"stretch":"center",gap:6}}>
        {/* Log out lands on the app's own sign-in screen (this same /dashboard,
            which shows AuthGate when signed out) — NOT the public marketing
            site. In an installed app, being thrown to the landing page read as
            leaving the app. reload() is what forces it, since navigating to
            /dashboard from /dashboard#tab would only drop the hash. */}
        <button onClick={onLogout}
          className="ui-btn seg-item" style={{display:"flex",alignItems:"center",gap:9,flex:1,minWidth:0,
            padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",
            fontFamily:"inherit",fontSize:13.5,fontWeight:500,color:T.textMuted,textAlign:"left",whiteSpace:"nowrap"}}>
          <i className="ti ti-logout" style={{fontSize:17,flexShrink:0}}/>{t("shell.logout")}
        </button>
        {/* Their own row on a phone. Touch targets are 44px wide, and four
            controls beside each other left "Log out" too narrow for its own
            label — it wrapped onto a second line. */}
        {isMobile&&<div style={{display:"flex",alignItems:"center",gap:6}}>
          <LangToggle compact/>
          <button onClick={()=>load(false)} disabled={loading} className={`pbtn${loading?" is-busy":""}`}
            title="Sync" aria-label="Sync" style={{width:44,height:44,borderRadius:12}}>
            <i className="ti ti-refresh" style={{animation:loading?"spin 0.8s linear infinite":"none"}}/>
          </button>
          <ThemeToggle mode={mode} toggle={toggleTheme} style={{width:44,height:44,borderRadius:12}}/>
        </div>}
      </div>
    </div>

    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0,marginLeft:(!isMobile&&sidebarOpen)?280:0,transition:"margin-left 0.28s cubic-bezier(.22,.61,.36,1)"}}>
      {/* The reference header: a rounded bar floating on the surface, square
          soft-shadow buttons that flood red on hover, a live avatar on the end. */}
      {!fullBleed&&<div style={{margin:isMobile?"10px 10px 0":"14px 18px 0",padding:isMobile?"8px 10px":"9px 12px",
        background:T.card,borderRadius:isMobile?16:20,boxShadow:T.nmSm,
        display:"flex",alignItems:"center",gap:isMobile?8:12,flexShrink:0}}>

        <div style={{display:"flex",alignItems:"center",gap:isMobile?6:10,flexShrink:0}}>
          {!sidebarOpen&&<button onClick={()=>setSidebarOpen(true)} className="pbtn" aria-label="Menu"
            style={isMobile?{width:36,height:36,borderRadius:11}:undefined}>
            <i className="ti ti-menu-2"/>
          </button>}
          {/* The phone's own back button does the same job; on screen it only
              earns a slot when it will not squeeze the title into an ellipsis. */}
          {/* Entering a tab from the open menu already closes it (the
              Segmented onChange below). This is the other half: stepping back
              out to Home reopens it, so the menu is exactly where it was
              before the detour rather than something to go dig out again. */}
          {isMobile&&page!==HOME&&<button onClick={()=>{setPage(HOME);setSidebarOpen(true);}} className="pbtn hide-xs" aria-label="Back"
            style={{width:36,height:36,borderRadius:11}}>
            <i className="ti ti-arrow-left" style={{fontSize:16}}/>
          </button>}
        </div>

        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:isMobile?15.5:17.5,fontWeight:700,letterSpacing:"-0.02em",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{navLabel(PAGES.indexOf(page))}</div>
          {!isMobile&&<div style={{fontSize:11.5,color:T.textDim,marginTop:1,overflow:"hidden",
            textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {me?.client?.business_name} · {me?.client?.plan==='trial'
              ?`Trial — ${me?.usage?.today??0}${me?.usage?.limit?`/${me.usage.limit}`:""} bot replies today`
              :`${products.length} ${words(bt).item.toLowerCase()}s`}
          </div>}
        </div>

        {/* On a phone the row holds only what is used every minute: bell,
            avatar. Sync and the theme switch move into the sidebar footer —
            still one tap away, no longer crowding the title off the bar. */}
        <div style={{display:"flex",alignItems:"center",gap:isMobile?7:10,flexShrink:0}}>
          {!isMobile&&<button onClick={()=>load(false)} disabled={loading} className={`pbtn${loading?" is-busy":""}`}
            title="Sync" aria-label="Sync">
            <i className="ti ti-refresh" style={{animation:loading?"spin 0.8s linear infinite":"none"}}/>
          </button>}
          <NotificationsBell convos={convos} feed={feed} isMobile={isMobile} onNavigate={goTo}/>
          {!isMobile&&<LangToggle/>}
          {!isMobile&&<ThemeToggle mode={mode} toggle={toggleTheme}/>}
          {/* The avatar is where people expect their account to be, so it
              opens the Profile tab rather than being decoration. */}
          <button onClick={()=>setPage("profile")} aria-label={t("nav.profile")}
            title={botLive?"Bot is live":"No channel connected"} className="ui-sq"
            style={{position:"relative",width:isMobile?44:42,height:isMobile?44:42,borderRadius:"50%",
              background:T.accGrad,boxShadow:T.accGlow,display:"flex",alignItems:"center",border:"none",padding:0,cursor:"pointer",
              justifyContent:"center",flexShrink:0,overflow:"visible",marginRight:isMobile?2:0}}>
            {me?.client?.logo_url
              ?<img src={me.client.logo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>
              :<span style={{fontSize:isMobile?13:15,fontWeight:700,color:"#fff",letterSpacing:".02em"}}>{initials}</span>}
            {botLive&&<span className="ui-live" style={{position:"absolute",bottom:0,right:0,width:11,height:11,
              borderRadius:"50%",background:T.live,border:`2px solid ${T.card}`}}/>}
          </button>
        </div>
      </div>
      }{children}
    </div>
  </div>;
}
