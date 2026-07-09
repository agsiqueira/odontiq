# odontIQ Development Notes

## Project Purpose

odontIQ is a web-first, mobile-responsive learning app for dental virtual patient simulations. The goal is to help learners practice clinical reasoning, patient communication, diagnosis, and treatment planning through focused patient encounters.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui with Radix and Nova preset
- lucide-react
- framer-motion
- Mock data in the app for early UI development
- Logo asset at `public/odontIQ-logo.svg`

## Current UI Decisions

- Design mobile-first for phone browsers.
- Keep desktop responsive by centering the mobile layout with wider margins.
- The product should feel like a premium educational app, not an admin dashboard.
- Prioritize calm, clean screens with generous whitespace.
- Keep one clear focal point and one primary action per screen.
- Avoid dashboard-style KPI card grids on the Home screen.
- Use large touch targets and simple visual hierarchy.

## Navigation Decisions

- Bottom navigation has exactly three items:
  - Home
  - Cases
  - Progress
- Do not add Profile to the bottom navigation.
- Settings belongs in the Home top-right as a gear icon.
- Keep routes:
  - `/`
  - `/cases`
  - `/progress`
  - `/encounter`

## Mock-Data-First Approach

- Build UI with mock data first.
- Keep mock data simple, readable, and close to the current UI needs.
- Do not introduce backend contracts before the product flow is clearer.
- Prefer small, focused mock data additions over broad data modeling.

## Not Built Yet

Do not add these until explicitly requested:

- Authentication
- Backend services
- Database connections
- AI integrations
- Production patient simulation logic

## Working Instructions

- Do not claim tests, linting, builds, or browser checks passed unless they were actually run.
- Keep tasks small and focused.
- Prefer incremental UI improvements over large rewrites.
- Follow existing project patterns before adding new abstractions.
- Keep components simple and readable.
