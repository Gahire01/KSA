-- Add the human-facing enrolment number (e.g. KSA-0001) shown throughout the UI.
-- Safe as a NOT NULL add because the Trainee table was empty when this ran.
ALTER TABLE "Trainee" ADD COLUMN "traineeNo" TEXT NOT NULL;
CREATE UNIQUE INDEX "Trainee_traineeNo_key" ON "Trainee"("traineeNo");
