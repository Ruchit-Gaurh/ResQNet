import { z } from 'zod';

export const verifyMatchSchema = z.object({
  decision: z.enum(['VERIFY', 'REJECT', 'NEEDS_MORE_INFO']),
  reviewerId: z.string().min(1),
  evidenceUsed: z.array(z.string()),
  notes: z.string().optional(),
});

export const mergeCasesSchema = z.object({
  canonicalCaseId: z.string().min(1),
  duplicateCaseIds: z.array(z.string()).min(1),
  reason: z.string().min(1),
});

export type VerifyMatchInput = z.infer<typeof verifyMatchSchema>;
export type MergeCasesInput = z.infer<typeof mergeCasesSchema>;
