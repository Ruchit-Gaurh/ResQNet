import type { ScoredMatch } from './scorer';

interface PersonEvidence {
  name?: string;
  nickname?: string;
  age?: number;
  approximateAge?: number;
  gender?: string;
  clothing?: string;
  identifyingMarks?: string;
  height?: string;
  photoAvailable: boolean;
  locationZone?: string;
  observedAt?: string;
}

export interface OpenAiSimilarityAssessment {
  similarityPercentage: number;
  matchingEvidence: string[];
  conflictingEvidence: string[];
  missingEvidence: string[];
}

interface ResponsesApiBody {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
}

export interface OpenAiSimilarityOptions {
  apiKey?: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function usableApiKey(apiKey?: string): apiKey is string {
  if (!apiKey?.trim()) return false;
  const normalized = apiKey.trim().toLowerCase();
  return !normalized.includes('dummy')
    && !normalized.includes('replace-me')
    && !normalized.includes('your-openai');
}

function outputText(body: ResponsesApiBody): string | undefined {
  if (typeof body.output_text === 'string') return body.output_text;
  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return undefined;
}

function parseAssessment(value: string): OpenAiSimilarityAssessment {
  const parsed = JSON.parse(value) as Partial<OpenAiSimilarityAssessment>;
  if (
    !Number.isInteger(parsed.similarityPercentage)
    || parsed.similarityPercentage! < 0
    || parsed.similarityPercentage! > 100
    || !Array.isArray(parsed.matchingEvidence)
    || !Array.isArray(parsed.conflictingEvidence)
    || !Array.isArray(parsed.missingEvidence)
  ) {
    throw new Error('OpenAI returned an invalid person-similarity assessment.');
  }
  return parsed as OpenAiSimilarityAssessment;
}

/**
 * Optional second-stage report comparison. This is deliberately text/evidence
 * based and does not send contact data, exact coordinates, or photo URLs.
 * Human verification remains mandatory regardless of the returned score.
 */
export async function assessSimilarityWithOpenAi(
  missing: PersonEvidence,
  found: PersonEvidence,
  deterministicMatch: ScoredMatch,
  options: OpenAiSimilarityOptions,
): Promise<OpenAiSimilarityAssessment | undefined> {
  if (!usableApiKey(options.apiKey)) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await (options.fetchImpl ?? fetch)('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        store: false,
        max_output_tokens: 350,
        instructions: [
          'You compare a missing-person report with a found-person report for disaster-response candidate generation.',
          'Use only the supplied evidence. Do not invent, infer, or fill in any missing personal detail.',
          'Return one integer similarity percentage from 0 to 100 for how closely the supplied reports describe the same person.',
          'Treat absent fields as unknown, not as matches. Explicit contradictions must reduce the score.',
          'The number is a prototype evidence-similarity score, not identity confirmation or a scientific probability.',
          'A human responder must make the final decision.',
        ].join(' '),
        input: JSON.stringify({
          missingPersonReport: missing,
          foundPersonReport: found,
          deterministicEvidence: {
            score: deterministicMatch.overallScore,
            breakdown: deterministicMatch.breakdown,
            reasons: deterministicMatch.reasons,
            warnings: deterministicMatch.warnings,
          },
        }),
        text: {
          format: {
            type: 'json_schema',
            name: 'person_similarity_assessment',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                similarityPercentage: { type: 'integer', minimum: 0, maximum: 100 },
                matchingEvidence: { type: 'array', maxItems: 6, items: { type: 'string' } },
                conflictingEvidence: { type: 'array', maxItems: 6, items: { type: 'string' } },
                missingEvidence: { type: 'array', maxItems: 6, items: { type: 'string' } },
              },
              required: [
                'similarityPercentage',
                'matchingEvidence',
                'conflictingEvidence',
                'missingEvidence',
              ],
            },
          },
        },
      }),
    });
    const body = await response.json() as ResponsesApiBody;
    if (!response.ok) {
      throw new Error(body.error?.message ?? `OpenAI request failed with HTTP ${response.status}.`);
    }
    const text = outputText(body);
    if (!text) throw new Error('OpenAI response contained no structured assessment.');
    return parseAssessment(text);
  } finally {
    clearTimeout(timeout);
  }
}

export type { PersonEvidence };
