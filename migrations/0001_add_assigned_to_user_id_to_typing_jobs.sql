-- Add assigned_to_user_id column to typing_jobs as a nullable FK to users(id)
ALTER TABLE "typing_jobs" ADD COLUMN IF NOT EXISTS "assigned_to_user_id" varchar;
ALTER TABLE "typing_jobs" DROP CONSTRAINT IF EXISTS "typing_jobs_assigned_to_user_id_users_id_fk";
ALTER TABLE "typing_jobs" ADD CONSTRAINT "typing_jobs_assigned_to_user_id_users_id_fk"
  FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_typing_jobs_assigned_to_user_id" ON "typing_jobs" ("assigned_to_user_id");
