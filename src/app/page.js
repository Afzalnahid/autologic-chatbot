"use client";
import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("./dashboard-client.js"), { ssr: false });

export default function Page() {
  return <Dashboard />;
}
