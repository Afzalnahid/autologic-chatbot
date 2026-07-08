"use client";
import dynamic from "next/dynamic";
import { Component } from "react";

const Dashboard = dynamic(() => import("./dashboard-client.js"), {
  ssr: false,
  loading: () => null,
});

class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return <div style={{ padding: 20, color: "#fff", background: "#0b0f1a", minHeight: "100vh", fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        <div style={{ color: "#f87171", marginBottom: 12, fontSize: 14 }}>App error:</div>
        {String(this.state.err?.message || this.state.err)}
        {"\n\n"}
        {String(this.state.err?.stack || "").slice(0, 1500)}
      </div>;
    }
    return this.props.children;
  }
}

export default function Page() {
  return <ErrorBoundary><Dashboard /></ErrorBoundary>;
}
