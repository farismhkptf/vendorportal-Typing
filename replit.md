# The P.R.O. Company Portal

## Overview

This project is an internal enterprise web application for The P.R.O. Company™, serving as an operations portal and vendor management system. Its primary purpose is to streamline work order processing, appointment scheduling (medical/Emirates ID), and vendor-based typing workflows. The system also includes vendor wallet accounting and file storage integration capabilities. The application aims for a premium, minimal, Apple-inspired glassmorphism UI/UX, optimized for desktop-first with responsive mobile support.

### Desktop-First Layout Principles (Task 79)
- **Table-first defaults**: Work Orders, Companies, and Typing Jobs default to table view on desktop (≥1024px), card view on mobile. View preference persists in localStorage.
- **No mobile FABs on core pages**: FloatingActionButton removed from Work Orders, Companies, and Typing Jobs pages (already hidden on md+ before, now fully removed).
- **No bottom padding on desktop**: `pb-20` removed from all core list pages (handled at app-layout level on desktop).
- **Wallet split-pane**: Vendor Wallet uses a flex row on desktop — left pane (380px) with large balance display, top-up button, and stats; right pane with scrollable transaction history.
- **Sidebar macOS-style**: Tighter nav items (py-2 instead of py-3), smaller icons (16px), grouped sections with `text-xs uppercase` labels (Operations, Management, Admin), user profile card with hover-reveal action icons.
- **Appointments full-width**: Removed `max-w-6xl mx-auto` constraint from Appointments page container.
- **Dashboard breathing room**: `space-y-4` → `space-y-6`, stat card grid uses `gap-4`, main 3-col grid uses `gap-6`.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript, using Vite, Wouter for routing, and TanStack React Query for state management. It leverages `shadcn/ui` (built on Radix UI) for components and TailwindCSS for styling, supporting light/dark modes. Forms are managed with React Hook Form and Zod validation. The structure is pages-based, with shared components and custom UI extensions. The app is a Progressive Web App (PWA) using `vite-plugin-pwa` with Workbox for service worker generation and asset pre-caching. A `manifest.json` in `client/public/` enables installability on desktop and mobile. An install prompt banner (`client/src/components/install-prompt-banner.tsx`) appears when the browser fires `beforeinstallprompt`.

#### Component Architecture (Split Pages)
Major pages are split into orchestrator + sub-components pattern:
-   **Work Orders List** (`client/src/pages/work-orders/`): `index.tsx` (135 lines) orchestrates 7 sub-components in `components/` (card, compact, table, kanban views + toolbar + status pills + use-work-orders-data hook + types).
-   **Work Order Detail** (`client/src/pages/work-orders/`): `detail.tsx` (~178 lines) orchestrates 13 extracted components in `components/` (wo-detail-header, wo-edit-dialog, wo-applicant-info, wo-summary-panel, wo-typing-tab, wo-dialogs, wo-banners, wo-tabs-container, wo-loading-states, pipeline-bar, next-action-banner, expanded-typing-job-card, expanded-appointment-card, internal-notes-section, activity-timeline-section + types).
-   **Dashboard** (`client/src/pages/dashboard/`): `index.tsx` (189 lines) orchestrates 6 sub-components in `components/` (typing-jobs-lane, appointments-lane, needs-attention, pipeline-overview, widgets, shared helpers + types).
-   **CRM Dashboard** (`client/src/pages/crm-dashboard/`): `index.tsx` (121 lines) orchestrates 6 sub-components in `components/` (attention-list, quick-actions-sidebar, bottom-panels, deletion-requests, use-crm-data hook + types).
-   **Admin Console** (`client/src/pages/admin/`): `index.tsx` (~210 lines orchestrator) imports 16 self-contained tab/section components (companies-tab, centers-tab, staff-tab, services-tab, job-types-tab, vendors-tab, accounts-tab, settings-section, api-keys-tab, attestation-services-tab, email-templates-tab, monthly-sheet-section, import-export-section, login-audit-tab, password-reset-requests-tab, change-log-tab, workdrive-backup-section, deletion-requests-tab). A "Communications" section houses the Email Templates tab.
-   **Manager Console** (`client/src/pages/manager-console/`): `index.tsx` (~93 lines) orchestrates 7 tab components + pin gate in `components/` (pin-gate, companies-tab, centers-tab, staff-tab, services-tab, users-tab, import-tab, shared utils).
-   **Appointments** (`client/src/pages/appointments/`): `index.tsx` orchestrates components + hooks in `components/` (appointment-card, ready-to-schedule-card, appointment-dialogs, appointment-stats, appointment-calendar, appointment-toolbar, appointment-list-sections, resend-email-dialog, communications-dialog, view-card-dialog, view-wo-sheet + use-appointments-data, use-appointment-actions, appointment-messages-handler hooks + types). `schedule-medical.tsx` and `schedule-eid.tsx` share 4 extracted components. Appointment card has comprehensive action buttons: Mark Done, Reschedule, Cancel (with 15s undo + reason), Communications (merged email/messages), Resend Email, View Card (inline dialog), View WO (slide-over), ••• overflow menu. DB schema includes: cancelReason, rescheduleReason, emailSendLog (JSONB), cardViewedAt.
-   **Typing Jobs** (`client/src/pages/typing-jobs/`): `index.tsx` (~484 lines), `detail.tsx` (~481 lines), and `new.tsx` (~585 lines) use 10 extracted components in `components/` (job-header, workflow-actions, workflow-dialogs, wo-selector, quick-create-wo-dialog, tj-appointment-indicator, tj-list-views, tj-detail-tabs, email-preview-step, job-details-step).
-   **Vendor Job Detail** (`client/src/pages/vendor-v2/`): `job-detail.tsx` (~312 lines) orchestrates 7 step components + shared types in `components/` (job-header, wizard-stepper, overview-step, documents-step, completion-step, comments-section, resubmission-dialog, types).

