# The P.R.O. Company Portal

## Overview

This project is an internal enterprise web application for The P.R.O. Company™, functioning as an operations portal and vendor management system. Its core purpose is to streamline work order processing, appointment scheduling (medical/Emirates ID), and vendor-based typing workflows. The system also includes vendor wallet accounting and file storage integration capabilities. The application aims for a premium, minimal, Apple-inspired glassmorphism UI/UX, optimized for both mobile and desktop.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, using Vite, Wouter for routing, and TanStack React Query for state management. It leverages `shadcn/ui` (built on Radix UI) for components and TailwindCSS for styling, supporting light/dark modes. Forms are managed with React Hook Form and Zod validation. The structure is pages-based, with shared components and custom UI extensions.

### Backend Architecture

The backend utilizes Express.js 5 with TypeScript, providing a RESTful JSON API. Drizzle ORM with a PostgreSQL dialect manages database interactions, with schema definitions shared for type safety. Zod schemas generated from Drizzle schemas are used for API validation. A storage abstraction layer is implemented for flexible database operations.

### Database Design

The PostgreSQL database includes core entities such as Users (with roles: Admin, Ops, Viewer, Vendor), Companies, Work Orders, Appointments, Typing Jobs, Vendors, and Vendor Wallet Ledgers. It also manages Service Types, Centers, Staff, Files, Messages, and Audit Logs, using `pgEnum` for type-safe enumerations.

### Build System

`tsx` is used for development, while `esbuild` and Vite handle production builds. Drizzle Kit is used for database migrations.

### Role-Based Access Control & Authentication

Session-based authentication using `express-session` + `connect-pg-simple` for PostgreSQL session storage. Passwords hashed with `bcryptjs` (10 rounds). Sessions persist for 7 days.

Three primary staff roles:
- **Admin**: Full access to all features including Admin Console, User Management
- **Client Relationship Manager (CRM)**: Dashboard shows assigned companies (via `rmStaffId`), their work orders, and related appointments
- **Medical Assistance Support**: Dashboard shows assigned medical/EID appointments (via `assistStaffId` or `assignedStaffId`)

Server-side authorization: `requireRole()` middleware protects admin-only endpoints (`/api/users`). Client-side: AuthGuard redirects non-admins from `/admin`, navigation filtered by role.

Default admin: `admin@procompany.ae` / `admin123` (seeded on first run with bcrypt hash).

User accounts managed in Admin Console "User Accounts" tab. Each user links to a staff member via `staffId`.

### UI/UX Decisions

The design follows an Apple-inspired glassmorphism aesthetic with soft gradients, rounded corners, and a compact layout. Custom components extend `shadcn/ui` for application-specific patterns. Accessibility features like input masks, scroll-to-error, and ARIA labels are integrated.

**UX Polish Features:**
- **Page Transitions**: Smooth fade transitions with `prefers-reduced-motion` support.
- **Dynamic Greeting**: Time-based greeting on Dashboard (Good morning/afternoon/evening).
- **Breadcrumb Navigation**: Consistent navigation on detail pages.
- **Copy to Clipboard**: CopyableText component for WO numbers, phone, email with visual feedback.
- **Relative Dates**: RelativeTime component shows "2 hours ago" with hover tooltip for exact timestamps.
- **Mobile FAB**: FloatingActionButton for primary actions on mobile list pages (Work Orders, Typing Jobs, Companies).
- **Loading States**: Loader2 spinner icons on all form submit buttons.

### Technical Implementations

