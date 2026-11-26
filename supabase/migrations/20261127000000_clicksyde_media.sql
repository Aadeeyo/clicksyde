-- Clicksyde website: let the admin upload videos (hero reel, spotlight) to the "media" bucket.
-- Run once on the Clicksyde Supabase project, after 20261126000000_clicksyde_admin.sql.
-- Raises the per-file limit to 50 MB (the Supabase free plan's upload limit) and adds MP4 / WebM.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm']
where id = 'media';
