# P.R.O. Company Portal

An internal enterprise web application for managing work orders, appointments, vendor typing workflows, and vendor wallet accounting with a premium, desktop-first UI.

## Run & Operate

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Build for production
npm run build

# Run type checking
npm run typecheck

# Generate Drizzle migrations from schema changes
drizzle-kit generate:pg

# Push Drizzle schema changes to the database
drizzle-kit push:pg
```

**Required Environment Variables**:
- `DATABASE_URL`: PostgreSQL connection string.
- `SESSION_SECRET`: Secret for session encryption (production only).
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_DOMAIN`, `ZOHO_API_DOMAIN`, `ZOHO_WORKDRIVE_PARENT_FOLDER_ID`: For Zoho WorkDrive integration.

## Stack

-   **Frontend**: React 18, TypeScript, Vite, Wouter (routing), TanStack React Query, shadcn/ui (Radix UI), TailwindCSS, React Hook Form, Zod.
-   **Backend**: Express.js 5, TypeScript, Drizzle ORM (PostgreSQL), Zod.
-   **Database**: PostgreSQL 16.
-   **Auth**: `express-session`, `connect-pg-simple`, `bcryptjs`.
-   **Build**: Vite.

## Where things live

-   **Frontend Source**: `client/src/`
    -   `client/src/pages/`: Main application pages.
    -   `client/src/components/`: Reusable UI components.
    -   `client/src/lib/`: Shared frontend utilities and business logic.
-   **Backend Source**: `server/src/`
    -   `server/src/routes/`: API endpoint definitions.
    -   `server/src/middleware/`: Express middleware.
    -   `server/src/services/`: Backend services.
    -   `server/src/storage/`: Database interaction layer.
-   **Shared Schemas**: `shared/schema.ts` (Drizzle DB schema, Zod schemas).
-   **DB Migrations**: `drizzle/meta/` and `drizzle/00xx_*.sql`
-   **Tailwind CSS**: `client/src/index.css`
-   **PWA Manifest**: `client/public/manifest.json`

## Architecture decisions

-   **Dual-Schema Database**: Uses a `public` schema for Client Portal and a `vendor` schema for Vendor Portal within a single PostgreSQL database instance. Vendor Portal can read `public` tables but only writes to `vendor` tables, enforced by role-based access.
-   **Atomic Cross-Portal Events**: Communication between Client and Vendor portals is mediated by `vendor.cross_portal_events`, with Client Portal being the sole consumer and state changer (`status='pending'` → `status='sent'`).
-   **Component Orchestration Pattern**: Major frontend pages are split into an orchestrator component and numerous smaller, focused sub-components to manage complexity and improve readability.
-   **Pipeline-Driven UX**: Work order status and progress are consistently visualized using a pipeline bar across various views (detail, list, dashboard), providing immediate context and guiding user actions.
-   **Integrated External Services**: Zoho WorkDrive for document storage and email service for notifications are deeply integrated, with background syncing and automated processes.

## Product

-   **Work Order Management**: Create, track, and manage work orders with a rationalized status model, including auto-delay and auto-completion logic.
-   **Appointment Scheduling**: Dedicated workflows for Medical and Emirates ID appointments driven by vendor typing job results, with comprehensive status tracking and follow-up capabilities.
-   **Typing Job Workflow**: End-to-end management of typing jobs from auto-creation to vendor assignment, status tracking, and immediate wallet deductions.
-   **Vendor Management & Wallet**: CRUD for vendors, ledger-based vendor wallet with top-up and deduction capabilities.
-   **Document Management**: Upload, categorize, and track documents, integrated with Zoho WorkDrive.
-   **Comprehensive Dashboard**: Unified dashboard for Admin and CRM roles, displaying key stats, alerts, pipeline overview, and activity feeds.
-   **Role-Based Access Control**: Granular access control for Staff (Admin, CRM, Medical Support) and Vendors, enforced on both frontend and backend.
-   **External API**: Authenticated REST API for client and CRM integrations, with API key management and usage tracking.
-   **Attestation Document Custody**: Tracks physical document handovers with identity proof and digital signatures for attestation service requests.

## User preferences

Preferred communication style: Simple, everyday language.

## Gotchas

-   **Session Secret**: `SESSION_SECRET` environment variable is critical for production; the app will fail fast if missing.
-   **Vendor Ownership Checks**: All vendor-related actions (files, comments, job actions) have explicit backend checks to ensure `job.vendorId === session.vendorId`. Bypassing this will lead to authorization errors.
-   **PWA Install Prompt**: The PWA install banner `client/src/components/install-prompt-banner.tsx` appears only when the browser fires `beforeinstallprompt`.
-   **Zoho WorkDrive**: Ensure all Zoho environment variables are correctly set for document integration to function. Errors here can lead to file sync failures.

## Pointers

-   **Shadcn UI Docs**: [https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)
-   **Drizzle ORM Docs**: [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
-   **React Hook Form Docs**: [https://react-hook-form.com/docs](https://react-hook-form.com/docs)
-   **TanStack Query Docs**: [https://tanstack.com/query/latest/docs/react/overview](https://tanstack.com/query/latest/docs/react/overview)
-   **Wouter Docs**: [https://www.npmjs.com/package/wouter](https://www.npmjs.com/package/wouter)