#### Shared Business Logic Modules
-   `client/src/lib/pipeline-stage.ts`: Pipeline status computation (`getPipelineInfo`, `getNextAction`, `getMedicalStatus`, `getEidStatus`, `needsAttention`, stage configs).
-   `client/src/lib/utils.ts`: `getInitials()` for avatar fallbacks, `cn()` for class merging.
-   `client/src/lib/format-date.ts`: `isToday()`, `formatTime()`, `formatDate()`, `formatDateWithWeekday()`.

#### UX Guardrail Components
-   `client/src/components/ui/confirmation-dialog.tsx`: Reusable confirmation dialog wrapping AlertDialog for destructive actions (abort typing job, delete note). Supports loading state and destructive styling.
-   `client/src/components/ui/query-error-state.tsx`: Error state with retry button for failed API queries, used in work-orders list, dashboard, and CRM dashboard.

### Backend

The backend utilizes Express.js 5 with TypeScript, providing a RESTful JSON API. Drizzle ORM with a PostgreSQL dialect manages database interactions, with shared schema definitions for type safety. Zod schemas generated from Drizzle are used for API validation. A storage abstraction layer is implemented for flexible database operations.

**Modular Architecture**: The backend is structured with extracted middleware, services, and domain route modules:
- `server/middleware/auth.ts` — Auth middleware (requireAuth, requireRole, requireOpsRole, requireVendorAuth, requireTypingVendor, requireAttestationVendor, requireDocCustodyRole, loginRateLimit)
- `server/middleware/validation.ts` — Request validation helpers (validateBody, validateEmailField)
- `server/services/notification-service.ts` — Staff and vendor notification functions (notifyStaffByRoles, notifySingleUser, notifyVendorUsers)
- `server/services/transition-service.ts` — Work order auto-transition and auto-complete logic
- `server/services/background-jobs.ts` — Background job scheduler (delay detection, appointment reminders with per-user dedup)
- `server/routes/auth.ts` — Authentication, user management, manager console, change notifications, staff notifications, API key management (~860 lines)
- `server/routes/vendor-portal.ts` — Vendor login/auth, dashboard, jobs, files, comments, wallet, biometrics (~1000 lines)
- `server/routes/typing-jobs.ts` — Typing job CRUD, file uploads, comments, vendor assignment (~550 lines)
- `server/routes/scheduling.ts` — Appointment scheduling, medical/EID queues, Apple Wallet passes (~1290 lines)
- `server/routes/attestation.ts` — Attestation service requests, document custody records, handoffs (~1060 lines)
- `server/routes/dashboard.ts` — Dashboard stats, activity feed, weekly overview, duplicate check (~820 lines)
- `server/routes/work-orders.ts` — Work order CRUD, status transitions, comments, files, notes (~1040 lines)
- `server/routes/entities.ts` — Companies, centers, service types, job types, staff CRUD (~840 lines)
- `server/routes/admin.ts` — Admin operations, wallet management, document custody, data export (~1130 lines)
- `server/routes/admin-import.ts` — Excel import/export, deletion requests, idle job management (~1840 lines)
- `server/routes/types.ts` — Shared RouteDeps interface for dependency injection into route modules
- `server/routes/index.ts` — Barrel re-export of all middleware/services and route modules
- `server/route-schemas.ts` — Shared Zod schemas used across route modules
- `server/routes.ts` — Thin route orchestrator (~190 lines) importing and registering all 10 domain modules

### Database

#### Schema Architecture (Task #95: Vendor Portal Execution-Only Schema Migration)

The database uses a **dual-schema architecture** on a single shared Replit PostgreSQL instance. Both Client Portal and Vendor Portal connect to the same database via `DATABASE_URL` (owned by Client Portal):

- **`public` schema** — Owned and managed by Client Portal: `companies`, `work_orders`, `staff`, `service_types`, `users`, `appointments`, `centers`, `files`, `messages`, `audit_log`, etc.
- **`vendor` schema** — Owned and managed by Vendor Portal: `vendors`, `typing_jobs`, `typing_job_results`, `typing_job_comments`, `vendor_approvals`, `vendor_wallet_ledger`, `vendor_statements`, `vendor_invoices`, `vendor_notifications`, `vendor_users`, `cross_portal_events`, `medical_cases`, `medical_appointment_cycles`, `medical_appointment_events`, `biometrics_cases`, `biometrics_appointment_cycles`, `biometrics_appointment_events`, `attestation_sr`, `attestation_sr_steps`, `attestation_sr_activity_log`, `attestation_categories`, `attestation_services`, `attestation_service_variants`, `attestation_service_step_definitions`, `job_types`, `app_settings`.

