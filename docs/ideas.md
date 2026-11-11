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

### The platform: a personal space and a shared lobby (agreed as the long-term shape, 2026-11-01)
Two sides. A personal space for each student: their packs, chats and follow-ups, private. A common lobby open to every user, where cases from every site are shared automatically in the background and organised so they are easy to find and search; how exactly they are arranged is not decided yet. Knowledge from one hospital reaches students at another, while each student's questions stay their own. Paid extras could sit on top later; not a goal now.
- Replaces "Groups across sites" as the way to share (Rugimbana, 2026-11-01): one open lobby, no separate user groups, and no step where the student chooses to share.
- Open privacy question, to settle before any lobby code: automatic sharing means anything a pack carries by mistake (a patient detail, a remark a consultant would not want spread) reaches every user. Needs at least an automatic check for identifiers before a case joins the lobby, teaching points only (never audio or transcripts), a way to report and remove, and an answer for consultants who fear being recorded. Kept out of the one-page brief on purpose.
- Build order: the personal side first, working fully for one user; the lobby and its rooms (structure and look) come after.
- Publishing needs a check for anything that could identify a patient, a teacher or a placement (automatic first, then a person), and a way to report and remove content.
- Retrieval over the lobby is RAG in its natural setting: the corpus is too large to send whole (learning session 5c, step 9.2).
- Follows accounts, groups and a privacy design; the MVP must not make choices that block it.

### Real ward rounds (the end goal, restated 2026-11-02)
WardWise is heading for real ward rounds; role-play is the stage for now. What the separate privacy design would need before any real round is recorded (from learning session 5c, 9.5):
- Approval: ethics review and the hospital's permission; consent from the consultant and the team, and a way to handle patients' information (consent, or never capturing it).
- The law: Rwanda's Law No. 058/2021 treats health data as sensitive; a data protection impact assessment; where processing happens, since sending audio to Groq in the US is a cross-border transfer. Free tiers that may train on data are out; a paid provider with a no-retention agreement, an in-country host or a local model (Whisper and open-weight LLMs can run locally) are the candidates.
- Design: remove identifiers as early as possible (at transcription), keep no audio, keep what was taught rather than what was said (below), pause for off the record.
- Purpose: stay education. Outputs about teaching points keep WardWise off the medical-device line; outputs used for a specific patient's care would cross it.
- Evaluation: transcription checked on Rwandan-accented and code-switched speech, scored separately (subgroup analysis).

### Keep what was taught, not what was said (consultant trust, 2026-10-22)
Consultants may not want a word-for-word record of what they said. After the pack is written, do not save the transcript; keep the pack with its short checked quotes. Trade-off: the student cannot go back to the transcript, and the chat (phase 8) works from the pack. Together with no stored audio and pausing for off the record, this is the promise to make to consultants.

### Organise packs by topic, day, week and rotation
Packs grouped and filtered by date, week, rotation (medicine, surgery, paediatrics...) and topic, with a clear, calm layout.
- Can be built in the browser with what exists now (IndexedDB indexes); no accounts needed.
- The AI could suggest topic tags when it writes a pack; the student confirms or changes them.

### No repeated content across packs and in the lobby (Rugimbana, learning session 5c, 2026-11-02)
When asthma comes up on day 1 and again on day 4, the second pack should not repeat cards the student already has; in the lobby, the same point taught at different sites should not appear several times.
- How: embeddings (learning session 5c, step 9.1). Compare each new card with the student's existing cards; above a similarity threshold it is a likely repeat. Tune the threshold on real examples, since "start insulin" and "do not start insulin" scored 0.84.
- Repeat content, not repeat topics: meeting asthma again is spaced repetition, which helps memory. Suggested shape: "You already have 6 asthma cards; here are 3 new points from today", with the old cards offered for review, not deleted.
- In the lobby, merge rather than drop: one card showing it was taught at two sites is corroboration; where sites teach differently, show both, since the difference is itself worth learning.
- Runs in the browser for personal packs (a small embedding model) or on the server once there are accounts and a lobby.

