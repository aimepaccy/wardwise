# Ideas for WardWise (long term)

A backlog of ideas for after the MVP. Add, change or delete freely. An idea here is not a promise: each one gets a privacy check and a cost check before it is planned into a phase.

Already scheduled, so not repeated here: automatic packs from recordings (before learning session 6, see `PROGRESS.md`) and phase 8, "Ask about my session".

## Features

### Priority: teach from credible sources (retrieval-augmented generation)
The core idea of WardWise: it teaches students from what the consultant taught on the round. It does not just report the exact words (or the jokes). Retrieval fits that idea: the session is the spine, trusted sources give the depth.

WardWise finds relevant passages in a trusted library (StatPearls, WHO and national guidelines) and gives them to the AI with the session, so the pack teaches around what was discussed instead of only reporting it. Context also helps resolve mishearings ("asinaa" next to "wheeze" and "salbutamol" is asthma).
- Two labelled voices: "From your session" (quoted and checked) and "From [source]" (cited). Never blend them; local guidance taught on the ward can differ from international sources, and the student should see the difference.
- Choosing the library is a clinical governance decision: open sources only (paid ones cannot be used), local before international.
- Retrieved passages cost tokens, which shortens the session that fits on the free tier.
- Corrections of misheard words stay visible ("heard as 'asinaa'").
- Phase 8's chat needs retrieval too; build the two together.
- Decided 2026-10-22: large literature sources (OpenEvidence, if access comes) belong in the chat, not in the pack. Retrieval for the pack, if built, stays with open and local sources.

### Student accounts
Each student signs in and finds their packs on any device.
- Changes a founding decision: study content would be stored on a server, not only in the browser. Needs a privacy design (what is stored, where, for how long, who can see it, how to delete it) before any code.
- Brings in authentication (who you are) and authorisation (what you may see), password resets and account deletion.
- A free hosted option such as Supabase (used in an earlier project) would cover sign-in and a database.

### Groups across sites (from classmates, 2026-10-22)
Personal by default; students can form a group whose packs are pooled, so a student at one hospital learns from a round at another, and the AI can draw on the whole group's material (retrieval over the group's packs, the same machinery as the priority idea above).
- Pulls against consultant privacy: a group spreads teaching beyond the room. Share packs (teaching points), never audio or transcripts; the consultant's consent sets the level ("for you only" or "for your group"); no teacher named by default.
- Needs accounts and authorisation (role-based access), so it follows student accounts.

### Keep what was taught, not what was said (consultant trust, 2026-10-22)
Consultants may not want a word-for-word record of what they said. After the pack is written, do not save the transcript; keep the pack with its short checked quotes. Trade-off: the student cannot go back to the transcript, and the chat (phase 8) works from the pack. Together with no stored audio and pausing for off the record, this is the promise to make to consultants.

### Organise packs by topic, day, week and rotation
Packs grouped and filtered by date, week, rotation (medicine, surgery, paediatrics...) and topic, with a clear, calm layout.
- Can be built in the browser with what exists now (IndexedDB indexes); no accounts needed.
- The AI could suggest topic tags when it writes a pack; the student confirms or changes them.

### Summaries read aloud (from the dean, 2026-10-22)
The day's summary read aloud, for a student who is eating or walking. Browsers have speech built in (the Web Speech API), free and on the device, so no text leaves it. Voices vary by device; a downloadable audio file would need a server-side voice later.

### High-yield cards and weekly reports (from the dean, 2026-10-22)
A short set of the most exam-relevant points from each pack, gathered into a weekly report across the week's packs. Builds on organising packs by week.

### Weekly reminders
A weekly nudge: "You have 12 flashcards due" or "Review this week's rounds".
- Email needs an address, so it follows accounts. Web push notifications work without accounts but need extra browser setup and are limited on iPhones.
- Could follow spaced repetition (cards come back just before they would be forgotten), which has good evidence behind it.

### Simulation debriefs
Record a simulation session (audio, perhaps later video) and get a structured debrief: what went well, what was missed, what to improve, measured against the protocols and frameworks WardWise is given (for example a resuscitation algorithm, a handover format such as ISBAR, or a debriefing model).
- Fits the "no patient data" rule well: simulations use manikins and actors.
- Needs consent from everyone recorded, and approval from the simulation centre.
- Every point should point to evidence (a timestamp and a quote) and to the protocol step it relates to, so facilitators can check it.
- WardWise supports the facilitator's debrief; it does not grade students.
- Video needs a model that can watch video and is much heavier to process; start with audio.

### Curriculum coverage (secondary, after retrieval)
Compare what was discussed with a curriculum and show the overall picture, never pointing at a person: for example, internal medicine has 30 topics; 10 were discussed a lot, 3 hardly at all.
- Topic-level only, across many sessions, with no teacher named.
- Start with the student's own view ("this rotation you have covered 12 of 30 topics; not yet seen: ..."), which needs no server and fits "organise by rotation".
- An institutional view needs content from many students on a server, consent, ethics approval and role-based access; reports opt-in and anonymised.
- Selection bias: a report only sees what students chose to record, so a "gap" may mean nobody pressed record.

### An eval set for the writer (learning session 5b, 2026-10-28)
Measure the study packs instead of judging them from single runs: 8 to 10 invented sessions (different topics, a messy Whisper-style transcript, very short notes, one with small talk) and a script that runs the real pipeline and reports the schema-valid rate, the share of items grounded, coverage, retries and tokens. Run before demos and before any change of model, provider or prompt.
- A clinician reviews a sample with a rubric (faithful to the quote? clinically safe?), ideally two raters with an agreement statistic.
- An LLM judge for "does this quote support this card?" (the Card A gap) only after checking it against clinician labels.
- Not now (Rugimbana's call): it needs more expertise and time than the MVP allows. Useful to raise in conversations as the known next step: what WardWise measures today, what it does not, and what a proper evaluation would need.

## Small technical fixes (found in learning sessions)
- Make the pack request strict (`extra='forbid'` on `PackRequest`), so a misspelled field fails loudly instead of silently dropping the transcript.
- Generate the front end's `types.ts` from the server's OpenAPI file, so the two cannot drift apart.
- Keep a finished job for a short grace period (or until the browser confirms it arrived), so a dropped connection does not lose the pack and show "server restarted" when it did not.
- The quote check proves a quote exists, not that the item says what the quote says (a card answering "insulin first" with the real quote "the first thing you give is not insulin" passes). Options: an entailment check or a validated LLM judge (see the eval set above); meanwhile the app's wording should keep "found" from reading as "correct". Evidence from learning session 5c (2026-10-28): all three normal packs that day had an untaught detail with a green tick ("to suppress ketogenesis", "give potassium before starting insulin", "a single dose of acetylcysteine"), and an injected wrong DKA sequence got 10 of 10 ticks because the attacker named a real line to quote.
- Repeated items are not detected: ten cards on one sentence all pass grounding; only coverage shows the rest was missed.
