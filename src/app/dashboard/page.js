"use client";
import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("../dashboard-client.js"), {
  ssr: false,
  loading: () => null,
});

export default function DashboardPage() {
  return <Dashboard />;
}
