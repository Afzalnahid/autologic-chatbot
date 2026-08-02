"use client";
import { createClient as createSb } from "@/utils/supabase/client";

// Supabase session and the authenticated fetch helper. One module owns the
// token so every tab sends the same one.
let _sbi=null;
let AUTH_TOKEN="";
let _sessionPromise=null;
function getSb(){ if(!_sbi) _sbi=createSb(); return _sbi; }

function getSessionOnce(){
  if(!_sessionPromise){
    _sessionPromise=getSb().auth.getSession().finally(()=>{ _sessionPromise=null; });
  }
  return _sessionPromise;
}


export async function api(url,opts={}){
  try{
    const {data:{session}}=await getSessionOnce();
    if(session) AUTH_TOKEN=session.access_token;
  }catch{}
  let res=await fetch(url,{...opts,cache:"no-store",headers:{...(opts.headers||{}),"Cache-Control":"no-cache","Authorization":"Bearer "+AUTH_TOKEN}});
  if(res.status===401){
    try{
      const {data:{session}}=await getSb().auth.refreshSession();
      if(session){
        AUTH_TOKEN=session.access_token;
        res=await fetch(url,{...opts,cache:"no-store",headers:{...(opts.headers||{}),"Cache-Control":"no-cache","Authorization":"Bearer "+AUTH_TOKEN}});
      }
    }catch{}
  }
  return res;
}

export function setAuthToken(v){ AUTH_TOKEN = v || ""; }
export { getSb };
