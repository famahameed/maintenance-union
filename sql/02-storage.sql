-- Run in Supabase SQL Editor after 01-install.sql. No public upload/read policies.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('showroom-logos','showroom-logos',false,2097152,ARRAY['image/png']) ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=2097152,allowed_mime_types=ARRAY['image/png'];