**Connection model**: Vendor Portal connects to the shared Replit Postgres database using Client Portal's `DATABASE_URL`. Access to the `vendor` schema is scoped through a `vendor_portal` role, keeping each portal's write surface isolated within its own schema.

**Ownership boundary**: The Vendor Portal (`/vendor/*` routes) may **read** `public` tables (companies, work_orders, staff) but **never writes** to them. All Vendor Portal writes go to `vendor.*` tables. Cross-portal communication flows through `vendor.cross_portal_events`.

**Cross-portal events** (`vendor.cross_portal_events`): Vendor Portal inserts rows with `status='pending'`; only the Client Portal consumer may set `status='sent'` and `processed_at`. This is enforced in code — never bypassed by vendor routes.

**`vendor.vendor_notifications`**: Uses `read_at TIMESTAMP` (null = unread) instead of `is_read BOOLEAN`. Notifications are never deleted on read — they form a persistent inbox.

**`vendor.app_settings`**: All setting keys use the `vp_` prefix in column names.

The core entities include Users (with 7 roles: Admin, Client Relationship Manager, Medical Support, Medical Support - Temporary, Vendor, Client Coordinator, Client Manager), Companies, Work Orders, Appointments, Typing Jobs, Vendors, and Vendor Wallet Ledgers. It also manages Service Types, Centers, Staff, Files, Messages, and Audit Logs, using `pgEnum` for type-safe enumerations. Database indexes are defined on all major foreign key columns for query performance. Cascade delete logic in `storage.ts` ensures deleting a work order removes all child records. Deleting staff or centers nullifies dangling references in appointments and companies before deletion.

Migration `0008_vendor_schema_migration.sql` creates the vendor schema and all its tables.

#### Work Order Status Model

Work orders use a rationalized status model: `Draft` → `AtVendor` → `ReadyToSchedule` → `Scheduled` → `Completed` (or `Cancelled`). The old `Inactive` and `Delayed` statuses have been removed. All new work orders start as `Draft`. Vendor delay is tracked via an `isDelayed` boolean flag on the work order (not a separate status), auto-set when typing jobs at a vendor exceed the configured threshold, and auto-cleared when they resolve. Status transitions (`AtVendor`, `ReadyToSchedule`) are triggered automatically by `checkAndAutoTransitionWorkOrder()` in server/routes.ts after typing job actions (submit to vendor, vendor completion). `Scheduled` is set when an appointment is booked for a WO in `ReadyToSchedule` or `Draft` state.

### Performance Optimizations

-   **Bulk Fetches**: Dashboard routes use bulk `getWorkOrdersByIds()`, `getCenters()`, and `getCompanies()` with Map lookups instead of per-record N+1 queries.
-   **Targeted DB Queries**: `getWoPhotoMap()` queries only photo documents at the database level (filtered by `documentType='Photo'` and `fileUrl IS NOT NULL`) instead of fetching all documents. `countDuplicateApplicants()` uses SQL `COUNT(*)` instead of fetching all work orders for duplicate checking. `getRecentWorkOrders(limit)` uses SQL `LIMIT` instead of fetching all work orders and slicing.
-   **Input Validation**: All update routes (centers, service types, job types) and creation routes (comments, files) validate `req.body` through Zod schemas (`.partial()` for updates) before passing to storage, preventing field injection.
-   **Frontend Caching**: Dashboard queries use `staleTime: 30000` (30s) for stats and activity, `staleTime: 60000` (1min) for weekly overview and photos. All other queries default to `staleTime: Infinity` with manual invalidation via `queryClient.invalidateQueries` after mutations. Notifications poll every 30 seconds (`refetchInterval: 30000`).
-   **Session Management**: Auth heartbeat checks `/api/auth/me` every 5 minutes. Session expiry shows a modal overlay prompting re-login (with `intentionalLogout` flag to prevent false triggers on normal logout).

### Authentication and Authorization

Session-based authentication uses `express-session` + `connect-pg-simple` for PostgreSQL session storage, with passwords hashed via `bcryptjs`. Role-Based Access Control (RBAC) is enforced at both layers:
-   **Frontend**: Centralized `ROUTE_ACCESS` config in `App.tsx` maps URL path prefixes to allowed roles. `AuthGuard` renders an `AccessDenied` page for unauthorized routes. Navigation filtering in `app-layout.tsx` hides inaccessible links. A React `ErrorBoundary` wraps the entire app to catch uncaught render errors and show a recovery UI.
-   **Backend**: All API routes are protected with `requireAuth`, `requireRole()`, or `requireOpsRole` middleware. Only `/api/public/*`, `/api/reschedule/:token`, and auth endpoints are publicly accessible. Security headers via `helmet` (CSP disabled for Vite dev compatibility). Session cookie uses custom name `pro.sid`, `httpOnly`, `secure` in production, and `sameSite: "strict"` in production / `"lax"` in development.
-   **Login Rate Limiting**: Both `/api/auth/login` and `/api/vendor/auth/login` are protected by an in-memory rate limiter — 5 *failed* attempts per minute per IP triggers a 5-minute block. Successful logins clear the counter. Rate limit check runs as middleware; counters are updated inside the route handlers (`recordFailedLogin`/`clearFailedLogins`).
-   **Session Secret**: Production requires `SESSION_SECRET` env var (fails fast if missing). Dev uses a hardcoded fallback.
-   **Vendor Ownership Checks**: All vendor job routes (`files`, `comments`, `start-work`, `complete`, `biometrics`, `delete`) verify `job.vendorId === session.vendorId` before proceeding.
-   **Log Sanitization**: Response body logging in `server/index.ts` masks sensitive fields (password, passwordHash, pin, managerPin, masterPassword, token, refreshToken, secret, key, apiKey, accessToken, authorization) with `***` before writing to console.
-   **Dev-only endpoints**: `/api/auth/quick-login` and `/api/auth/accounts` are gated behind `NODE_ENV !== 'production'`. The login page auto-hides the quick-login account picker when accounts are unavailable (i.e., in production).
A separate session-based authentication system exists for vendors with `requireVendorAuth` middleware.

