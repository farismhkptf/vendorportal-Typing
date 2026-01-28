# The P.R.O. Company Portal

## Overview

This is an internal enterprise web application for The P.R.O. Company™, serving as both an internal operations portal and vendor management system. The application manages:

- Work Orders with unique WO numbers (format: X00000) for individual applicants
- Medical and Emirates ID appointment scheduling with client communications
- Vendor typing workflow for medical and EID application processing
- Vendor wallet accounting with advance top-ups, auto-deductions, and reversals
- File storage integration (designed for Zoho WorkDrive)

The UI follows an Apple-inspired, glassmorphism design language with soft gradients, rounded corners, and a premium, minimal aesthetic that works well on both mobile (iPhone-first) and desktop.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: TailwindCSS with custom CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

The frontend follows a pages-based structure in `client/src/pages/` with shared components in `client/src/components/`. Custom UI components extend shadcn/ui with application-specific patterns like `StatCard`, `SectionCard`, `StatusBadge`, and `EmptyState`.

### Backend Architecture

- **Framework**: Express.js 5 with TypeScript
- **API Pattern**: RESTful JSON API with routes prefixed by `/api/`
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: Shared schema in `shared/schema.ts` using Drizzle's pgTable definitions
- **Type Safety**: Zod schemas generated from Drizzle schemas via drizzle-zod for validation

The server uses a storage abstraction layer (`server/storage.ts`) that implements database operations, making it easier to swap implementations or add caching.

### Database Design

PostgreSQL database with the following core entities:
- Users (with roles: Admin, Ops, Viewer, Vendor)
- Companies and Company Emails
- Work Orders (unique WO numbers, linked to applicants and companies)
- Appointments (Medical/EID scheduling)
- Typing Jobs (vendor workflow with multiple statuses)
- Vendors and Vendor Wallet Ledger (accounting)
- Service Types, Centers, Staff
- Files, Messages, Audit Logs

Enums are defined using pgEnum for type safety (user roles, appointment types, job statuses, etc.).

### Build System

- **Development**: tsx for running TypeScript directly
- **Production Build**: Custom build script using esbuild for server bundling and Vite for client
- **Database Migrations**: Drizzle Kit with `db:push` command for schema synchronization

### Role-Based Access Control

Four user roles with different permissions:
- **Admin**: Full access to all features
- **Ops**: Create/edit work orders, schedule appointments, manage typing jobs
- **Viewer**: Read-only access to internal data
- **Vendor**: Vendor portal access only (view assigned jobs, upload outputs, comments)

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage in PostgreSQL

### UI Framework Dependencies
- **Radix UI**: Comprehensive set of accessible, unstyled UI primitives
- **shadcn/ui**: Pre-styled component system built on Radix
- **Embla Carousel**: Carousel/slider functionality
- **cmdk**: Command palette component
- **vaul**: Drawer component
- **react-day-picker**: Calendar/date picker

### Future Integrations (Designed but not fully implemented)
- **Zoho WorkDrive**: File storage (file IDs and share links stored, upload via API placeholder)
- **Email Service**: Email identity configured (notifications@procompany.ae) but sending marked as "later"
- **WhatsApp**: Draft generation for client communications

### Development Tools
- **Replit Plugins**: vite-plugin-runtime-error-modal, vite-plugin-cartographer, vite-plugin-dev-banner for enhanced Replit development experience

## Recent Changes (January 27, 2026)

### Compact Premium UI Design
- All pages use compact, efficient layouts without excessive whitespace
- Headers: text-xl titles, pt-4 pb-3 padding, px-4 lg:px-6 horizontal padding
- Stat cards: h-24 height, p-4 padding, text-xl values, text-xs labels
- Buttons: size="sm" standard, gap-1.5 icon spacing, rounded-lg borders
- Search inputs: h-9 height, pl-9 for icon space
- Sections: gap-3/gap-4 spacing, space-y-4 for vertical flow
- Icons: h-4 w-4 standard size, smaller h-3.5 w-3.5 for compact elements

### Premium UI Redesign
- Complete Apple-inspired minimalist design across all pages
- Refined CSS design system with premium-card styling, smooth animations, and glassmorphism utilities
- Consistent typography, spacing, and visual hierarchy throughout the application
- All search inputs use shadcn Input components for consistency
- Removed custom hover states from Buttons - relies on built-in elevation utilities
- Pages updated: Dashboard, Work Orders, Companies, Typing Jobs, Vendor Wallet, Admin

### Database & Backend Implementation
- Completed PostgreSQL database setup with Drizzle ORM
- Implemented DatabaseStorage class with full CRUD operations for all entities
- Added comprehensive API routes with Zod request validation
- Fixed work order number generation to use MAX instead of COUNT for proper sequencing
- Minimal seed data: Only admin user and app settings (no sample data)
- Gated seed data to development environment only (won't run in production)
- Real data: 42 companies and 10 medical centers from spreadsheet

### Admin Module - Full CRUD
- Tab-based admin page with management for all entities
- **Medical Centers**: Add/edit dialogs with name, type, authority, tier, area, address, timings
- **Staff**: Add/edit dialogs with name, role title, phone, email
- **Service Types**: Add/edit dialogs with name
- **Job Types**: Add/edit dialogs with name, category (Medical/EID), cost
- **Settings**: Edit dialogs for CC recipients and low balance threshold
- All forms use z.coerce.number() for numeric fields
- All mutations properly invalidate cache on success

### Schedule Medical Feature (January 28, 2026)
- Two modes: Wizard (3-step guided flow) and Quick (compact single-screen)
- Step 1: WO search with autocomplete, Create WO modal for missing entries
- Step 2: Appointment details - center selection filtered by VIP/Normal, date/time pickers, staff assignment
- Step 3: Email/WhatsApp preview with copy-to-clipboard functionality
- Medical centers filter based on VIP selection (uses company's preferred center as default)
- Appointments schema extended with isVip, applicationNumber, notes, messageSentAt/By fields
- Guardrails: Hard block if staff not assigned, soft warning if center differs from company preference

### Security Improvements
- Added Zod validation to all POST/PUT API endpoints
- Request body validation prevents invalid data from being saved
- Note: Passwords are still plain text (production deployment should use bcrypt/argon2 hashing)
- Note: Authentication/session handling should be added before production use

### Test Credentials (Development Only)
- Admin Portal: admin@procompany.ae / admin123