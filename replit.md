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

### Role-Based Access Control

Four distinct roles (`Admin`, `Ops`, `Viewer`, `Vendor`) provide granular access control to different features and data within the application.

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
- **Appointment Scheduling**: Medical/Emirates ID appointments, client communication, staff assignment, VIP/Normal center filtering.
- **Typing Job Workflow**: Auto-creation of Medical/EID jobs, vendor assignment, wallet deductions, status tracking (Draft, SentToVendor, Returned, SentToClient), and unique job codes (M00001, E00001).
- **Vendor Management**: CRUD operations for vendors, vendor wallet ledger with advance top-ups, auto-deductions, and reversals.
- **Document Management**: `woDocuments` and `documentRequirements` tables. Supports presigned URL upload flow to object storage, document status updates, and context-based filtering of requirements.
- **Input Formatting**: `Proper Case` auto-formatting for textual inputs and phone number masking.
- **Activity Timeline**: Audit trail display for work orders.

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