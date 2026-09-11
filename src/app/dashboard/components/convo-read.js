"use client";
import { useEffect, useState } from "react";
import { isUnreadConvo, unreadConvoCount, lastCustomerAt, trimSeen } from "@/lib/convo-read.js";

// Per-device read state for conversations (localStorage, like the bell's):
// which chats this device has looked at, and the last "Mark all as read".
// Every component that shows read/unread (inbox rows, the sidebar badge, the
// bell's Mark-all) reads the same store through useConvoRead(), and a write
// from any of them re-renders all of them via one window event — so the bold
// rows and the badge can never disagree.
const SEEN_KEY = "gv-convo-seen";
const ALL_KEY = "gv-convo-seen-all";
const EVENT = "gv-convo-read";

function readState() {
  let seen = {}, watermark = 0;
  try { const o = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); if (o && typeof o === "object") seen = o; } catch { /* private mode */ }
  try { watermark = Number(localStorage.getItem(ALL_KEY)) || 0; } catch { /* private mode */ }
  return { seen, watermark };
}
function write(state) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(trimSeen(state.seen))); } catch { /* private mode */ }
  try { localStorage.setItem(ALL_KEY, String(state.watermark || 0)); } catch { /* private mode */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* SSR */ }
}

// Opened (or is looking at) this chat: seen up to its newest customer message.
export function markConvoSeen(convo) {
  if (!convo?.id) return;
  const at = lastCustomerAt(convo);
  if (!at) return;
  const s = readState();
  if ((Number(s.seen[String(convo.id)]) || 0) >= at) return;   // nothing new
  s.seen[String(convo.id)] = at;
  write(s);
}

// "Mark all as read": everything up to now is read, on this device.
export function markAllConvosRead() {
  const s = readState();
  s.watermark = Date.now();
  write(s);
}

export function useConvoRead() {
  const [state, setState] = useState({ seen: {}, watermark: 0 });
  useEffect(() => {
    const sync = () => setState(readState());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);      // another tab marked something
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return {
    state,
    isUnread: (convo) => isUnreadConvo(convo, state),
    count: (convos) => unreadConvoCount(convos, state),
  };
}
