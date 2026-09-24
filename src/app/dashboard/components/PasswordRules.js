"use client";
import { T } from "./ui.js";
import { RULES, PASSWORD_HINT, checkPassword } from "@/lib/password-rules.js";

// The password rule, shown where the password is typed.
//
// Owner, 2026-09-25: "I need to mention the password setting to my login page."
// Before this the rule was invisible: somebody chose a password, pressed the
// button, and Supabase refused it with wording written for a developer. A rule
// nobody can see is a rule that only ever arrives as a rejection.
//
// It ticks each line as the person types, so they can see themselves getting
// there instead of guessing which part was wrong. Every word comes from
// src/lib/password-rules.js, which is also what the form checks against and
// what the Supabase project is set to — one rule, one description.
//
// Deliberately NOT a red error while typing: nothing is wrong yet, they are
// mid-word. Grey and unticked until it passes, then green.
export default function PasswordRules({ value, show = true }) {
  if (!show) return null;
  const { passed } = checkPassword(value);
  const typing = (value || "").length > 0;

  // Before a single character, one quiet line rather than four empty boxes.
  if (!typing) return (
    <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.55, margin: "6px 2px 0" }}>
      {PASSWORD_HINT}
    </div>
  );

  return (
    <ul style={{ listStyle: "none", margin: "8px 2px 0", padding: 0, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
      {RULES.map((r) => (
        <li key={r.id} style={{
          display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, lineHeight: 1.5,
          color: passed[r.id] ? T.success : T.textMuted,
        }}>
          <i className={`ti ti-${passed[r.id] ? "circle-check" : "circle"}`}
            style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true" />
          {r.label}
        </li>
      ))}
    </ul>
  );
}
