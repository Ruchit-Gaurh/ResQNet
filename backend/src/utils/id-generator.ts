import { customAlphabet } from 'nanoid';

const numericId = customAlphabet('0123456789', 5);

export function generateCaseId(): string {
  return `CASE-${numericId()}`;
}

export function generateSightingId(): string {
  return `SIGHT-${numericId()}`;
}

export function generateCheckInId(): string {
  return `SAFE-${numericId()}`;
}

export function generateMatchId(): string {
  return `MATCH-${numericId()}`;
}

export function generateEvidenceId(): string {
  return `EVID-${numericId()}`;
}
