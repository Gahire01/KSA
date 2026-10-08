-- Every course sits a one-hour paper by default.
ALTER TABLE "Course" ALTER COLUMN "examDurationMin" SET DEFAULT 60;
