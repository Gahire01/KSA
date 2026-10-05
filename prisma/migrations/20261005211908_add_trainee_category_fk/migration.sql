-- AddForeignKey
ALTER TABLE "Trainee" ADD CONSTRAINT "Trainee_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
