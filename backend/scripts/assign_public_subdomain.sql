-- First-rollout example: map slug -> subdomain without changing the shareable /i/{slug} link.
-- Run after migration a1b2c3d4e5f6. Verify uniqueness before commit.

UPDATE events
SET public_subdomain = 'varun-tanu'
WHERE slug = 'varun-and-tanu-l6n2'
  AND status = 'PUBLISHED'
  AND public_subdomain IS NULL;