- **Work Order Management**: Unique WO numbers, applicant details, company linking.
- **Appointment Scheduling**: Dedicated scheduling pages for both Medical (`/appointments/schedule-medical`) and Emirates ID (`/appointments/schedule-eid`) with 3-step wizard + quick mode, center filtering by type/tier, auto-fill application numbers from typing jobs, preferred center detection, HTML email templates with clipboard copy (rich formatting), WhatsApp message generation, and company team contact display. Appointments listing page shows Today/Upcoming/Completed/Cancelled sections with action buttons (Done, Reschedule, Cancel) and confirmation dialogs. Duplicate prevention: cannot schedule same WO+type if an active appointment exists. Rescheduling marks current as "Rescheduled" and redirects to scheduling page pre-filled with same WO.
- **Typing Job Workflow**: Auto-creation of Medical/EID jobs, vendor assignment, wallet deductions, status tracking (Draft, SentToVendor, Returned, SentToClient), and unique job codes (M00001, E00001).
- **Vendor Management**: CRUD operations for vendors, vendor wallet ledger with advance top-ups, auto-deductions, and reversals.
- **Document Management**: `woDocuments` and `documentRequirements` tables. Supports presigned URL upload flow to object storage, document status updates, and context-based filtering of requirements.
- **Input Formatting**: `Proper Case` auto-formatting for textual inputs and phone number masking.
- **Internal Notes**: `woNotes` table for team communication. Notes are attached to work orders with add/delete functionality, relative timestamps, and empty state. Accessible via the "Internal Notes" tab on WO detail page.
- **Activity Timeline**: Audit trail display for work orders (shown as "Timeline" tab on WO detail page).
- **Company Profile UX**: Always-editable form (no edit toggle), persistent Save button with dirty state tracking, Ctrl+S keyboard shortcut, unsaved changes warning on navigation/page unload.
- **Bots System**: Two conversational bots accessible from sidebar:
  - **Bot 1 - Quick Paste WO** (`/bots/quick-paste`): Paste spreadsheet rows, auto-parse WO number/company/applicant/service type using fuzzy matching, create work orders in one click.
  - **Bot 2 - Appointment Scheduler** (`/bots/scheduler`): Multi-step chat flow for scheduling Medical/EID appointments. Steps: WO search → confirm details → choose appointment type → view filtered centers (VIP/Normal) → enter application number/date/time → generates copy-ready Email and WhatsApp messages.
  - Shared chat UI components in `client/src/components/ui/bot-chat.tsx` (BotMessage, UserMessage, ChatContainer, ChatInput, OptionButtons, CopyBlock).

## Pending Tasks

None currently.

## Vendor Portal

Complete vendor-facing portal at `/vendor/*` routes with separate session-based auth.

### Architecture
- **Separate Auth**: `vendorUserId`/`vendorId` session fields, `requireVendorAuth` middleware, `VendorAuthProvider`/`useVendorAuth` hook, `VendorAuthGuard`
- **Routes**: `/vendor/login`, `/vendor/dashboard`, `/vendor/jobs`, `/vendor/jobs/:id`, `/vendor/wallet`
- **Shared**: `VendorHeader` component with nav (Dashboard, Jobs, Wallet) and notification bell

