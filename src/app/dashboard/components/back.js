"use client";
import { useEffect, useRef } from "react";

// What the phone's back button should close, and in what order.
//
// A dashboard is not one screen. A drawer opens over the Inventory tab, a
// sheet opens over the drawer, a picker opens inside the sheet — and on a
// phone the ONLY back affordance is the system button. Pressing it should undo
// the last thing that opened, the way every app the owner already uses
// behaves. Leaving the whole tab instead loses a half-typed product and reads
// as the app throwing them out.
//
// This used to be one global slot, `window.__alBack`, which exactly one
// component wrote to. Two overlays open at once and the second silently
// replaced the first, whose close was then never called — and its cleanup
// cleared the slot even when the other one owned it. A slot cannot express
// "on top of", which is the only question being asked here.
//
// So it is a stack. The last thing to register is the first to be asked, and
// each entry answers "did I handle it?" — a `false` passes the press down to
// whatever is underneath, and finally to the page itself.
const stack = [];

export function pushBack(fn) {
  stack.push(fn);
  // Removed by identity, not by popping: overlays do not always close in the
  // order they opened, and popping blind would drop somebody else's entry.
  return () => {
    const i = stack.lastIndexOf(fn);
    if (i >= 0) stack.splice(i, 1);
  };
}

// True when something on top of the page dealt with the press. Asked
// top-down, and a handler that throws must not swallow the press or the back
// button would stop working for the rest of the session.
export function runBack() {
  for (let i = stack.length - 1; i >= 0; i--) {
    try { if (stack[i]()) return true; } catch { /* a broken handler is not a reason to trap the owner */ }
  }
  return false;
}

// The whole of what an overlay has to do: say when it is open and how to close
// it. Registered only while open, so a closed drawer never eats a press.
//
// `close` is deliberately NOT in the dependency list. It is almost always an
// inline arrow, so a new one arrives on every render, and depending on it
// would unregister and re-register the handler continuously — which is not
// wrong, only wasteful, and it would reorder the stack on every keystroke
// typed into the overlay above it. The ref keeps the latest one without
// disturbing the order.
export function useBackClose(open, close) {
  // A ref, kept current on every render, so the handler always calls the
  // LATEST close without the effect having to re-run to learn about it.
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!open) return;
    return pushBack(() => { ref.current?.(); return true; });
  }, [open]);
}