### Summaries read aloud (from the dean, 2026-10-22)
The day's summary read aloud, for a student who is eating or walking. Browsers have speech built in (the Web Speech API), free and with no server of WardWise's. Voices vary by device, and some are online voices that send the text to their provider (Google's in Chrome, Microsoft's "Online (Natural)" voices in Edge), so WardWise prefers voices the browser lists as on the device. Built on 2026-11-11 (build item 5) for the Summary tab. Later: flashcards and quiz read aloud, a downloadable audio file (would need a server-side voice), and a check on phones with the screen locked.

### High-yield cards and weekly reports (from the dean, 2026-10-22)
A short set of the most exam-relevant points from each pack, gathered into a weekly report across the week's packs. Builds on organising packs by week.
- 2026-11-11 (build item 6): high-yield cards dropped for now (Rugimbana's call); the week gets highlights in prose instead, read aloud, which suit the weekend and listening. If cards come back, mark "high-yield" from what the teacher signalled (stressed, repeated, safety, linked to exams), checked by code, never the AI's own guess at exam relevance.

### Weekly reminders
A weekly nudge: "You have 12 flashcards due" or "Review this week's rounds".
- Email needs an address, so it follows accounts. Web push notifications work without accounts but need extra browser setup and are limited on iPhones.
- The week highlights (build item 6b, built 2026-11-11) are written when This week is first opened after Friday 18:00, since WardWise keeps nothing on its server and cannot send anything by itself. A push "Your week's highlights are ready" would be the natural first reminder.
- Could follow spaced repetition (cards come back just before they would be forgotten), which has good evidence behind it.

### Simulation debriefs
Record a simulation session (audio, perhaps later video) and get a structured debrief: what went well, what was missed, what to improve, measured against the protocols and frameworks WardWise is given (for example a resuscitation algorithm, a handover format such as ISBAR, or a debriefing model).
- Fits the "no patient data" rule well: simulations use manikins and actors.
- Needs consent from everyone recorded, and approval from the simulation centre.
- Every point should point to evidence (a timestamp and a quote) and to the protocol step it relates to, so facilitators can check it.
- WardWise supports the facilitator's debrief; it does not grade students.
- Video needs a model that can watch video and is much heavier to process; start with audio.
- 2026-11-07: a simulation lead suggested a sister product, **SimWise**, that records only the debrief after a simulation (the learners' reflection and the facilitator's short teaching), keeps it, and makes it easy to share between students. Simulation has no real patients, so it avoids the hospital privacy approvals that real ward rounds need, and could serve as working proof of the WardWise approach. Structure not decided (see the chat of 2026-11-07). 2026-11-09: SimWise waits until later; whether it is a separate fork or integrated with WardWise will be decided then. If it needs scenario cards or scripts, the slide readers removed from WardWise are in git history.

### Curriculum coverage (secondary, after retrieval)
Compare what was discussed with a curriculum and show the overall picture, never pointing at a person: for example, internal medicine has 30 topics; 10 were discussed a lot, 3 hardly at all.
- Topic-level only, across many sessions, with no teacher named.
- Start with the student's own view ("this rotation you have covered 12 of 30 topics; not yet seen: ..."), which needs no server and fits "organise by rotation".
- An institutional view needs content from many students on a server, consent, ethics approval and role-based access; reports opt-in and anonymised.
- Selection bias: a report only sees what students chose to record, so a "gap" may mean nobody pressed record.

### Show where in the session an item comes from (Rugimbana, 2026-11-10)
Beside each quote, a hint of where it was said, without any sign of how WardWise splits the session. A rough "early, middle or late in the session" from the quote's word position is possible now. Minutes ("about 12 minutes in") need timings from transcription, which WardWise does not ask Whisper for yet (`response_format='verbose_json'` gives segment times).

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
- The quote check cuts decimals and ranges into separate numbers ("2.5" into "2" and "5"), so a quote of four or more words can match inside another dose ("5 mg IM given" inside "0.5 mg IM given"). Found by the Quality review of red-team item (c), which guards its own short quotes against this. Fix in `_words` (`generate.py`) and its copy `words()` in `import-packs.ts` together.
- Repeated items are not detected: ten cards on one sentence all pass grounding; only coverage shows the rest was missed.
