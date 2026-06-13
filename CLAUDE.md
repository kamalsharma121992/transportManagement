@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Requires Node.js >= 20 (use nvm use 22)
source ~/.nvm/nvm.sh && nvm use 22

npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # Run ESLint
```

## Tech Stack

- **Next.js 16** (App Router) with TypeScript and Tailwind CSS
- **Supabase** for PostgreSQL database (client-side queries via `@supabase/supabase-js`)
- **shadcn/ui** (base-ui variant, NOT radix) for UI components - no `asChild` prop, use `render` prop instead
- **Recharts** for dashboard charts
- **Lucide React** for icons

## Architecture

### Database
- Schema in `supabase/schema.sql`, seed data in `supabase/seed.sql`
- Tables: `partners`, `drivers`, `vehicles`, `routes`, `trips`, `expenses`, `capital_contributions`, `banking_information`
- **Referential integrity**: `trips.driver_name` → `drivers.name`, `trips.route_name` → `routes.route_name`, `trips.vehicle_number` → `vehicles.vehicle_number`, `expenses.paid_by` → `partners.name`, `capital_contributions.contributor` → `partners.name`
- `expenses` is a unified table with `expense_type` enum: `vehicle`, `operational`, `personal`, `other`
- `vehicle_number` is nullable in expenses — only set for `vehicle` type
- RLS enabled with open policies (no auth yet)

### App Structure
- `src/lib/supabase.ts` - Supabase client singleton + TypeScript types + category mappings per expense type
- `src/lib/format.ts` - Currency (INR) and date formatting helpers
- `src/components/sidebar.tsx` - Main navigation sidebar
- `src/app/page.tsx` - Dashboard with summary cards + charts (revenue vs expenses, category pie, vehicle bar)
- `src/app/trips/` - Trip log CRUD
- `src/app/expenses/` - Unified expenses CRUD with type tabs (vehicle/operational/personal/other) and filters
- `src/app/vehicles/` - Vehicle fleet management with loan info
- `src/app/capital/` - Capital contributions tracking with per-contributor summaries

### Key Patterns
- All pages are client components (`'use client'`) with direct Supabase queries
- CRUD pattern: useState for form + editingId, Dialog for add/edit, confirm() for delete
- Supabase client uses lazy init to handle missing env vars during build
- Currency amounts in INR (Indian Rupees), dates in DD/MMM/YYYY format

## Setup
1. Create Supabase project at supabase.com
2. Copy `.env.local.example` to `.env.local` and fill in Supabase URL + anon key
3. Run `supabase/schema.sql` then `supabase/seed.sql` in Supabase SQL Editor
4. `npm run dev`
