-- Optimistic concurrency control for schedule auto-save / updates.
-- App code filters and increments schedules.version; production DBs created
-- before this column existed need it added explicitly.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

UPDATE public.schedules
SET version = 1
WHERE version IS NULL;

ALTER TABLE public.schedules
  ALTER COLUMN version SET DEFAULT 1,
  ALTER COLUMN version SET NOT NULL;

INSERT INTO public.schema_migrations (version)
VALUES ('0006_schedules_version_occ')
ON CONFLICT (version) DO NOTHING;
