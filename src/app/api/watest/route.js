export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { getChannelByPage, processConversation } from "@/lib/bot.js";

export async function GET() {
  const steps = [];
  try {
    const ch = await getChannelByPage("1136966472839695");
    steps.push("channel:" + (ch ? ch.platform : "none"));
    await processConversation(ch, "8801690000732", null);
    steps.push("processed");
  } catch (e) {
    steps.push("ERROR:" + e.message + " | " + (e.stack||"").slice(0,300));
  }
  return NextResponse.json({ steps });
}
