# WardWise: MVP plan

Agreed 2026-10-10. Changes are added at the end under Amendments, with a date.

## What WardWise does
1. The student opens WardWise and adds any of: an audio recording made in the app (or an uploaded audio file), typed notes, and slides (.pptx or PDF).
2. They press **Generate**.
3. WardWise transcribes the audio, reads the slides, and produces a study pack:
   - a summary focused on the teaching points
   - flashcards
   - an exam-style quiz (single best answer, with an explanation for every option)
   - "Ask about my session", a chat grounded in the uploaded material
   - further reading and watching from credible sources, with real links only
4. The study pack is saved in the browser, and the student can rate items or send feedback for v2.

## How the pieces fit
```
Browser (React)                         Server (Python FastAPI)              Outside services (free)
- record audio, type notes,   --HTTP-->  - read PDF / PPTX text      ---->   Groq: Whisper (speech-to-text)
  upload slides                          - send audio for transcript         Groq: LLM (text generation)
- show study pack, quiz, chat <--JSON--  - ask the AI for JSON output  ---->  PubMed/StatPearls, YouTube,
- save history (IndexedDB)               - look up real reading links         Wikipedia, Radiopaedia (real links only)
```

## Key decisions
| Decision | Why |
|---|---|
| React front end + Python FastAPI back end | Python has the best tools for AI, audio and documents; the front end/back end split is how most teams build. |
| OpenAI-compatible provider layer, configured in `.env` | Switch between Groq, OpenRouter, Gemini or a local model without changing code. |
| AI suggests search terms; APIs supply links | Language models invent plausible references. Real links are the main credibility point for a medical audience. |
| Structured JSON output, validated | The app can rely on the shape of what the AI returns, and bad output is caught before it reaches the screen. |
| History in the browser (IndexedDB) | No login and no server database needed; one demo visitor cannot see another's notes. |
| Shared access code and rate limits on the hosted demo | Without login, anyone with the link could use up the free AI quota. |
| Role-play and teaching audio only | Ward audio contains patient information; free AI tiers may retain data. |

## Phases
Each phase: preview, build, walkthrough, limited retype, explain-back, Quality review, push (see `AGENTS.md`).

| # | Phase | Concepts Rugimbana will be able to explain |
|---|---|---|
| 0 | Setup: repo, layout, project files | Git and GitHub, public repos, monorepo, `.gitignore`, environment variables and `.env.example` |
| 1 | Front-end shell: input page (notes editor, recorder, slide drop zone), light and dark theme, motion | React components, state, props, TypeScript basics, Tailwind, shadcn/ui, design tokens |
| 2 | Back-end skeleton: FastAPI, upload route, front end talks to back end | REST, HTTP methods and status codes, multipart uploads, CORS, Pydantic validation |
| 3 | Ingestion: browser recording, transcription, PDF and PPTX text | MediaRecorder, audio codecs and file size, MIME types, background jobs |
| 4 | AI generation: provider layer, prompts, summary, flashcards, quiz | Tokens, context windows, temperature, structured output, hallucination, rate limits, chunking |
| 5 | Results UI: summary, flip cards, quiz with explanations, progress states | Loading and error states, polling vs streaming |
| 6 | Credible further reading | Grounding, third-party APIs, API keys and quotas |
| 7 | History in the browser: save, reopen, export, import | IndexedDB, client-side vs server-side storage, data ownership |
| 8 | Ask about my session | Retrieval-augmented generation (RAG), conversation state |
| 9 | Feedback: per-item ratings and a short form | Feedback loops, a small hosted database |
| 10 | Hardening and deploy | Access code, rate limiting, tests, free hosting, secrets in hosting, cold starts |
| 11 | Demo readiness: README, sample role-play session, a five-minute demo flow, talking points for one-on-one conversations | Explaining technical work to non-engineers and to engineers |

**Out of v1, easy to add later:** video upload (in-app recording of a role-play covers it) and photos of handwritten notes.

## Risks
- **Free-tier rate limits** may not fit a long transcript plus slides in one AI request. Measure in phase 4; split into chunks if needed. Gemini's free tier is a fallback (acceptable for role-play data, though Google may use free-tier data for training).
- **Free hosting sleeps** when idle; the first request takes 30 to 60 seconds. Open the link before a demo.
- **AI errors in medical content.** Label everything as AI-generated and tie quiz explanations to the source material.

## Amendments
- 2026-10-10: Product named Lucy. Phase 11 reframed from a formal pitch to one-on-one demos.
- 2026-10-12: Phase 3 split into 3a (recording) and 3b (transcription, slide text, background jobs). Phase 4 adds an editable transcript: the student corrects what WardWise heard before the AI writes the study pack.
- 2026-10-13: Phase 4 split into 4a (edit before writing) and 4b (the generator). 4b adds a grounding check: every flashcard and quiz question carries a short quote from the material, and the server confirms the quote is really there before showing the item.
- 2026-11-09: Slides (.pptx and PDF) to be removed, so WardWise works from the ward itself (recording and the student's notes). Feature work comes before phases 9 and 10, which move to the end; deploy when needed. Out of v1 list: photos of handwritten notes were added on 2026-10-22.