#### Staff Roles (Our Team)
-   **Admin** (Designation: Managing Director): Full system access, admin console, user management.
-   **Client Relationship Manager** (Designation: Client Relationship Manager, Role: Operations): Primary operations user. Assigns PRO staff, oversees client accounts. Can manage work orders, typing jobs, appointments, companies, vendors, wallet top-ups. Cannot access Admin Console.
-   **Medical Support** (Designation: P.R.O., Role: P.R.O., Medical Support): On-ground role for appointment day. Can view appointments, mark attendance/completion. Cannot edit work orders, typing jobs, companies, vendors, or access wallet/reports.
-   **Medical Support - Temporary** (Designation: Temporary Staff): Same as Medical Support but for temporary staff. Additional restrictions on wallet data and full document history.

#### Client Roles
-   **Client Coordinator**: Operational point of contact at a client company.
-   **Client Manager**: Higher-level role at the client company with broader oversight.

#### Vendor Roles
-   **Vendor** (Designation: Vendor, Role: Medical and ID Typing): Active vendor portal user. Linked to a vendor entity via `vendorId`.

### UI/UX Design

The design adopts a glassmorphism aesthetic with warm gold/amber palette, soft gradients, rounded corners, and a compact layout. Custom components extend `shadcn/ui` for specific application patterns. Key UX features include smooth page transitions, dynamic greetings, breadcrumb navigation, copy-to-clipboard functionality, relative date displays, mobile Floating Action Buttons (FABs), and comprehensive loading states. **Spotlight Search** (`Ctrl+Space` or `Ctrl+K`): Apple Spotlight-style command palette with glassmorphism, quick actions (New WO, Schedule Medical/EID, Top Up Wallet), localStorage recents, rich search results with inline StatusBadges and company names, colored category icons, and keyboard navigation hints footer. **Theme**: Light/dark mode toggle only (`pro-app-mode` in localStorage), managed by `useTheme` hook. Alternate themes (cyber, desert, ocean, apple) and background wallpapers have been removed.

### Core Features

-   **Work Order Management**: Unique WO numbers, applicant details, company linking. Restricted to Admin and CRM roles. All new WOs start as `"Inactive"` status (pre-approval gate). An **Activate Work Order** dialog requires both "Entry Permit approved" and "Change Status approved" checkboxes before transitioning to `"Draft"`. For dependent-visa service types (`serviceType.isDependent = true`), the dialog also prompts an Adult/Minor choice — minors (`isMinor = true`) permanently skip the Medical track. The `isMinor` flag is stored on the WO; the WO detail pipeline filters medical jobs accordingly. Service types have an `isDependent` boolean toggle in the Admin Console. WO statuses: Inactive, Draft, Scheduled, Completed, Cancelled, Delayed. **Auto-delay**: When typing jobs at a vendor exceed the configurable threshold (default 48 hours, stored in `appSettings.vendorDelayThresholdHours`), the WO auto-transitions to "Delayed" with alarming red pulsing visuals. Previous status stored in `previousStatus` column; reverts when vendor completes. Detection runs on startup, every 15 minutes, and on WO list fetch (throttled 5min). Admin can configure the threshold in the Admin Console settings. **Auto-complete**: When all required tracks (determined by service type flags) reach terminal states, the WO automatically moves to "Completed". Terminal states: typing jobs = `ReadyForScheduling`/`Returned`, appointments = `Completed`/`FollowUpCompleted`. Requires at least one job/appointment per required track. Triggered after appointment status updates and vendor job completions. Skipped if no service type assigned.
-   **Appointment Scheduling**: Dedicated scheduling pages for Medical and Emirates ID, restructured around a **vendor-data-driven scheduling queue**. Both wizards use a 2-step flow:
    - **Step 1 (Select & Configure)**: Shows a ready-to-schedule queue fetched from `GET /api/appointments/scheduling-queue`. Clicking a queue item auto-fills all fields (application number, center, staff, VIP) from vendor typing job results and company preferences. User only needs to pick date/time. A "Schedule for a different WO" manual search fallback is available.
    - **Step 2 (Review & Send)**: Summary card + Email/WhatsApp notification previews with copy-to-clipboard.
    - **Medical queue**: WOs where Medical typing job is `ReadyForScheduling` and no active Medical appointment exists.
    - **EID queue**: WOs where EID typing job is `ReadyForScheduling`, `biometricsRequired = true`, and no active EID appointment exists. Vendor's suggested biometrics center and datetime are pre-filled when available.
    - **Job details card**: Shows completion date, application reference, and notes for the selected queue item. Vendor identity is intentionally hidden from scheduling pages (scheduling is a team↔client workflow).
    - Dashboard "Needs Scheduling" section also respects the biometrics flag — only shows "Schedule EID" for WOs where vendor flagged biometrics required.
    - Follow-up workflow for medical retests preserved: mark completed appointment as "Follow-Up Required", then schedule follow-up at a configured fixed center, tracked through FollowUpScheduled → FollowUpCompleted. Follow-up center is stored in system config (`appSettings.followUpCenter`).
    - Appointment statuses: Scheduled, Completed, Cancelled, Rescheduled, FollowUpRequired, FollowUpScheduled, FollowUpCompleted.
