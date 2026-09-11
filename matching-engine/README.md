# RESQNET — AI Identity-Matching Microservice (`matching-engine/`)

**Owner**: Gaurav (`feature/backend`)  
**Stack**: Python 3.11+, FastAPI, Uvicorn, RapidFuzz, jellyfish, scikit-learn

---

## Mission
Provide explainable fuzzy identity matching between missing reports and found/hospital intake records.
Calculate multi-attribute similarity score (0 to 100%) and produce bulleted explainable rationale for human reviewers.

## Key Files to Create
- `main.py`: FastAPI server (`POST /match/evaluate`, `POST /match/batch-scan`).
- `matcher/name_matcher.py`: RapidFuzz token matching, phonetic soundex/metaphone, transliteration logic.
- `matcher/scorer.py`: Weighted multi-attribute score aggregator (Name 20%, Age 10%, Location 20%, Timeline 15%, Physical 10%, Photo 25%).
- `matcher/explainer.py`: Human-readable explanation generator (`reasons: [...]`, `warnings: [...]`).

## Contract Reference
Adhere to `MatchCandidate` in `../shared/types/index.ts`.
See `../docs/PROMPTS_FOR_TEAM.md` for Gaurav's complete AI prompt.
