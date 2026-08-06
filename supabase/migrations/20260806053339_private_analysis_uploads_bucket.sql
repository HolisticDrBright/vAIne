-- Private temporary photo bucket. Clients have NO storage policies: every
-- path is deny-by-default, and uploads happen only through single-use signed
-- upload URLs issued by Edge Functions after auth + quota checks. MIME types
-- and size are constrained at the bucket as a second layer behind the
-- application's own validation; objects are deleted immediately after
-- analysis and swept by orphan cleanup.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'analysis-uploads',
  'analysis-uploads',
  false,
  8388608,
  array['image/jpeg','image/heic']
);