### Features
- **Dashboard**: Time-based greeting, stats cards (pending, in-progress, completed, urgent, today's count), recent jobs list sorted by urgency
- **Job Detail**: Full WO info (company, service type, applicant), document requirements with upload status (green check/amber clock), biometrics form for EID jobs
- **Job Actions**: Accept (SentToVendor→InProgress), Request Resubmission (select docs + remarks, →WaitingForDocs), Mark Completed (→Returned, creates approval), Abort (→Cancelled with reason), Resume Work (WaitingForDocs→InProgress)
- **Approval Workflow**: Vendor completion creates `vendorApprovals` record with auto-calculated amount from job type cost. Admin reviews in "Approvals" tab (Admin Console): approve (deducts from wallet, →SentToClient) or reject (sends back to InProgress with reason comment). Approval status visible on vendor job detail.
- **Notifications**: Bell icon with unread count (auto-refresh 30s), Popover dropdown with notification list. Triggers: new job assigned, approval approved/rejected, team comments. `vendorNotifications` table.
- **Wallet**: Balance display, transaction history with job info enrichment, color-coded entry types (Topup=green, Debit=red, Reversal=blue, Adjustment=amber)
- **Team Side**: Typing job detail shows vendor approval status card, re-assign button for Cancelled/VendorMistake jobs to reassign to a different vendor

### Database Tables
- `vendor_approvals`: id, typingJobId, vendorId, calculatedAmount, adjustedAmount, status (Pending/Approved/Rejected), rejectedReason, approvedBy, createdAt, resolvedAt
- `vendor_notifications`: id, vendorUserId, vendorId, type, title, message, relatedJobId, isRead, createdAt

## Recent Changes

- **Manager Console & Change Tracking** (Feb 2026): Manager Console (`/manager-console`) for CRM users with PIN-protected access (default PIN: 0000). Tabs: Companies, Centers, Staff, Services (view + edit), User Accounts (view all, change own password), Import (Google Sheet). All edits logged in `changeNotifications` table with old/new data. Admin Console "Change Log" tab shows pending manager changes with Keep/Revert actions. Revert restores original data. Manager PIN change feature. Master password support (admin sets via settings; works as fallback login for any account). Role-restricted endpoints via `requireManagerRole` middleware.
- **Quick Login** (Feb 2026): One-click login buttons on login page for internal convenience. Public `/api/accounts` endpoint lists user accounts. Passwordless `/api/auth/quick-login` endpoint.
- **Authentication & Role-Based Dashboards** (Feb 2026): Session-based auth system with bcrypt password hashing. Login page with role-based redirects. Admin Console "User Accounts" tab for managing staff accounts. CRM Dashboard (`/crm`) shows assigned companies, work orders, and appointments. Medical Dashboard (`/medical`) shows assigned medical/EID appointments. Server-side `requireRole()` middleware protects admin endpoints. AuthGuard protects client-side routes. Navigation filtered by role in both sidebar and mobile nav.
- **Google Sheet Import** (Feb 2026): Import work orders from a Google Sheet URL. Paste a public Google Sheet link in Admin Console Import/Export tab, system fetches CSV, auto-detects columns (Work Order, Company Name, Staff Name, Work/service type), fuzzy-matches service types and companies against existing records, shows preview table with match status (exact/fuzzy/none), then imports matched rows as Draft work orders. Server-side validation enforces WO uniqueness, company existence, and service type validity. Endpoints: POST /api/admin/preview-gsheet, POST /api/admin/import-gsheet. BOM-safe CSV parsing.
- **Excel Import/Export** (Feb 2026): Added "Import / Export" tab to Admin Console. Download a pre-formatted .xlsx template with 5 sheets (Centers, Companies, Staff, Service Types, Job Types) with example rows, fill it in, and upload to bulk-import. Uses `xlsx` library for generation/parsing and `multer` for file upload. Endpoints: GET /api/admin/template, POST /api/admin/import. Results show per-sheet success/failure counts with error details.
- **Preferred Center Prompt** (Feb 2026): Enhanced Medical & EID appointment scheduling dialogs. When selecting a different center than the company's preferred, offers three options: Go Back, Continue Without Changing, or Set as Default & Continue (updates company profile via PUT /api/companies/:id).

## External Dependencies

### Database

- **PostgreSQL**: Primary database.
- **connect-pg-simple**: For session storage in PostgreSQL.

### UI Framework Dependencies

- **Radix UI**: Accessible UI primitives.
- **shadcn/ui**: Component system built on Radix.
- **Embla Carousel**: Carousel functionality.
- **cmdk**: Command palette component.
- **vaul**: Drawer component.
- **react-day-picker**: Calendar and date picker.

### Integrations

- **Zoho WorkDrive**: Designed for file storage (file IDs and share links are stored).
- **Email Service**: Configured email identity (`notifications@procompany.ae`) for future notification sending.
- **WhatsApp**: Placeholder for client communication generation.
- **Replit Object Storage**: Used for the presigned URL document upload flow.