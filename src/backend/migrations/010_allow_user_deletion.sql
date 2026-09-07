-- Admins can delete a single user (see docs/Spec.md's "User Management"
-- section). Two FK columns would otherwise block that delete outright:
-- invites.used_by (every registered user is used_by on their own invite)
-- and accommodation_assignments/vehicle_assignments.assigned_by (any user,
-- not just admins, can assign another user via POST .../:id/assign). Both
-- get ON DELETE behavior that preserves the *other* side of the
-- relationship instead of blocking the delete:
--   - invites.used_by -> CASCADE: once the account is gone, the invite that
--     created it no longer represents anything the admin panel needs to show.
--   - *_assignments.assigned_by -> SET NULL: deleting the person who made an
--     assignment must not also remove the assignment of the (different)
--     user_id it granted a spot to.

ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_used_by_fkey;
ALTER TABLE invites
  ADD CONSTRAINT invites_used_by_fkey FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE accommodation_assignments ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE accommodation_assignments DROP CONSTRAINT IF EXISTS accommodation_assignments_assigned_by_fkey;
ALTER TABLE accommodation_assignments
  ADD CONSTRAINT accommodation_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE vehicle_assignments ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE vehicle_assignments DROP CONSTRAINT IF EXISTS vehicle_assignments_assigned_by_fkey;
ALTER TABLE vehicle_assignments
  ADD CONSTRAINT vehicle_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;
