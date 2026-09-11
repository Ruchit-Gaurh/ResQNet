/**
 * RESQNET — Photo Matcher
 * Pluggable abstraction for photo/face comparison.
 *
 * PRODUCTION NOTE: Replace DefaultPhotoMatcher with an actual face
 * embedding service (e.g., AWS Rekognition, Azure Face API, or a
 * self-hosted CLIP/ArcFace model) for production use.
 */

interface MatchResult {
  score: number;
  reasons: string[];
  warnings: string[];
}

/**
 * Photo matcher interface — implement this for production face comparison.
 */
export interface PhotoMatcherInterface {
  compare(photoA?: string, photoB?: string): Promise<MatchResult>;
}

/**
 * Default photo matcher — returns a neutral score.
 * This is a safe fallback that does NOT claim similarity.
 * Production implementations should replace this.
 */
class DefaultPhotoMatcher implements PhotoMatcherInterface {
  async compare(photoA?: string, photoB?: string): Promise<MatchResult> {
    const result: MatchResult = { score: 50, reasons: [], warnings: [] };

    if (!photoA || !photoB) {
      result.warnings.push('⚠ Photo comparison unavailable (one or both photos missing)');
      return result;
    }

    // Both photos exist but we can't compare them without ML
    result.score = 50; // Neutral — don't claim match or non-match
    result.warnings.push('⚠ Photo comparison requires production ML model — neutral score assigned');
    result.warnings.push('⚠ Photograph requires human visual verification');

    return result;
  }
}

// Singleton instance — can be replaced at runtime for testing or production
let activePhotoMatcher: PhotoMatcherInterface = new DefaultPhotoMatcher();

/**
 * Set a custom photo matcher implementation.
 * Call this during application startup with a production ML-backed matcher.
 */
export function setPhotoMatcher(matcher: PhotoMatcherInterface): void {
  activePhotoMatcher = matcher;
}

/**
 * Compare two photos.
 */
export async function matchPhotos(photoA?: string, photoB?: string): Promise<MatchResult> {
  return activePhotoMatcher.compare(photoA, photoB);
}
