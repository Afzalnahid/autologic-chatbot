// Turn a stored message_buffer row into what the inbox shows. Shared by the
// conversation LIST (/api/conversations) and the full THREAD
// (/api/conversations/messages) so a message looks identical in both.

// A bot reply is stored as the raw JSON array the model produced; show the text
// a person would read, not the JSON.
export function humanizeMessage(raw, role) {
  const s = String(raw || "");
  if (role === "bot" && (s.trim().startsWith("[") || s.trim().startsWith("{"))) {
    try {
      const parsed = JSON.parse(s);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const parts = arr.map((o) => {
        if (o.type === "text_msg" && o.text) return o.text;
        if (o.type === "image_msg") return "🖼️ Image";
        return "";
      }).filter(Boolean);
      if (parts.length) return parts.join("\n");
    } catch { /* not JSON, fall through */ }
  }
  return s;
}

// One row → { role, text, attachments[], time, status } for the UI.
export function shapeMessage(m) {
  const role = m.role || "customer";
  const rawContent = m.message_content || "";
  const text = role !== "bot" && rawContent.startsWith("IDENTIFIED ITEMS") ? "📷 Photo" : humanizeMessage(rawContent, role);
  const attachments = (m.attachments || "").split(",").map((s) => s.trim()).filter(Boolean);
  return { role, text, attachments, time: m.created_at, status: m.status };
}
