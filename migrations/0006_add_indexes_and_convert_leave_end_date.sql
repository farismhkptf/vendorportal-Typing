-- Migration 0006: Add database indexes for query performance and convert staff.leave_end_date to timestamp

CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders (status);
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON work_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_service_type_id ON work_orders (service_type_id);

CREATE INDEX IF NOT EXISTS idx_typing_jobs_wo_id ON typing_jobs (wo_id);
CREATE INDEX IF NOT EXISTS idx_typing_jobs_vendor_id ON typing_jobs (vendor_id);
CREATE INDEX IF NOT EXISTS idx_typing_jobs_status ON typing_jobs (status);

CREATE INDEX IF NOT EXISTS idx_appointments_wo_id ON appointments (wo_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_center_id ON appointments (center_id);
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments (datetime);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_vendor_id ON users (vendor_id);

CREATE INDEX IF NOT EXISTS idx_companies_rm_staff_id ON companies (rm_staff_id);

CREATE INDEX IF NOT EXISTS idx_login_audit_log_user_id ON login_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_log_created_at ON login_audit_log (created_at);

CREATE INDEX IF NOT EXISTS idx_change_notifications_status ON change_notifications (status);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_user_id ON staff_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_is_read ON staff_notifications (user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_vendor_notifications_vendor_user_id ON vendor_notifications (vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_vendor_id ON vendor_notifications (vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_statements_vendor_id ON vendor_statements (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_vendor_id ON vendor_invoices (vendor_id);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_vendor_id ON vendor_wallet_ledger (vendor_id);

CREATE INDEX IF NOT EXISTS idx_attestation_srs_status ON attestation_service_requests (status);
CREATE INDEX IF NOT EXISTS idx_attestation_srs_vendor_id ON attestation_service_requests (vendor_id);
CREATE INDEX IF NOT EXISTS idx_attestation_sr_steps_sr_id ON attestation_sr_steps (sr_id);
CREATE INDEX IF NOT EXISTS idx_attestation_srs_company_id ON attestation_service_requests (company_id);

CREATE INDEX IF NOT EXISTS idx_document_custody_records_wo_id ON document_custody_records (wo_id);
CREATE INDEX IF NOT EXISTS idx_document_custody_records_company_id ON document_custody_records (company_id);

CREATE INDEX IF NOT EXISTS idx_files_related ON files (related_type, related_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_wo_documents_wo_id ON wo_documents (wo_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_created_by ON work_orders (created_by);
CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users (staff_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_log_email ON login_audit_log (email);
CREATE INDEX IF NOT EXISTS idx_change_notifications_entity_id ON change_notifications (entity_id);

-- NOTE: staff.leave_end_date text-to-timestamp conversion is handled imperatively
-- in server/routes.ts runIndexMigration() since DO $$ blocks cannot be split by
-- the semicolon-based statement splitter used at startup.
