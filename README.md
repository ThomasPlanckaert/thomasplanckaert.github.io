# Planning Poker (React + TypeScript)

A modern, frontend-only Planning Poker app built with Vite, React, TypeScript, TailwindCSS, Framer Motion, Zustand, React Router, and shadcn-style UI primitives.

## Features

- Landing/join flow with temporary local identity
- Session and moderator routes (`/session/:sessionId` and `/session/:sessionId/admin`)
- Moderator controls: reveal, reset, next round, story/title updates, deck switching, participant management
- Planning poker voting behavior with hidden cards before reveal
- Configurable decks (Modified Fibonacci by default, Fibonacci, T-shirt, sequential) + custom deck creation
- Creator-only inline room naming and collapsible moderator controls
- End-of-session summary with consensus totals and independently ranked matching pairs
- LocalStorage persistence for sessions/decks/identity/theme
- Consensus celebration with confetti + toast
- Modern SaaS-like styling, subtle glassmorphism, smooth animations, dark mode
- Shareable session URL copy action

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Project structure

- `src/app` - router/bootstrap
- `src/pages` - route-level screens
- `src/features/session` - planning poker domain logic/components/store/types
- `src/shared` - reusable UI and utilities

## Notes

This implementation is intentionally frontend-only (no backend, no auth provider, no database). Session collaboration is local to the browser state with persistence.
