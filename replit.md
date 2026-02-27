# The P.R.O. Company Portal

## Overview

This project is an internal enterprise web application for The P.R.O. Company™, serving as an operations portal and vendor management system. Its primary purpose is to streamline work order processing, appointment scheduling (medical/Emirates ID), and vendor-based typing workflows. The system also includes vendor wallet accounting and file storage integration capabilities. The application aims for a premium, minimal, Apple-inspired glassmorphism UI/UX, optimized for both mobile and desktop, enhancing efficiency and user experience in managing company operations and vendor interactions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript, using Vite, Wouter for routing, and TanStack React Query for state management. It leverages `shadcn/ui` (built on Radix UI) for components and TailwindCSS for styling, supporting light/dark modes. Forms are managed with React Hook Form and Zod validation. The structure is pages-based, with shared components and custom UI extensions.

### Backend

The backend utilizes Express.js 5 with TypeScript, providing a RESTful JSON API. Drizzle ORM with a PostgreSQL dialect manages database interactions, with shared schema definitions for type safety. Zod schemas generated from Drizzle are used for API validation. A storage abstraction layer is implemented for flexible database operations.

### Database

The PostgreSQL database includes core entities such as Users (with roles: Admin, Client Relationship Manager, Medical Support, Medical Support - Temporary, Vendor), Companies, Work Orders, Appointments, Typing Jobs, Vendors, and Vendor Wallet Ledgers. It also manages Service Types, Centers, Staff, Files, Messages, and Audit Logs, using `pgEnum` for type-safe enumerations.

### Authentication and Authorization

Session-based authentication uses `express-session` + `connect-pg-simple` for PostgreSQL session storage, with passwords hashed via `bcryptjs`. Role-Based Access Control (RBAC) is enforced at both layers:
-   **Frontend**: Centralized `ROUTE_ACCESS` config in `App.tsx` maps URL path prefixes to allowed roles. `AuthGuard` renders an `AccessDenied` page for unauthorized routes. Navigation filtering in `app-layout.tsx` hides inaccessible links.
-   **Backend**: All API routes are protected with `requireAuth`, `requireRole()`, or `requireOpsRole` middleware. Only `/api/public/*`, `/api/reschedule/:token`, and auth endpoints are publicly accessible.
A separate session-based authentication system exists for vendors with `requireVendorAuth` middleware.

#### Staff Roles
-   **Admin**: Full system access, admin console, user management.
-   **Client Relationship Manager (CRM)**: Primary operations user. Can manage work orders, typing jobs, appointments, companies, vendors, wallet top-ups. Cannot access Admin Console.
-   **Medical Support**: On-ground role for appointment day. Can view appointments, mark attendance/completion. Cannot edit work orders, typing jobs, companies, vendors, or access wallet/reports.
-   **Medical Support - Temporary**: Same as Medical Support but for temporary staff. Additional restrictions on wallet data and full document history.

#### Vendor Roles (legacy roles kept for data compatibility)
-   **Vendor**: Active vendor portal user. Linked to a vendor entity via `vendorId`.
-   **Vendor Accountant**: Legacy role, kept in schema.
-   **Vendor Manager**: Legacy role, kept in schema.

### UI/UX Design

The design adopts an Apple-inspired glassmorphism aesthetic with soft gradients, rounded corners, and a compact layout. Custom components extend `shadcn/ui` for specific application patterns. Key UX features include smooth page transitions, dynamic greetings, breadcrumb navigation, copy-to-clipboard functionality, relative date displays, mobile Floating Action Buttons (FABs), and comprehensive loading states. **Spotlight Search** (`Ctrl+Space` or `Ctrl+K`): Apple Spotlight-style command palette with glassmorphism, quick actions (New WO, Schedule Medical/EID, Top Up Wallet), localStorage recents, rich search results with inline StatusBadges and company names, colored category icons, and keyboard navigation hints footer.

### Core Features

