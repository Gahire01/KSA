import { z } from "zod";

export const signatureMetaSchema = z
  .object({
    signerName: z.string().trim().min(2, "Enter the signer's name.").max(80),
    signerTitle: z.string().trim().min(2, "Enter the signer's title.").max(80),
    source: z.enum(["DRAWN", "UPLOADED"]),
  })
  .strict();

export const signatureLockSchema = z
  .object({
    id: z.string().min(1).max(64),
    confirm: z.literal(true, { errorMap: () => ({ message: "Confirm the signature to lock it." }) }),
  })
  .strict();
