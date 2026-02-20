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

Session-based authentication uses `express-session` + `connect-pg-simple` for PostgreSQL session storage, with passwords hashed via `bcryptjs`. Role-Based Access Control (RBAC) is implemented with `requireRole()` and `requireOpsRole` middleware for server-side protection and navigation filtering for client-side route protection. A separate session-based authentication system exists for vendors.

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

The design adopts an Apple-inspired glassmorphism aesthetic with soft gradients, rounded corners, and a compact layout. Custom components extend `shadcn/ui` for specific application patterns. Key UX features include smooth page transitions, dynamic greetings, breadcrumb navigation, copy-to-clipboard functionality, relative date displays, mobile Floating Action Buttons (FABs), and comprehensive loading states.

### Core Features

-   **Work Order Management**: Unique WO numbers, applicant details, company linking. Restricted to Admin and CRM roles.
-   **Appointment Scheduling**: Dedicated scheduling pages for Medical and Emirates ID, featuring a multi-step wizard or quick mode, center filtering, application number auto-fill from typing jobs, preferred center detection, and generation of HTML email templates/WhatsApp messages. Includes robust handling for scheduling conflicts, rescheduling, status updates, a "Ready to Schedule" section for jobs completed by vendors, and a weekly calendar view. Medical Support can view and mark attendance/completion.
-   **Typing Job Workflow**: Auto-creation of Medical/EID jobs, vendor assignment, immediate wallet deductions on completion, and status tracking (Draft, SentToVendor, InProgress, ReadyToSchedule, SentToClient, OnHold, Rejected, Cancelled, VendorMistake) with unique job codes. Team actions: Submit, On Hold, Resume, Abort, Deliver to Client, Re-assign. Vendor actions: Start Work, Complete.
-   **Vendor Management**: CRUD operations for vendors, restricted to Admin and CRM roles.
-   **Wallet Flow**: Vendor wallet uses a ledger system. Topups are positive, debits negative. Balance is the sum of all entries. Wallet can go negative (no blocking checks). Deductions happen immediately when vendor marks job as completed (status → ReadyToSchedule). Wallet top-up access is available to both Admin and CRM roles.
-   **Document Management**: Supports presigned URL upload flows to object storage, document status updates, and context-based filtering of requirements.
-   **Input Formatting**: `Proper Case` auto-formatting for textual inputs and phone number masking.
-   **Internal Notes & Activity Timeline**: Dedicated internal notes system for team communication on work orders and an audit trail for work order activity.
-   **Company Profile UX**: Always-editable forms with persistent save functionality and unsaved changes warnings.
-   **Vendor Portal**: A separate vendor-facing portal with its own authentication, dashboard (showing job stats, recent jobs), job detail views (with document upload and biometrics forms), vendor actions (Start Work, Complete), immediate wallet deduction on completion, real-time notifications (new job, wallet topup, wallet deduction, comments), and a wallet section displaying balance and transaction history.
-   **Vendor User Accounts**: Vendor portal users must have a `vendorId` field set to link them to their vendor entity. This is critical for notifications and job visibility.
-   **Notification System**: Team-side notification bell with activity feed (reads from audit log). Vendor-side notification center with bell icon showing unread count, mark-as-read functionality. Vendor notifications triggered for: new job assigned, wallet top-up, wallet deduction, new comments on jobs.
-   **Productivity Enhancements**: Includes smart action centers, priority indicators for vendor jobs, duplicate applicant detection, a vendor performance dashboard, enhanced global search (Cmd+K), a stats and reports page, stale job alerts for administrators, and mobile-optimized quick actions.
-   **Import/Export**: Google Sheet import functionality for work orders (with fuzzy matching and preview), and Excel import/export for bulk management of centers, companies, staff, service types, and job types.

### Deferred / Future Features

These features have code preserved but are not active in the current UI:
-   **Bots System**: "Quick Paste WO" and "Appointment Scheduler" bots. Code preserved, listed under Admin Console → Future Updates.
-   **Manager Console**: PIN-protected CRM console for managing entities. Code preserved, listed under Admin Console → Future Updates.
-   **Staff Management Page**: Removed from navigation. User management available through Admin Console.
-   **VendorMistake Status Logic**: Full handling for the VendorMistake status (reversals, penalty workflows) not yet implemented.
-   **Vendor Messaging/Communication**: Direct messaging between team and vendor not yet implemented.
-   **Cancellation Wallet Reversal**: Automatic wallet reversal when a job is cancelled after deduction not yet implemented.
-   **Medical Retest Email UX**: Specialized email template for medical retest scenarios not yet implemented.
-   **Full Status Definitions**: Detailed business rules for each typing job status transition not yet documented.
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

-   **Zoho WorkDrive**: Used for file storage (stores file IDs and share links).
-   **Email Service**: Configured for notifications (`notifications@procompany.ae`).
-   **WhatsApp**: Used for generating client communication messages.
-   **Replit Object Storage**: Utilized for presigned URL document upload flows.