-   **Typing Job Workflow**: Auto-creation of Medical/EID jobs, vendor assignment, immediate wallet deductions on completion, and status tracking (Draft, SubmittedToVendor, InProcess, ReadyForScheduling, OnHold, Returned, Rejected, Aborted) with unique job codes. Team actions: Submit, On Hold, Resume, Abort, Re-assign. Vendor actions: Start Work, Complete, Return, Reject. State machine in `server/typing-job-machine.ts`. Vendor portal shows "Completed" for ReadyForScheduling status.
-   **Vendor Management**: CRUD operations for vendors, restricted to Admin and CRM roles.
-   **Wallet Flow**: Vendor wallet uses a ledger system. Topups are positive, debits negative. Balance is the sum of all entries. Wallet can go negative (no blocking checks). Deductions happen immediately when vendor marks job as completed (status → ReadyForScheduling). Wallet top-up access is available to both Admin and CRM roles.
-   **Document Management**: Supports presigned URL upload flows to object storage, document status updates, and context-based filtering of requirements.
-   **Input Formatting**: `Proper Case` auto-formatting for textual inputs and phone number masking.
-   **Internal Notes & Activity Timeline**: Dedicated internal notes system for team communication on work orders and an audit trail for work order activity.
-   **Company Profile UX**: Always-editable forms with persistent save functionality and unsaved changes warnings. Company Emails CRUD section with inline edit/delete, max 3 emails per company, with companyId ownership validation on update/delete routes.
-   **Vendor Portal**: A separate vendor-facing portal with its own authentication, dashboard (showing job stats, recent jobs), job detail views (with document upload and biometrics forms), vendor actions (Start Work, Complete), immediate wallet deduction on completion, real-time notifications (new job, wallet topup, wallet deduction, comments), and a wallet section displaying balance and transaction history.
-   **Vendor Logo**: Vendors have an optional `logoUrl` field (stored in object storage). Admins can upload/change a vendor logo via the vendor edit dialog in the Admin Console. The vendor login page dynamically fetches and displays the vendor's name and logo when the username field loses focus (via `GET /api/public/vendor-lookup?email=`), showing a generic "Vendor Portal" placeholder if no match is found.
-   **Vendor User Accounts**: Vendor portal users must have a `vendorId` field set to link them to their vendor entity. This is critical for notifications and job visibility.
-   **Notification System**: Unified single staff notification bell (`StaffNotificationsBell`) with unread count badge and slide-out panel. The old audit-log-based activity bell has been removed. Staff notifications stored in `staff_notifications` table with type, title, message, read status, and related entity references. Triggered for: new WO created (Admin), WO completed, typing job returned/rejected by vendor (Admin/CRM/PRO), appointment tomorrow (Admin/Medical Support), WO marked Delayed (Admin/CRM), retest required, medical failed, no-show. Appointment reminders are deduplicated per day. Staff notification API: `GET /api/staff-notifications`, `GET /api/staff-notifications/unread-count`, `PUT /api/staff-notifications/read-all`, `PUT /api/staff-notifications/:id/read` (with ownership verification). Vendor-side notification center with bell icon showing unread count, mark-as-read functionality. Vendor notifications triggered for: new job assigned, wallet top-up, wallet deduction, new comments on jobs. The audit log table continues to exist for admin audit history (used by CRM dashboard activity panel via `/api/activity` and main dashboard via `/api/activity/my`) but is no longer surfaced as a notification feed. The typing-job-machine supports `notify_staff` side effects for transition-triggered staff notifications.
-   **Work Order Command Center UX**: The app follows a Work Order-centric design where the WO detail page is the primary action hub. Key UX features:
    - **Pipeline Progress Bar** (`client/src/lib/pipeline-stage.ts`): Shared utility that computes pipeline stages (New → At Vendor → Ready to Schedule → Scheduled → Follow-Up → Complete, plus Needs Attention) for Medical and EID tracks based on typing job and appointment statuses. Used across WO detail, WO list, and dashboard. Shows "Not Required" for tracks without typing jobs.
    - **WO Detail**: Shows a dual-track pipeline bar with "Not Required" indicators for tracks without typing jobs, smart "Next Action" banner with context-aware suggestions (including "Complete & Deliver" when all steps are done), and expanded typing job cards with inline vendor results, documents, comments, and action buttons (Abort). Tabs are controlled and switch automatically based on next-action clicks. Pipeline bar TrackRows are clickable — clicking a track switches to the relevant tab (typing or appointments) based on the track's stage.
    - **WO List**: Pipeline stage badges and filters on all view modes (cards, table, compact, kanban). Supports `?pipeline=` URL parameter for deep-linking from dashboard.
    - **Dashboard Pipeline Overview**: Visual bar chart showing WO counts at each pipeline stage, clickable to navigate to filtered WO list.
    - **Cross-Workflow Context**: Typing Jobs list shows appointment status for each job. Appointments list shows typing status for each appointment.