-   **Work Order Management**: Unique WO numbers, applicant details, company linking. Restricted to Admin and CRM roles. All new WOs start as `"Inactive"` status (pre-approval gate). An **Activate Work Order** dialog requires both "Entry Permit approved" and "Change Status approved" checkboxes before transitioning to `"Draft"`. For dependent-visa service types (`serviceType.isDependent = true`), the dialog also prompts an Adult/Minor choice — minors (`isMinor = true`) permanently skip the Medical track. The `isMinor` flag is stored on the WO; the WO detail pipeline filters medical jobs accordingly. Service types have an `isDependent` boolean toggle in the Admin Console. WO statuses: Inactive, Draft, Scheduled, Completed, Cancelled, Delayed. **Auto-delay**: When typing jobs at a vendor exceed the configurable threshold (default 48 hours, stored in `appSettings.vendorDelayThresholdHours`), the WO auto-transitions to "Delayed" with alarming red pulsing visuals. Previous status stored in `previousStatus` column; reverts when vendor completes. Detection runs on startup, every 15 minutes, and on WO list fetch (throttled 5min). Admin can configure the threshold in the Admin Console settings. **Auto-complete**: When all required tracks (determined by service type flags) reach terminal states, the WO automatically moves to "Completed". Terminal states: typing jobs = `ReadyForScheduling`/`Returned`, appointments = `Completed`/`FollowUpCompleted`. Requires at least one job/appointment per required track. Triggered after appointment status updates and vendor job completions. Skipped if no service type assigned.
-   **Appointment Scheduling**: Dedicated scheduling pages for Medical and Emirates ID, featuring a multi-step wizard or quick mode, center filtering, application number auto-fill from typing jobs, preferred center detection, and generation of HTML email templates/WhatsApp messages. Includes robust handling for scheduling conflicts, rescheduling, status updates, a "Ready to Schedule" section for jobs completed by vendors, and a weekly calendar view. Medical Support can view and mark attendance/completion. Appointment statuses: Scheduled, Completed, Cancelled, Rescheduled, FollowUpRequired, FollowUpScheduled, FollowUpCompleted. Follow-up workflow for medical retests: mark completed appointment as "Follow-Up Required", then schedule follow-up at a configured fixed center, tracked through FollowUpScheduled → FollowUpCompleted. Follow-up center is stored in system config (`appSettings.followUpCenter`).
-   **Typing Job Workflow**: Auto-creation of Medical/EID jobs, vendor assignment, immediate wallet deductions on completion, and status tracking (Draft, SubmittedToVendor, InProcess, ReadyForScheduling, OnHold, Returned, Rejected, Aborted) with unique job codes. Team actions: Submit, On Hold, Resume, Abort, Re-assign. Vendor actions: Start Work, Complete, Return, Reject. State machine in `server/typing-job-machine.ts`. Vendor portal shows "Completed" for ReadyForScheduling status.
-   **Vendor Management**: CRUD operations for vendors, restricted to Admin and CRM roles.
-   **Wallet Flow**: Vendor wallet uses a ledger system. Topups are positive, debits negative. Balance is the sum of all entries. Wallet can go negative (no blocking checks). Deductions happen immediately when vendor marks job as completed (status → ReadyForScheduling). Wallet top-up access is available to both Admin and CRM roles.
-   **Document Management**: Supports presigned URL upload flows to object storage, document status updates, and context-based filtering of requirements.
-   **Input Formatting**: `Proper Case` auto-formatting for textual inputs and phone number masking.
-   **Internal Notes & Activity Timeline**: Dedicated internal notes system for team communication on work orders and an audit trail for work order activity.
-   **Company Profile UX**: Always-editable forms with persistent save functionality and unsaved changes warnings.
-   **Vendor Portal**: A separate vendor-facing portal with its own authentication, dashboard (showing job stats, recent jobs), job detail views (with document upload and biometrics forms), vendor actions (Start Work, Complete), immediate wallet deduction on completion, real-time notifications (new job, wallet topup, wallet deduction, comments), and a wallet section displaying balance and transaction history.
-   **Vendor Logo**: Vendors have an optional `logoUrl` field (stored in object storage). Admins can upload/change a vendor logo via the vendor edit dialog in the Admin Console. The vendor login page dynamically fetches and displays the vendor's name and logo when the username field loses focus (via `GET /api/public/vendor-lookup?email=`), showing a generic "Vendor Portal" placeholder if no match is found.
-   **Vendor User Accounts**: Vendor portal users must have a `vendorId` field set to link them to their vendor entity. This is critical for notifications and job visibility.
-   **Notification System**: Team-side notification bell with activity feed (reads from audit log). Vendor-side notification center with bell icon showing unread count, mark-as-read functionality. Vendor notifications triggered for: new job assigned, wallet top-up, wallet deduction, new comments on jobs.
-   **Work Order Command Center UX**: The app follows a Work Order-centric design where the WO detail page is the primary action hub. Key UX features:
    - **Pipeline Progress Bar** (`client/src/lib/pipeline-stage.ts`): Shared utility that computes pipeline stages (New → At Vendor → Ready to Schedule → Scheduled → Follow-Up → Complete, plus Needs Attention) for Medical and EID tracks based on typing job and appointment statuses. Used across WO detail, WO list, and dashboard. Shows "Not Required" for tracks without typing jobs.
    - **WO Detail**: Shows a dual-track pipeline bar with "Not Required" indicators for tracks without typing jobs, smart "Next Action" banner with context-aware suggestions, and expanded typing job cards with inline vendor results, documents, comments, and action buttons (Abort). Tabs are controlled and switch automatically based on next-action clicks.
    - **WO List**: Pipeline stage badges and filters on all view modes (cards, table, compact, kanban). Supports `?pipeline=` URL parameter for deep-linking from dashboard.
    - **Dashboard Pipeline Overview**: Visual bar chart showing WO counts at each pipeline stage, clickable to navigate to filtered WO list.
    - **Cross-Workflow Context**: Typing Jobs list shows appointment status for each job. Appointments list shows typing status for each appointment.
