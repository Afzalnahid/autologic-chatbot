export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { ingestFile, deleteFile } from "@/lib/knowledge.js";

const ALLOWED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/csv",
];

function extOk(name = "") {
  return /\.(pdf|docx?|txt|md|csv)$/i.test(name);
}

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });
  const { data } = await supabase
    .from("file_registry")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return NextResponse.json({ error: "no file" }, { status: 400 });

    const fileType = file.type || "";
    if (!ALLOWED.includes(fileType) && !extOk(file.name || "")) {
      return NextResponse.json({ error: "Unsupported file type. Use PDF, DOCX, or TXT." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name?.split(".").pop() || "bin").toLowerCase();
    const fileId = `${client.id}_${Date.now()}`;
    const path = `${client.id}/${fileId}.${ext}`;

    // Store original file for reference/re-sync
    let fileUrl = "";
    const { error: upErr } = await supabase.storage
      .from("knowledge-files")
      .upload(path, buffer, { contentType: fileType || "application/octet-stream", upsert: true });
    if (!upErr) {
      fileUrl = supabase.storage.from("knowledge-files").getPublicUrl(path).data.publicUrl;
    }

    const { chunks } = await ingestFile({
      clientId: client.id,
      fileId,
      fileName: file.name || `file.${ext}`,
      fileUrl,
      fileType,
      buffer,
    });

    return NextResponse.json({ ok: true, file_id: fileId, chunks });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { file_id } = await request.json();
    if (!file_id) return NextResponse.json({ error: "missing file_id" }, { status: 400 });
    await deleteFile(client.id, file_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