-   **Unified Dashboard**: The main dashboard (`/`) serves both Admin and CRM roles with the same layout. It features:
    - **Stat Cards**: Active Jobs, Ready to Schedule, Today's Appointments, Wallet balance.
    - **Alerts**: Delayed WO alerts (pulsing red) and low wallet balance warnings.
    - **Pipeline Overview**: Visual bar of WO pipeline stages, clickable to filtered WO list.
    - **Two-Lane Layout** (left 2/3): Typing Jobs lane (unaccepted, in-progress, ready-to-schedule) and Appointments lane (today, upcoming, needs-scheduling) with applicant photo avatars.
    - **Sidebar Column** (right 1/3): Weekly Overview chart (Recharts area chart showing 7-day WO/appointment/typing job counts via `GET /api/dashboard/weekly-overview`) and My Activity timeline (user-specific audit log via `GET /api/activity/my`).
    - Both Admin and CRM see the Dashboard Switcher (Admin → Admin Console, CRM → Manager Console, Medical, Vendor).
    - Uses endpoints: `/api/dashboard/stats`, `/api/dashboard/typing-jobs-summary`, `/api/dashboard/appointments-summary`, `/api/dashboard/weekly-overview`, `/api/activity/my`, `/api/work-orders/photos`.
-   **Applicant Photos**: Photo avatars (from `wo_documents` with `documentType = 'Photo'`) are shown alongside applicant names across WO list (all view modes), dashboard lanes, appointment cards, and scheduling pages. Photos fetched via `GET /api/work-orders/photos` which returns a `{ [woId]: photoUrl }` map.
-   **Appointment Email Draft Storage**: When scheduling an appointment (Medical or EID), the generated HTML email is stored in the `emailDraft` column of the appointments table. Email drafts can be viewed on both the WO detail page (expandable appointment cards with "View Email" button) and the Appointments list page.
-   **Productivity Enhancements**: Includes smart action centers, priority indicators for vendor jobs, duplicate applicant detection, a vendor performance dashboard, enhanced global search (Cmd+K), a stats and reports page, stale job alerts for administrators, and mobile-optimized quick actions.
-   **Import/Export**: Monthly Google Sheet import system for 2026 work orders — each month (Jan–Dec) has a saved Sheet URL, Refresh to re-parse for new entries (skips already-imported WOs, empty work rows, and unrecognized service types), Close Month to permanently lock it, and an import count tracker. Excel import/export for bulk management of centers, companies, staff, service types, and job types. **Export All Data** (`GET /api/admin/export`): Downloads a single Excel file with 8 sheets — Companies, Centers, Staff, Service Types, Vendors, Vendor Jobs, Document Requirements, and User Accounts (excluding passwords/PINs). Foreign keys are resolved to human-readable names (e.g., center IDs → center names, staff IDs → staff names). Data model: `sheetMonths` table with `monthYear`, `sheetUrl`, `status` (open/closed), `importedCount`, `lastRefreshedAt`.

### External API Layer

An authenticated REST API for external client dashboard and CRM integrations. API keys are managed in the Admin Console ("API Keys" tab).

-   **API Key Authentication**: Keys are validated via `X-API-Key` header or `Authorization: Bearer <key>`. Keys are 64-character hex tokens generated with `crypto.randomBytes(32)`. Managed via `api_keys` table with type (`client`/`crm`), company/staff scoping, active toggle, and lastUsedAt tracking.
-   **Key Types**: 
    -   **Client keys**: Scoped to a single company. See only that company's work orders, appointments, and company profile.
    -   **CRM keys**: Scoped to a relationship manager's assigned companies (via `rmStaffId`). See work orders and appointments across all assigned companies.
-   **External Endpoints** (in `server/external-routes.ts`):
    -   `GET /api/external/me` — Key info and scope
    -   `GET /api/external/appointments` — Scoped appointments with center and WO details
    -   `GET /api/external/work-orders` — Scoped work orders with service type
    -   `GET /api/external/work-orders/:id` — Detailed WO with appointments and contacts
    -   `GET /api/external/company` — Company profile (client keys only)
    -   `GET /api/external/companies` — Assigned companies (CRM keys only)
-   **Security**: Responses sanitized to exclude internal costs, vendor wallet data, and internal notes. In-memory rate limiter at 100 requests/minute per key. Admin routes mask keys (show only last 8 chars); full key shown only at creation time.
-   **Admin Management** (in `server/routes.ts`): `GET/POST/PATCH/DELETE /api/admin/api-keys` with audit logging for create/delete/toggle actions.

### Deferred / Future Features

### Vendor Portal V2 (Glassmorphic)

