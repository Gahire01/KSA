-- The full list of packages a course is sold in, e.g. [{"label":"Basic","amountRwf":100000}, ...].
-- priceRwf stays as the STANDARD price. Null means the course has only priceRwf.
ALTER TABLE "Course" ADD COLUMN "priceTiers" JSONB;
