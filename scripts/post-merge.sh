#!/bin/bash
set -e
npm install
npx drizzle-kit push --force --accept-data-loss