A completely renovated vendor portal at `/vendor-v2/*` with Apple/iOS-inspired glassmorphic design. Uses the same backend API endpoints and vendor auth system as the classic portal. Key files:
-   **Layout**: `client/src/components/vendor-v2/layout.tsx` — Full-screen immersive layout with gradient background, bottom tab navigation (Home/EID/Medical/Wallet), notification sheet, `GlassCard`/`GlassSection`/`GlassEmpty`/`GlassSkeleton` utility components.
-   **Dashboard**: `client/src/pages/vendor-v2/dashboard.tsx` — Time-based greeting, alert cards (stale/urgent), 4 metric tiles, pipeline bar, work order groups, activity timeline, quick actions.
-   **EID/Medical Jobs**: `client/src/pages/vendor-v2/eid-jobs.tsx`, `medical-jobs.tsx` — Search, filter pills, stat row, job cards with accent colors, accept mutation.
-   **Wallet**: `client/src/pages/vendor-v2/wallet.tsx` — Balance hero, transactions grouped by date.
-   **Job Detail**: `client/src/pages/vendor-v2/job-detail.tsx` — 3-step wizard (Overview/Documents/Complete) with full biometrics, file upload, comments, resubmission dialog. Full parity with classic portal wizard.
-   **CSS**: Glassmorphic utility classes in `client/src/index.css` — `.v2-portal-root`, `.v2-bg-layer`, `.glass-card`, `.glass-panel`, `.glass-nav`, `.glass-input`, `.glass-pill`, `.glass-skeleton`, `.glass-btn-primary`, `.v2-status-*` badges, `.tour-*` tour overlay/spotlight/tooltip classes.
-   **Guided Tour**: `client/src/components/vendor-v2/guided-tour.tsx` — Interactive 7-step tutorial overlay with glassmorphic tooltips, spotlight cutout highlighting, step progress dots, and Back/Next/Skip controls. Auto-launches on first visit (persisted via `localStorage["v2-tour-completed"]`). Re-triggerable via `?` help button in the V2 header. Target elements use `data-tour` attributes in layout.tsx and dashboard.tsx.
-   **Routes**: Registered in `App.tsx` under `VendorV2Layout` wrapper with same `VendorAuthProvider`/`VendorAuthGuard`.

## Attestation Document Custody & Signature Acknowledgements (Task #57)

A full physical document custody chain system for attestation service requests, tracking documents through four handover points with identity proof, ID photos, and digital signatures.

### Data Model (shared/schema.ts)
-   **Enums**: `attestationSrStatusEnum` (Draft/SentToVendor/AcceptedByVendor/InProgress/Completed/Cancelled), `physicalCustodyStatusEnum` (WithClient/WithUs/WithVendor/ReturnedToClient), `handoverDirectionEnum` (ClientToUs/UsToVendor/VendorToUs/UsToClient)
-   **`attestationServiceRequests`**: SR tracking with `srNumber`, `physicalCustodyStatus`, `currentCustodian`, `currentResponsibleStaffId`, `assignedProId`, `vendorId`
-   **`documentCustodyLog`**: Immutable event log — counterparty name/contact, ID photo URL, signature URL, optional approver fields, receiving staff name/signature for VendorToUs dual-signatory, `acknowledgedAt` timestamp

### Backend (server/routes.ts, server/storage.ts)
-   `createCustodyLogWithSrUpdate()`: Atomic transaction inserting a custody log entry and updating SR's `physicalCustodyStatus` + `currentCustodian` in one operation
-   **PRO Routes** (`requireAuth`): GET/POST `/api/attestation/sr`, GET/PATCH `/api/attestation/sr/:id`, GET/POST `/api/attestation/sr/:id/custody`
-   **Attestation Vendor Portal** (separate session `req.session.attestationVendorUserId`, `requireAttestationVendor` middleware): POST `/api/attestation-vendor/auth/login|logout`, GET `/api/attestation-vendor/auth/me`, GET `/api/attestation-vendor/jobs`, GET/POST `/api/attestation-vendor/jobs/:id/custody`, POST `…/accept`, POST `…/complete`
-   ID photos and signatures uploaded to object storage under `attestation/custody/{srId}/{timestamp}_{type}.{ext}`

### Frontend Components
-   **`SignaturePad`** (`client/src/components/ui/signature-pad.tsx`): Canvas-based signature capture with touch support, `clear()`/`getDataUrl()`/`getBlob()` ref handle
-   **`HandoverForm`** (`client/src/components/attestation/handover-form.tsx`): Multi-stage form (form → confirm → done) with camera capture for ID photo, SignaturePad for counterparty, optional approver section, dual-signatory section for VendorToUs direction
-   **`CustodyTimeline`** (`client/src/components/attestation/custody-timeline.tsx`): Chronological custody event list with image lightbox for ID photos and signatures
-   **PRO Custody Queue** (`/attestation/custody-queue`): Unified task queue showing all SRs with pending custody actions, collapsible timeline per SR, inline handover form
-   **SR Detail** (`/attestation/sr/:id`): Full SR details with embedded custody timeline section
-   **Attestation Vendor Portal** (`/vendor-attestation/login`, `/vendor-attestation/jobs`): Separate portal for attestation vendors — accept jobs, collect documents (HandoverForm for UsToVendor), mark complete, view custody timeline. Login persisted via `req.session.attestationVendorUserId` (isolated from `vendorUserId`)

