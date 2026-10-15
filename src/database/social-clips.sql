-- OPTIONAL, OWNER-REVIEWED SETUP ONLY. Not executed by the workflows.
-- This bucket's objects are publicly readable by URL, including before social publication.
-- Store ONLY approved-for-public clips; never raw narration, rejected art, tokens or private drafts.
-- Supabase Free: 50 MB global maximum per object. Our lower limit is 45,000,000 bytes.
-- Existing buckets are left unchanged; this never converts an existing private bucket to public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('approved-social-clips', 'approved-social-clips', true, 45000000, array['video/mp4'])
on conflict (id) do nothing;
-- No anonymous/authenticated INSERT, UPDATE or DELETE policy is added.
-- Trusted server credentials in GitHub Secrets handle eventual upload/removal.
-- Do not delete queued media until publication is confirmed plus a retry grace period.
