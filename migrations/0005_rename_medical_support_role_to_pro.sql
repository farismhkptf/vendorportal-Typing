-- Rename user_role enum values: "Medical Support" -> "PRO", "Medical Support - Temporary" -> "PRO - Temporary"
ALTER TYPE user_role RENAME VALUE 'Medical Support' TO 'PRO';
ALTER TYPE user_role RENAME VALUE 'Medical Support - Temporary' TO 'PRO - Temporary';
