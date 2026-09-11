import { describe, it, expect } from 'vitest';
import { matchNames } from '../modules/matching/name-matcher';
import { matchAge } from '../modules/matching/age-matcher';
import { matchLocation } from '../modules/matching/location-matcher';
import { matchTimeline } from '../modules/matching/timeline-matcher';
import { matchPhysical } from '../modules/matching/physical-matcher';
import { matchPhotos } from '../modules/matching/photo-matcher';
import { calculateScore } from '../modules/matching/scorer';
import { addSafetyWarnings } from '../modules/matching/explainability';

describe('Matching Module', () => {
  describe('Name Matcher', () => {
    it('gives higher score for similar names (fuzzy and phonetic)', () => {
      // E.g. Rahul Sharma vs Rahool Sharma
      const similar = matchNames('Rahul Sharma', 'Rahool Sharma');
      // Different names: Rahul Sharma vs Amit Patel
      const different = matchNames('Rahul Sharma', 'Amit Patel');

      expect(similar.score).toBeGreaterThan(80);
      expect(different.score).toBeLessThan(40);
      expect(similar.score).toBeGreaterThan(different.score);
      expect(similar.reasons.length).toBeGreaterThan(0);
    });

    it('handles initial matching (R. Sharma vs Rahul Sharma)', () => {
      const initialMatch = matchNames('R. Sharma', 'Rahul Sharma');
      expect(initialMatch.score).toBeGreaterThanOrEqual(60);
      expect(initialMatch.reasons.some(r => r.includes('Initial') || r.includes('similarity'))).toBe(true);
    });

    it('safely handles missing or unknown names', () => {
      const missing = matchNames('Rahul Sharma', undefined);
      const unknown = matchNames('Rahul Sharma', 'UNKNOWN PERSON');

      expect(missing.score).toBe(50);
      expect(missing.warnings.length).toBeGreaterThan(0);
      expect(unknown.score).toBe(50);
      expect(unknown.warnings.some(w => w.includes('unknown'))).toBe(true);
    });
  });

  describe('Age Matcher', () => {
    it('gives exact match 100 and nearby ages high score', () => {
      const exact = matchAge(22, undefined, 22, undefined);
      const close = matchAge(22, undefined, 23, undefined);
      const far = matchAge(22, undefined, 45, undefined);

      expect(exact.score).toBe(100);
      expect(close.score).toBe(95);
      expect(far.score).toBeLessThanOrEqual(30);
      expect(close.score).toBeGreaterThan(far.score);
    });

    it('handles approximateAge gracefully', () => {
      const approx = matchAge(22, undefined, undefined, 23);
      expect(approx.score).toBeGreaterThanOrEqual(90);
      expect(approx.warnings.some(w => w.includes('approximate'))).toBe(true);
    });
  });

  describe('Location Matcher', () => {
    it('gives higher score for nearby locations and lower for distant locations', () => {
      // Delhi coordinates
      const loc1 = { lat: 28.6139, lng: 77.2090, zone: 'Zone A' };
      const locNearby = { lat: 28.6180, lng: 77.2150, zone: 'Zone A' }; // ~0.7 km
      const locDistant = { lat: 28.7041, lng: 77.1025, zone: 'Zone C' }; // ~14 km

      const nearby = matchLocation(loc1, locNearby);
      const distant = matchLocation(loc1, locDistant);

      expect(nearby.score).toBeGreaterThanOrEqual(90);
      expect(distant.score).toBeLessThan(30);
      expect(nearby.score).toBeGreaterThan(distant.score);
      expect(nearby.reasons.some(r => r.includes('km apart'))).toBe(true);
    });

    it('falls back to zone comparison if coordinates missing', () => {
      const zoneMatch = matchLocation({ zone: 'Zone A - Sector 4' }, { zone: 'Zone A - General Hospital' });
      expect(zoneMatch.score).toBeGreaterThanOrEqual(70);
      expect(zoneMatch.warnings.some(w => w.includes('Exact coordinates unavailable'))).toBe(true);
    });
  });

  describe('Timeline Matcher', () => {
    it('gives higher score for consistent, close timeline and penalizes implausible timeline', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const futureMissing = new Date(now.getTime() + 5 * 60 * 60 * 1000); // Found before missing

      const consistent = matchTimeline(twoHoursAgo.toISOString(), now.toISOString());
      const implausible = matchTimeline(futureMissing.toISOString(), now.toISOString());

      expect(consistent.score).toBe(100);
      expect(implausible.score).toBeLessThanOrEqual(10);
      expect(implausible.warnings.some(w => w.includes('before missing'))).toBe(true);
    });
  });

  describe('Physical / Clothing Matcher', () => {
    it('gives higher score for matching clothing descriptions', () => {
      const match = matchPhysical(
        { gender: 'MALE', clothing: 'Blue t-shirt, black denim jeans', identifyingMarks: 'Scar on eyebrow' },
        { gender: 'MALE', clothing: 'Blue shirt, black jeans', identifyingMarks: 'Scar on forehead' }
      );

      const mismatch = matchPhysical(
        { gender: 'MALE', clothing: 'Blue t-shirt', identifyingMarks: 'Scar on eyebrow' },
        { gender: 'FEMALE', clothing: 'Red dress', identifyingMarks: 'Tattoo on arm' }
      );

      expect(match.score).toBeGreaterThan(70);
      expect(mismatch.score).toBeLessThan(10);
      expect(match.score).toBeGreaterThan(mismatch.score);
      expect(match.reasons.some(r => r.includes('Clothing'))).toBe(true);
    });
  });

  describe('Scorer & Critical Safety Rules', () => {
    it('calculates weighted score according to specified proportions (Name 20%, Age 10%, Location 20%, Timeline 15%, Physical 10%, Photo 25%)', async () => {
      const name = { score: 90, reasons: ['Name match'], warnings: [] };
      const age = { score: 100, reasons: ['Age match'], warnings: [] };
      const location = { score: 90, reasons: ['Location close'], warnings: [] };
      const timeline = { score: 100, reasons: ['Timeline plausible'], warnings: [] };
      const physical = { score: 80, reasons: ['Clothing match'], warnings: [] };
      const photo = { score: 50, reasons: [], warnings: [] };

      // Expected: 90*0.2 + 100*0.1 + 90*0.2 + 100*0.15 + 80*0.1 + 50*0.25 = 18 + 10 + 18 + 15 + 8 + 12.5 = 81.5
      const scored = calculateScore(name, age, location, timeline, physical, photo);
      expect(scored.overallScore).toBe(81.5);
      expect(scored.confidenceLevel).toBe('STRONG_CANDIDATE');
    });

    it('CRITICAL SAFETY RULE: AI scoring engine NEVER assigns HUMAN_VERIFIED', () => {
      // Even with 100% on everything
      const perfect = { score: 100, reasons: [], warnings: [] };
      const scored = calculateScore(perfect, perfect, perfect, perfect, perfect, perfect);

      expect(scored.overallScore).toBe(100);
      // It must be STRONG_CANDIDATE, NOT HUMAN_VERIFIED!
      expect(scored.confidenceLevel).not.toBe('HUMAN_VERIFIED');
      expect(scored.confidenceLevel).toBe('STRONG_CANDIDATE');

      const withWarnings = addSafetyWarnings(scored);
      expect(withWarnings.warnings.some(w => w.includes('Identity has not been human-verified'))).toBe(true);
    });
  });
});
