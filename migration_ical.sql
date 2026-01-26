-- Run this in your Supabase SQL Editor to fix the "column not found" error
ALTER TABLE viviendas ADD COLUMN IF NOT EXISTS ical_airbnb TEXT;
ALTER TABLE viviendas ADD COLUMN IF NOT EXISTS ical_booking TEXT;
