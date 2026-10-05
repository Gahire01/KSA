-- Display name for the signed-in user.
--
-- The chrome (top bar, user menu, audit entries) renders a person's name, not
-- their email, so the column is stored rather than parsed from the address.
-- Nullable so any existing row keeps working before it is filled in.
ALTER TABLE "User" ADD COLUMN "name" TEXT;