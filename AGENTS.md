# WardWise (study packs from ward-round teaching)

**Read first:** `../_hub/PROFILE.md` and `../_hub/CONVENTIONS.md`. Then `PROGRESS.md` in this folder. The rules below add to those files. The full plan is in `docs/plan.md`.

## Goal
WardWise is a web app MVP. A student records a (role-played) ward-round conversation, and takes photos of handwritten notes (slides and typed notes were removed on 2026-11-10, to keep WardWise to what happens on the ward). WardWise turns them into a study pack: a summary, flashcards, an exam-style quiz, a chat grounded in the session, and further reading from credible sources.

End goal (restated 2026-11-02): recording real ward rounds. Role-play is the stage for now; real rounds come only after a separate privacy design and approval (see Rules and `docs/ideas.md`).

Two equal aims:
1. A working, good-looking MVP that Rugimbana can show one-on-one to people who can offer opportunities (a demo and conversation, not a formal pitch).
2. Rugimbana can explain the whole system to a software developer, convincingly: every layer, every term, and why it was built that way.

## Build and learn together (from 2026-10-22)
Building resumed on 2026-10-22, after a pause from 2026-10-13 when the project had moved faster than understanding (aim 2). The aim now is a finished MVP that can be deployed and opened on any device at short notice. Each new feature follows the learning mode below, so understanding keeps pace. Alongside the building, learning sessions continue that follow one click (Generate) through every layer, using WardWise's own code as the textbook. Plan and order in `PROGRESS.md` (Next). From 2026-11-02 (Rugimbana's call), learning sessions 6 to 8 come first and building resumes after them; sessions return to the style of sessions 1 to 4 (a whole topic per message, thorough), since the small deep steps of session 5 were for the AI layer only. From 2026-11-06 (Rugimbana's call), the remaining sessions are basics only: a clear, short explanation with the engineer wording, no predictions, exercises or explain-back, so shipping can resume. Sessions 1 to 5 followed:
- About 45 to 60 minutes; stop when Rugimbana is tired.
- Beginner style: everyday analogy, then the term, then the real file in WardWise.
- Beyond WardWise: each fundamental also gets a short general view (what it is across the industry, where else it shows up, common misunderstandings), so the knowledge is not tied to WardWise (asked for on 2026-10-18).
- **Predict, don't retype:** show a few lines, ask what a change would do, then run it and see.
- Say which concepts are fundamentals to master and which are details to look up.
- Close with two or three explain-back questions, a `LEARNING.md` entry, and new terms added to `docs/glossary.md`.
- Build order and the learning plan are in `PROGRESS.md` (Next).

## Learning mode (while building)
**Walkthrough, focused on build quality** (agreed 2026-10-10; retyping dropped and explain-back trimmed on 2026-11-06, Rugimbana's call). Every phase follows the same steps, and no phase is skipped:
1. **Preview:** what we build, why, the tools and libraries, and the concepts Rugimbana will meet (named explicitly).
2. **Build:** the AI writes the code.
3. **Walkthrough:** explain the code and how it works: the flow of a request, what each file does, the key lines, and the vocabulary an engineer would use.
4. **Engineer version:** a short paragraph saying what was built the way Rugimbana would explain it to a developer, with every term in it defined.
5. **Explain-back (light):** at most one question, only when a concept is new and central; brief feedback.
6. **Close:** Quality review, `LEARNING.md` entry, `PROGRESS.md` update, commit and push.

Also introduce one or two AI-tool features per phase (skills, subagents, MCP servers, hooks) when they fit the work, with a verdict on whether to adopt them.

## Rules
- **No patient data, ever.** Inputs are role-played rounds, teaching moments, lectures and personal notes. The app shows this rule to users. Real ward audio needs a separate privacy design and approval first.
- **Vendor independent.** AI calls go through one provider layer that speaks the OpenAI-compatible API; the provider (Groq, OpenRouter, Gemini, Ollama) is chosen by settings in `.env`, not in code. Prefer open-source libraries.
- **The AI never writes links or references.** It may suggest search terms; links come only from real APIs (PubMed/StatPearls, YouTube restricted to curated channels, Wikipedia, Radiopaedia search).
- **Structured output.** AI responses are JSON validated against a schema before the app uses them. Generated content is labelled as AI-generated.
- **Budget: zero.** Free tiers only. Anything that costs money needs a yes, with the cost stated.
- Public repo (by decision 2026-10-10; overrides the private-by-default convention). Nothing secret, no personal contact details, and no mention of Rugimbana's university anywhere in the repo or app unless he asks.
- Uploaded files are processed and then deleted on the server; the server keeps no copies.
- Writing rules from `CONVENTIONS.md` apply to the README, app text and commit messages.

## Stack
- **Front end:** React (Vite, TypeScript), Tailwind CSS, shadcn/ui components, Motion for animation. Calm clinical look, light and dark themes.
- **Back end:** Python 3.13, FastAPI.
- **AI:** Groq to start (Whisper for speech-to-text, an open-weight LLM for generation), behind the provider layer.
- **Storage:** study packs saved in the browser (IndexedDB). Feedback only (no study content) may go to a small free hosted database.
- **Hosting:** localhost during development; free hosting for demos (chosen in phase 10).

## Layout
```
frontend/   React app (phase 1)
backend/    FastAPI app, .env (not in git), .env.example
docs/       plan.md, glossary.md, ideas.md (long-term backlog), design notes
```

## Environment
- Node 24 for the front end (`frontend/package.json`, from phase 1).
- Python 3.13 in `backend/.venv/` (created in phase 2; kept in `backend/` on purpose, since that folder is what gets deployed). Packages in `backend/requirements.txt`, pinned versions in `backend/requirements-lock.txt`. Activate with `backend\.venv\Scripts\activate` (PowerShell) or `source backend/.venv/Scripts/activate` (Git Bash).
- Secrets in `backend/.env`; copy from `backend/.env.example`. Never print or commit keys.

## Phases
See `docs/plan.md` for the table. Run the Quality reviewer (`../_hub/agents/quality.md`) at the end of every phase.
