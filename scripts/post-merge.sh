#!/bin/bash
set -e
npm install

# Run incremental SQL migrations
psql "$DATABASE_URL" -f migrations/0001_add_assigned_to_user_id_to_typing_jobs.sql 2>/dev/null || true

yes | npm run db:push --force
