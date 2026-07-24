# Autologic Chatbot

AI-powered multi-channel chatbot SaaS platform built with Next.js, Supabase, and Google Gemini.

**Live:** https://autologic-chatbot.vercel.app

## Features
- E-commerce bot (inventory + product image matching + orders)
- Agency/RAG bot (knowledge base + Google Calendar + Meet link + bookings)
- Multi-channel: Facebook, Instagram, WhatsApp, Telegram
- Admin dashboard (RBAC: Super Admin, Full, Editor, Viewer)
- Multi-tenant, enterprise-ready

## Documentation

| Document | Contents |
|---|---|
| [architecture.md](docs/architecture.md) | Stack, request flow, directory map, API surface |
| [database.md](docs/database.md) | Every table and column, vector functions, RLS, storage |
| [security.md](docs/security.md) | Secrets policy, auth, tenant isolation, incident checklist |
| [error-handling.md](docs/error-handling.md) | Failure modes, past bugs and their causes, debugging method |
| [prompts.md](docs/prompts.md) | Locked rules, business profile generation, changing prompts safely |
| [phases.md](docs/phases.md) | What was built when, roadmap, known gaps |
