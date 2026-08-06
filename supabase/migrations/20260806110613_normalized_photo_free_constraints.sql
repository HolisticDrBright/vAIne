-- Replace the case-sensitive photo-free CHECK constraints with normalized
-- lowercase inspection and a wider pattern set. These constraints are the
-- final backstop beneath allow-list schema validation and the Edge Function
-- deep scanner: they bind even service-role inserts. Substrings are chosen so
-- legitimate skin_analysis_v1 / audit-detail content (closed enums, bounded
-- counts, short appearance prose) can never trip them innocently.

alter table public.analysis_results drop constraint result_photo_free;
alter table public.analysis_results add constraint result_photo_free check (
  position('file://' in lower(result::text)) = 0
  and position('content://' in lower(result::text)) = 0
  and position('asset://' in lower(result::text)) = 0
  and position('assets-library://' in lower(result::text)) = 0
  and position('ph://' in lower(result::text)) = 0
  and position('blob:' in lower(result::text)) = 0
  and position('http://' in lower(result::text)) = 0
  and position('https://' in lower(result::text)) = 0
  and position('data:image' in lower(result::text)) = 0
  and position('base64' in lower(result::text)) = 0
  and position('"uri"' in lower(result::text)) = 0
  and position('"url"' in lower(result::text)) = 0
  and position('"exif"' in lower(result::text)) = 0
  and position('"gps"' in lower(result::text)) = 0
  and position('"landmarks"' in lower(result::text)) = 0
  and position('"contours"' in lower(result::text)) = 0
  and position('"face_geometry"' in lower(result::text)) = 0
);

alter table public.analysis_audit drop constraint audit_photo_free;
alter table public.analysis_audit add constraint audit_photo_free check (
  position('file://' in lower(detail::text)) = 0
  and position('content://' in lower(detail::text)) = 0
  and position('asset://' in lower(detail::text)) = 0
  and position('assets-library://' in lower(detail::text)) = 0
  and position('ph://' in lower(detail::text)) = 0
  and position('blob:' in lower(detail::text)) = 0
  and position('http://' in lower(detail::text)) = 0
  and position('https://' in lower(detail::text)) = 0
  and position('data:image' in lower(detail::text)) = 0
  and position('base64' in lower(detail::text)) = 0
  and position('"uri"' in lower(detail::text)) = 0
  and position('"url"' in lower(detail::text)) = 0
  and position('"exif"' in lower(detail::text)) = 0
  and position('"gps"' in lower(detail::text)) = 0
  and position('"landmarks"' in lower(detail::text)) = 0
  and position('"contours"' in lower(detail::text)) = 0
  and position('"face_geometry"' in lower(detail::text)) = 0
);