-   **Two-Lane Dashboard**: The main dashboard is organized around the two core workflows — Typing Jobs (left lane) and Appointments (right lane). Each lane shows actionable items: unaccepted jobs, in-progress jobs, ready-to-schedule jobs, today's appointments, upcoming appointments, and needs-scheduling items with direct action buttons. Uses `/api/dashboard/typing-jobs-summary` and `/api/dashboard/appointments-summary` endpoints.
-   **Productivity Enhancements**: Includes smart action centers, priority indicators for vendor jobs, duplicate applicant detection, a vendor performance dashboard, enhanced global search (Cmd+K), a stats and reports page, stale job alerts for administrators, and mobile-optimized quick actions.
-   **Import/Export**: Monthly Google Sheet import system for 2026 work orders — each month (Jan–Dec) has a saved Sheet URL, Refresh to re-parse for new entries (skips already-imported WOs, empty work rows, and unrecognized service types), Close Month to permanently lock it, and an import count tracker. Excel import/export for bulk management of centers, companies, staff, service types, and job types. Data model: `sheetMonths` table with `monthYear`, `sheetUrl`, `status` (open/closed), `importedCount`, `lastRefreshedAt`.

### Deferred / Future Features

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

-   **Zoho WorkDrive**: Integrated for document storage with hierarchical folder structure (Parent → Company → Applicant). Service module in `server/zoho-workdrive.ts` handles OAuth token refresh, folder creation, and file upload. Documents uploaded through the document panel are automatically synced to WorkDrive in the background. Manual sync available via `/api/documents/:id/sync-workdrive`. Bulk sync via `/api/admin/sync-all-documents`. Business data export to Excel via `/api/admin/export-data-to-workdrive`. Connection status at `/api/workdrive/status`. Document stats at `/api/workdrive/document-stats`. Admin Console has a "WorkDrive Backup" tab for managing sync and exports. Environment variables: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_DOMAIN`, `ZOHO_API_DOMAIN`, `ZOHO_WORKDRIVE_PARENT_FOLDER_ID`. The `wo_documents` table has `workdriveFileId` and `workdriveLink` columns for tracking sync status.
-   **Email Service**: Configured for notifications (`notifications@procompany.ae`).
-   **WhatsApp**: Used for generating client communication messages.
-   **Replit Object Storage**: Utilized for presigned URL document upload flows.
