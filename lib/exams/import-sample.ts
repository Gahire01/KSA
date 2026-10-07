/**
 * The downloadable sample, kept apart from lib/exams/import.ts because that file
 * pulls in node:zlib and must never be bundled into a client page.
 */
export const SAMPLE_CSV = [
  "question,option_a,option_b,option_c,option_d,correct,difficulty,explanation",
  '"Which colour is used for a fire exit sign?",Red,Green,Blue,Yellow,B,1,"Fire exit signs are green."',
  '"What does PPE stand for?","Personal Protective Equipment","Public Protection Equipment",,,A,2,',
].join("\n");
