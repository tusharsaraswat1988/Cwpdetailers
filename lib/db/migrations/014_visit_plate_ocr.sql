-- Migration 014: Plate OCR audit fields on visits (fraud prevention)

ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS ocr_text TEXT;
ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS ocr_confidence DOUBLE PRECISION;
ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS confirmed_registration TEXT;
