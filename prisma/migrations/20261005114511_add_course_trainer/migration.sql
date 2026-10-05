-- Lead trainer for a course.
--
-- Stored as a loose string rather than a foreign key: the Trainer model is
-- Phase 2 work, but the course form already collects a trainer and the course
-- pages display it, so dropping the column would lose real user input. The
-- migration to a proper relation belongs with the Trainer table.
ALTER TABLE "Course" ADD COLUMN "trainerId" TEXT;
