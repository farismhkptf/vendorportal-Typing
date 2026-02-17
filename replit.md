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

The PostgreSQL database includes core entities such as Users (with roles: Admin, Ops, Viewer, Vendor), Companies, Work Orders, Appointments, Typing Jobs, Vendors, and Vendor Wallet Ledgers. It also manages Service Types, Centers, Staff, Files, Messages, and Audit Logs, using `pgEnum` for type-safe enumerations.

### Authentication and Authorization

Session-based authentication uses `express-session` + `connect-pg-simple` for PostgreSQL session storage, with passwords hashed via `bcryptjs`. Role-Based Access Control (RBAC) is implemented with `requireRole()` middleware for server-side protection and `AuthGuard` for client-side route protection. Staff roles include Admin, Client Relationship Manager (CRM), and Medical Assistance Support, each with specific dashboard views and access levels. A separate session-based authentication system exists for vendors.

### UI/UX Design

The design adopts an Apple-inspired glassmorphism aesthetic with soft gradients, rounded corners, and a compact layout. Custom components extend `shadcn/ui` for specific application patterns. Key UX features include smooth page transitions, dynamic greetings, breadcrumb navigation, copy-to-clipboard functionality, relative date displays, mobile Floating Action Buttons (FABs), and comprehensive loading states.

### Core Features

-   **Work Order Management**: Unique WO numbers, applicant details, company linking.
-   **Appointment Scheduling**: Dedicated scheduling pages for Medical and Emirates ID, featuring a multi-step wizard or quick mode, center filtering, application number auto-fill from typing jobs, preferred center detection, and generation of HTML email templates/WhatsApp messages. Includes robust handling for scheduling conflicts, rescheduling, and status updates.
-   **Typing Job Workflow**: Auto-creation of Medical/EID jobs, vendor assignment, wallet deductions, and status tracking (Draft, SentToVendor, InProgress, WaitingForDocs, Returned, SentToClient, OnHold, Rejected, Cancelled, VendorMistake) with unique job codes. Team actions: Submit, Resubmit (from WaitingForDocs), On Hold, Resume, Abort, Deliver to Client, Re-assign. Vendor actions: Accept, Request Resubmission, Complete, Reject.
-   **Vendor Management**: CRUD operations for vendors, a vendor wallet ledger with advance top-ups, auto-deductions, and reversals.
-   **Document Management**: Supports presigned URL upload flows to object storage, document status updates, and context-based filtering of requirements.
-   **Input Formatting**: `Proper Case` auto-formatting for textual inputs and phone number masking.
-   **Internal Notes & Activity Timeline**: Dedicated internal notes system for team communication on work orders and an audit trail for work order activity.
-   **Company Profile UX**: Always-editable forms with persistent save functionality and unsaved changes warnings.
-   **Bots System**: Two conversational bots: "Quick Paste WO" for bulk work order creation from spreadsheets and "Appointment Scheduler" for guided appointment scheduling via chat.
-   **Vendor Portal**: A separate vendor-facing portal with its own authentication, dashboard (showing job stats, recent jobs), job detail views (with document upload and biometrics forms), job actions (Accept, Request Resubmission, Mark Completed, Abort, Resume Work), an approval workflow for completed jobs, real-time notifications, and a wallet section displaying balance and transaction history.
-   **Productivity Enhancements**: Includes smart action centers, priority indicators for vendor jobs, duplicate applicant detection, a vendor performance dashboard, enhanced global search (Cmd+K), a stats and reports page, stale job alerts for administrators, and mobile-optimized quick actions.
-   **Manager Console**: A dedicated console for CRM users with PIN-protected access, enabling management of companies, centers, staff, services, and user accounts. All changes are logged for review and approval by administrators.
-   **Import/Export**: Google Sheet import functionality for work orders (with fuzzy matching and preview), and Excel import/export for bulk management of centers, companies, staff, service types, and job types.

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