### Route Access
-   `/attestation/*` — Admin, Client Relationship Manager, Medical Support, Medical Support - Temporary
-   `/vendor-attestation/*` — Public (uses its own session-based auth guard)
-   "Doc Custody" sidebar nav now points to the new `/custody-queue` (Task #62 standalone module)

## Document Custody Lifecycle Module (Task #62)

A full standalone document custody lifecycle module for tracking original client documents from receipt to delivery. Operates independently of (but can be linked to) Work Orders and Attestation SRs.

### Data Model (shared/schema.ts)
-   **Enums**: `custodyDocCategoryEnum` (MofaPersonal/MofaBusiness/LawyerAttestation/EmbassyAttestation), `custodyDocSubtypeEnum` (13 doc types), `custodyDocStageEnum` (WithClient/WithUs/WithVendor/ReturnedToClient)
-   **`documentCustodyRecords`**: Core record with `referenceNumber` (CDC-YYYY-NNNN auto-gen), `companyId`, optional `woId`/`srId` link, `docCategory`, `docSubtype`, `docCustomName`, `custodyStage`, `notifyEmail`, `notes`, `createdBy`
-   **`documentCustodyHandoffs`**: Immutable event log per stage transition — `fromStage`, `toStage`, `counterpartyName`, `counterpartyContact`, `counterpartyIdPhotoUrl` (object storage), `notes`, `performedBy`
-   Helper constants: `CUSTODY_DOC_CATEGORY_LABELS`, `CUSTODY_DOC_SUBTYPE_LABELS`, `CUSTODY_DOC_STAGE_LABELS`, `CUSTODY_DOC_SUBTYPES_BY_CATEGORY`

### Backend (server/storage.ts, server/routes.ts)
-   10 new storage methods: `getDocumentCustodyRecords`, `getDocumentCustodyRecordById`, `getDocumentCustodyRecordsByWoId`, `createDocumentCustodyRecord`, `updateDocumentCustodyRecord`, `getNextCustodyRefNumber`, `getDocumentCustodyHandoffs`, `createDocumentCustodyHandoff`, `getDocumentCustodySummary`
-   API routes under `/api/custody/*` with `requireDocCustodyRole` middleware (Admin + CRM + Medical Support)
-   Automated emails on `WithUs` stage (collection receipt) and `ReturnedToClient` stage (delivery notification) when `notifyEmail` set
-   Email templates: `server/email-templates/custody-notifications.ts`

### Frontend
-   **Custody Queue** (`/custody-queue`, `client/src/pages/custody/queue.tsx`): Summary bar (With Us / With Vendor / Overdue / Returned this month), stage tab filters, company/category/stage filter panel, create new record dialog
-   **Custody Detail** (`/custody/:id`, `client/src/pages/custody/detail.tsx`): Stage progress visualization, advance-to-next-stage handoff form with ID photo capture, immutable timeline with all handoffs
-   **WO Custody Panel** (`client/src/components/custody/wo-custody-panel.tsx`): Embeddable panel for Work Order detail pages showing linked custody records + add new
-   **Dashboard Widget** (`client/src/components/custody/dashboard-widget.tsx`): Summary card with live counts, links to custody queue

### Route Access
-   `/custody-queue` and `/custody/:id` — Admin, Client Relationship Manager, Medical Support, Medical Support - Temporary
-   Overdue threshold: 14 days for records stuck in WithUs or WithVendor
-   DB migration in `scripts/post-merge.sh` (Task #62 section)

These features have code preserved but are not active in the current UI:
-   **Bots System**: "Quick Paste WO" and "Appointment Scheduler" bots. Code preserved, listed under Admin Console → Future Updates.
-   **Manager Console**: PIN-protected CRM console for managing entities. Code preserved, listed under Admin Console → Future Updates.
-   **Staff Management Page**: Removed from navigation. User management available through Admin Console.
-   **Vendor Messaging/Communication**: Direct messaging between team and vendor not yet implemented.
-   **Medical Retest Email UX**: Specialized email template for medical retest scenarios not yet implemented.
-   **Reschedule Token Page**: Public reschedule link functionality removed from navigation.

## External Dependencies

### Database

-   **PostgreSQL**: Primary relational database.
-   **connect-pg-simple**: PostgreSQL session store.

### UI Libraries

-   **Radix UI**: Core accessible UI primitives.
-   **shadcn/ui**: Component library built on Radix UI.
-   **Embla Carousel**: Carousel component.
-   **cmdk**: Command palette component.
-   **vaul**: Drawer component.
-   **react-day-picker**: Date selection component.

### Integrations

-   **Zoho WorkDrive**: Integrated for document storage with hierarchical folder structure (Parent → Company → Applicant). Service module in `server/zoho-workdrive.ts` handles OAuth token refresh, folder creation, and file upload. Documents uploaded through the document panel are automatically synced to WorkDrive in the background. Manual sync available via `/api/documents/:id/sync-workdrive`. Bulk sync via `/api/admin/sync-all-documents`. Business data export to Excel via `/api/admin/export-data-to-workdrive`. Connection status at `/api/workdrive/status`. Document stats at `/api/workdrive/document-stats`. Admin Console has a "WorkDrive Backup" tab for managing sync and exports. Environment variables (stored as Replit secrets/env vars): `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_DOMAIN`, `ZOHO_API_DOMAIN`, `ZOHO_WORKDRIVE_PARENT_FOLDER_ID`. The `wo_documents` table has `workdriveFileId` and `workdriveLink` columns for tracking sync status.
-   **Email Service**: Configured for notifications (`notifications@procompany.ae`).
-   **WhatsApp**: Used for generating client communication messages.
-   **Replit Object Storage**: Utilized for presigned URL document upload flows.
