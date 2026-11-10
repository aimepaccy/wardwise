# Glossary

Terms from WardWise, in plain words, with where they show up in the code. Built session by session during the learning sessions; read it before a demo or a conversation with an engineer.

Each entry: the term, a one-line plain meaning, an everyday or clinical analogy where it helps, and the file in WardWise where it can be seen. Marked **(fundamental)** when worth mastering, otherwise a detail to look up.

## 1. The whole map

The anchor analogy for every session: the browser is the ward, WardWise's server is the lab in another building, Groq is the reference lab the lab sends work out to.

- **Client** (fundamental): the program that asks. In WardWise, the page in the browser. The ward sending a request form. A role, not a machine: both can run on one laptop. `frontend/`
- **Server** (fundamental): the program that waits for requests and answers them. In WardWise, the FastAPI program. The lab. `backend/app/main.py`
- **Front end / back end** (fundamental): the part the user sees and touches (front) and the part that works behind the scenes (back). Usually the same as client and server.
- **Request** (fundamental): one message from client to server asking for something. The request form. `frontend/src/lib/api.ts` (`request`)
- **Response** (fundamental): the server's answer to one request: a status code, some headers, a body. The result slip.
- **API** (Application Programming Interface) (fundamental): the list of requests a server accepts and how to make each one. The lab's test menu. `backend/app/routes.py`
- **Endpoint** (fundamental): one entry on that menu, such as `GET /api/limits`. One test the lab offers. `@router.get('/limits')` in `routes.py`
- **JSON** (fundamental): text with labelled values, `{"max_photos": 5}`. The standard result format both sides read, so Python (server) and TypeScript (page) can talk. Every response in WardWise is JSON, errors included.
- **localhost**: "this same computer". WardWise's page runs at `localhost:5173`, its server at `localhost:8000`.
- **Port**: a numbered door on a computer; each program listens at its own. `API_URL` in `api.ts`
- **Job, job ID** (fundamental): work the server does in the background after it has answered; the ID is the lab number used to ask about it later. `backend/app/jobs.py`
- **Single source of truth** (fundamental): each fact lives in one place and everything else asks that place. The word meter asks the server for the word limit (`frontend/src/hooks/use-limits.ts`); the photo box keeps its own copy of "5 photos" (`NotesPhotos.tsx`), which can drift from the server's.

## 2. The browser side

- **React** (fundamental): a library for building pages out of components. You describe what the page should look like for the current state; React does the redrawing. An observation chart that reprints itself from the latest values.
- **Declarative vs imperative** (fundamental): "here is what it should look like" vs "do this, then this". React is declarative; the old way of changing pages box by box is imperative.
- **Component** (fundamental): a reusable piece of the page that knows how to draw itself. A form template, filled in differently each time it is used. One per file in `frontend/src/components/`; `App` holds them all.
- **JSX**: the HTML-looking code inside TypeScript. `<Header theme={theme} />` means "draw a Header, with its `theme` slot filled in".
- **Props** (fundamental): what a parent hands a child: information and phone numbers (functions to call). The child reads them but cannot change them. `theme` and `onChange` in `ThemeToggle.tsx`
- **State** (fundamental): a component's own memory, which changes over time; changing it makes React redraw what depends on it. `theme` and `photos` in `App.tsx`, `cameraOpen` in `NotesPhotos.tsx`
- **Redraw (re-render)**: React drawing a component again after its state or props change.
- **Data down, events up** (fundamental): state flows down as props; children report what happened by calling the function they were given. "Down go data and phone numbers, up go phone calls." The theme button: `App` → `Header` → `ThemeToggle`, and the click back up.
- **Event, event handler**: something that happened (a click, a keystroke) and the function that runs when it does (`onClick`, `onChange`).
- **Lifting state up** (fundamental): keep state in the nearest common parent of every component that needs it, and no higher. `draft` (the corrected text) lives in `App` because the review panel, the word meter and Generate all need it; whether the camera is open stays in `NotesPhotos`.
- **Controlled component** (fundamental): an input box that shows exactly what state says and reports every change up. A secretary typing only what the doctor dictates. The `Textarea` in `EditableText` (`MaterialsPanel.tsx`). A broken `onChange` gives a box you cannot type in.
- **Derived state** (fundamental): anything that can be calculated from state is calculated on every redraw, never stored. BMI from weight and height. `countWords(notes)` in `MaterialsPanel.tsx`, `busy` in `App.tsx`
- **Hook**: a function whose name starts with `use` that gives a component a power such as memory (`useState`) or a side job (`useEffect`); WardWise's own hooks are in `frontend/src/hooks/`. Details in a later session.
- **Premature optimisation**: making code faster before measuring whether it is slow. Usually costs clarity for nothing.
- **StrictMode**: in development only, React runs each component's start-up work twice to expose hidden bugs; that is why `limits` appears twice in the Network tab. `frontend/src/main.tsx`

## 3. Across the wire

- **Path**: the part of an address after the server, such as `/api/limits`. Matched exactly, letter by letter.
- **Status code** (fundamental): the three-digit stamp on every response. 2xx it worked; 4xx the request was wrong (the ward's fault); 5xx the server broke (the lab's fault). It describes this one request, not the history of the job.
- **200 OK**: here is your answer now.
- **202 Accepted**: received, the answer comes later; here is your job ID. Used by `POST /api/sessions` and `POST /api/packs`.
- **404 Not Found**: no such thing here: a wrong address, or a job the server no longer knows.
- **422 Unprocessable Content**: the form is filled in wrong (too many photos, or nothing to send).
- **No answer at all**: the server could not be reached (down, restarting, Wi-Fi drop). There is no status code because no response came back. In `api.ts` this is `status === null`.
- **GET vs POST** (fundamental): GET asks for something and changes nothing, so it is safe to repeat (polling sends the same GET again and again); POST sends something for the server to act on, and sending it twice can do the work twice.
- **PUT, PATCH, DELETE**: replace, update or remove something that exists. WardWise uses none of them.
- **Polling**: asking "is it ready yet?" on a timer; WardWise asks every 1.5 seconds, so a 6-second pack shows about 4 checks. `waitForJob` in `api.ts`
- **HTTP** (fundamental): the agreed format for messages between client and server. A protocol: agreed rules for a conversation, like SBAR for handovers.
- **Request line**: the first line of a request: method, path, protocol version (`GET /api/limits HTTP/1.1`).
- **Headers** (fundamental): labels on the outside of the envelope: what is inside, what formats are accepted, who sent it.
- **Body**: the letter inside the envelope. A GET has none.
- **Content-Type** (fundamental): the header saying what the body is, such as `application/json` or `multipart/form-data`.
- **REST** (fundamental): a style of API with nouns in the paths (`/api/packs`, `/api/jobs/{id}`), verbs as methods, and JSON in the bodies. A convention, not a law.
- **405 Method Not Allowed**: right address, wrong verb (`GET /api/packs`).
- **413 Content Too Large**: too big. WardWise uses it when the material is over the word budget.
- **422, two kinds**: WardWise's own rule written by hand ("nothing to write a study pack from"), or the automatic shape check before WardWise's code runs (`{"notes": 5}`, or a job ID that is not 32 hex characters).
- **429 Too Many Requests**: slow down. A 4xx that heals with time: the request was fine, just too soon. Groq sends it to WardWise when the per-minute limit is reached.
- **500 / 503**: the server's code broke / the server is overloaded or down for now. Retrying later may work.
- **4xx vs 5xx in practice** (fundamental): 4xx, change the request (except 429: wait); 5xx, retry later.
- **Exponential backoff**: retrying after waiting longer each time (1 s, 2 s, 4 s), so a jammed service is not jammed further. The `openai` library does it for WardWise (`max_retries=2` in `providers.py`), then WardWise tells the student to try again in a minute.
- **Regular expression (regex)**: a pattern for text, such as `^[0-9a-f]{32}$` (exactly 32 characters from 0-9 and a-f). Look up when needed.
- **Binary vs text**: a recording or photo is raw bytes, not letters, so it cannot go into JSON as it is.
- **Base64**: a way to write bytes as text; makes them about a third bigger.
- **Multipart (`multipart/form-data`)** (fundamental): one request with separate labelled compartments, so text and files travel together. A sample bag with sealed pockets. Stage 1 (`sendSession` in `api.ts`).
- **Boundary**: the unique marker separating the compartments. The browser chooses it and writes the `Content-Type` header itself.
- **URL encoding**: how special characters are written in an address; a space becomes `%20`.
- **Developer tools, Network tab** (fundamental as a habit): F12 in the browser; lists every request with its method, status, headers, payload and response. The first place to look when a page misbehaves. The **Initiator** column shows what made each request.
- **Origin** (fundamental): scheme + host + port. `http://localhost:5173` and `http://localhost:8000` are different origins.
- **Same-origin policy** (fundamental): the browser's rule that a page may not read answers from another origin unless that origin allows it. Stops a dodgy site from reading your bank through your logged-in browser.
- **CORS (Cross-Origin Resource Sharing)** (fundamental): how a server names the origins allowed to read its answers. Enforced by the browser, not the server: `curl` and scripts ignore it, so it is not a lock on the API. The sign "results to Ward 5173 only", obeyed by honest porters. `CORSMiddleware` in `backend/app/main.py`
- **Preflight (OPTIONS)**: the browser phoning ahead before a non-simple request (`POST /api/packs` with `Content-Type: application/json`). Simple requests (GETs, form-style POSTs such as multipart) go straight out.
- **Access-Control-Max-Age**: how long the browser may remember a preflight answer; WardWise says 600 seconds, so a second pack within 10 minutes shows no OPTIONS row.
- **Proxy**: a go-between that forwards requests. A development proxy would have hidden CORS; WardWise calls the server directly so CORS is met on purpose.

## 4. The server

The lab's four stations: switchboard (uvicorn), specimen reception (middleware), receptionist (router), the bench (the route function).

- **Web server vs web framework** (fundamental): the web server (uvicorn) sits on the port and handles raw connections; the framework (FastAPI) understands requests, routes and checks them, and builds answers. Switchboard vs receptionist.
- **FastAPI, Flask, Django**: Python's three main web frameworks. FastAPI is API-focused with automatic validation and docs; Flask is minimal; Django is "batteries included" (database, admin, accounts). Express (Node) and Spring (Java) do the same jobs elsewhere. Why WardWise uses FastAPI: an API only, no accounts or server database, Pydantic validation for AI answers, async for the reading lookups, free docs.
- **Middleware** (fundamental): code that runs on every request before any route. Specimen reception. Layered like an onion: the last added runs first. CORS and the size limit in `backend/app/main.py`
- **Ordering bug**: a bug caused by steps in the wrong order. With the size limit outside CORS, a 413 would lose its CORS label and the student would see "could not reach its server".
- **Routing** (fundamental): matching method + path to a function. `@router.get(...)`, `@router.post(...)` in `routes.py`
- **Path parameter vs query parameter** (fundamental): the path names which thing (`/api/jobs/96f3…`, a bed number); the query gives options (`?term=asthma`, "fasting, urgent").
- **The signature is the form spec**: FastAPI reads a route's parameters (`Query(...)`, `PathParam(...)`, `Form(...)`, `File()`, a Pydantic model) and fetches and checks each before the function runs.
- **Two layers of checking**: FastAPI checks shape (a structured list in the error); WardWise's code checks meaning (a plain sentence). `/api/reading?term=a` passes the first and fails the second.
- **Pydantic** (fundamental): the reception clerk in code. Checks data against a declared shape. `backend/app/schemas.py`
- **Model / schema** (fundamental): the declared shape of a form: boxes, types, limits. `PackRequest`, `JobState`
- **Validation** (fundamental): checking data against a schema; failures become 422 before WardWise's code runs.
- **Literal**: a tickbox, only the listed values are allowed (`Literal['jpeg', 'png', 'webp']`).
- **Response model**: the declared shape of an answer (`-> JobState`). Works as an output filter: only declared boxes leave, so a stray key in a job is dropped (shown live with a fake key).
- **Extra fields: ignore vs forbid**: Pydantic ignores unknown boxes by default (tolerant); `extra='forbid'` rejects them (strict). WardWise is tolerant with the browser and strict with the AI's form.
- **Silent failure vs fail loudly** (fundamental): an error nobody sees (a misspelled `transcipt` silently drops the transcript) is worse than a visible one. Fail loudly: stop and say so.
- **OpenAPI, /docs**: a standard machine-readable description of an API, generated by FastAPI from the code; `/docs` shows it as a page you can try requests from. Used to call others' APIs, test your own, hand an API to a teammate, generate client code, or describe a service to an AI.
- **API contract, API-first design**: teams agree the API description first, then build both sides in parallel against it.
- **415 Unsupported Media Type**: "we do not process this kind of sample": the file is not a JPEG, PNG or WebP photo or an audio format, by its content.
- **Background task**: work FastAPI runs after the answer has gone out. `background.add_task(...)` in `routes.py`
- **Job, job ID, job state** (fundamental): slow work done in the background; the ticket to ask about it; its current stage and result. The dry cleaner's ticket. `backend/app/jobs.py`, `JobState` in `schemas.py`
- **State machine / lifecycle** (fundamental): named stages and the allowed moves between them (queued → working → done or failed; never back). Admission → ward → discharge.
- **Asynchronous request-reply** (fundamental pattern): accept, return a reference, work in the background, let the client check. Parcel tracking, YouTube processing, a hospital lab.
- **Polling vs push (webhook)**: the client asks repeatedly vs the server calls back when done.
- **Job queue**: a separate store that holds jobs for many workers and survives restarts (Redis, Celery, RabbitMQ, Amazon SQS). WardWise uses a dictionary in memory instead (one process only).
- **Scheduled (cron) job vs triggered job**: runs on a timetable vs started by a user's action.
- **Unguessable ID** (fundamental): a random ID that works as a key; `secrets.token_hex(16)` gives about 3 × 10³⁸ possibilities, so nobody can guess another student's job. "Share by link" works the same way.
- **Thread, race condition, lock**: parallel workers in one program; two writing at once can scramble shared data (a race condition); a lock is the single marker pen. `_lock` in `jobs.py`
- **Transport error vs job-level error** (fundamental): the call itself failed (4xx, 5xx, no answer) vs the call worked and the answer says the work failed (200 with `"status": "failed"`). After a 202, errors can only travel inside the job state.
- **Graceful degradation**: one broken part does not sink the rest. An unreadable photo becomes a warning and the pack is still written.
- **Data minimisation, storage limitation** (fundamental): keep the least data for the shortest time. In data protection laws (GDPR, and similar principles in Rwanda's law) and hospital retention policies.
- **`finally`** (fundamental): "run this whatever happened above". WardWise deletes a job's folder in a `finally`. Same idea as `with` in Python, `defer` in Go, `using` in C#.
- **WardWise's three layers of deletion**: `finally` at the end of each reading job; a sweep of `wardwise-jobs` at every start (for crashes and power cuts); a rolling sweep of folders older than 15 minutes.
- **Secure deletion**: deleting a file removes the signpost before the data is overwritten. A detail to look up.

## 5. The AI layer

- **Training vs inference** (fundamental): learning (weights adjusted on huge data, once, costly) vs use (input in, output out, weights unchanged). A printed textbook edition: reading it does not change it. Whisper does not improve from WardWise's recordings.
- **Weights**: the model's internal numbers, set during training.
- **Fine-tuning**: a short extra round of training on new data. Would need students' transcripts on a server, so not for WardWise. More in 5c, Part 9 (the three levers).
- **Prompt (for Whisper)**: a short hint of expected vocabulary. WardWise sends a generic one (`TRANSCRIBE_HINT` in `providers.py`).
- **Hallucination**: a model producing text that was never in the input or is not true; Whisper can add whole sentences during silences. Session 5 goes deeper.

### 5a. What are we talking to?

- **AI, machine learning, deep learning** (fundamental): nested like medicine, internal medicine, cardiology. AI is any system doing something we would call smart, including hand-written rules (MYCIN); machine learning finds the rules from examples; deep learning does it with neural networks of many layers.
- **Training, parameters, inference, in statistics words** (fundamental): fitting a logistic regression is training, its coefficients are parameters (weights), using it on a new patient is inference. Logistic regression is the simplest machine learning.
- **Neural network**: many small weighted sums wired together in layers, each passing a number on. "Deep" means many layers.
- **Transformer, attention**: the neural network design behind today's models (2017). Attention lets each word weigh every other word, so "discharge" is read from "pharmacy" or "purulent" around it.
- **LLM (large language model)** (fundamental): a transformer trained on huge amounts of text to predict the next token. `gpt-oss-120b` has about 120 billion parameters.
- **Predictive vs generative AI** (fundamental): a number or category out (a sepsis risk score, judged with sensitivity and AUROC) vs new content out (a summary, much harder to judge). Whisper is technically generative.
- **Pretraining, instruction tuning, preference tuning (RLHF)** (fundamental): reading everything to predict the next word (a knowledgeable autocomplete), then examples of instruction and good answer, then human rankings. Following instructions is a trained habit, not a separate step. Library years, clerkship, consultant feedback.
- **Open-weight vs closed** (fundamental): the weights file can be downloaded and run anywhere (`gpt-oss`, Qwen, Whisper) vs reachable only through the maker's service (Claude, GPT-5, Gemini). Open-weight is not open source: the training data and recipe usually stay private.
- **Model vs provider vs app** (fundamental): the weights, whoever runs them for you, the product built on them. Molecule, pharmacy, treatment protocol. WardWise is one app using three models from one provider: `LLM_MODEL`, `TRANSCRIBE_MODEL`, `VISION_MODEL` and `LLM_BASE_URL` in `config.py`.
- **Model retirement (deprecation)**: providers stop offering old models (Groq retired `llama-3.3-70b-versatile`); calls then fail with 404 `model_not_found`. A risk to monitor.
- **Token, tokenizer, vocabulary** (fundamental): the chunks a model reads and writes (about 200,000 for `gpt-oss`), chosen by frequency, not meaning. Like medical word roots, but the pieces rarely match the Greek. "the" is 1 token, "hepatosplenomegaly" 7; typos cost extra.
- **Byte-pair encoding (BPE)**: the usual way to build a vocabulary: start from characters, keep merging the most frequent pairs.
- **Next-token prediction** (fundamental): the loop behind every answer: read the whole sequence, give a probability to every token, pick one, add it, repeat until an end token or a cap. One full pass per output token, so output is slower and dearer than input.
- **Context window** (fundamental): the most tokens one call can hold, input and output together. The desk in an exam; about 131,000 for `gpt-oss-120b`.
- **Rate limit vs quota units** (fundamental): tokens or requests per minute or day on a plan (Groq's 8,000 tokens a minute, the real ceiling in WardWise) vs a service's own per-request currency (YouTube's 10,000 units a day). With tokens and the context window: millilitres, syringe size, dispensing limit, canteen tickets. `check_budget` in `generate.py`.
- **Token tax**: languages that are rare in training text get cut into more tokens, so they cost more and fit less. Small for one Kinyarwanda sentence with `gpt-oss` (20 tokens vs 18); measure, do not assume.
- **Sampling, temperature, top-p** (fundamental): choosing one token from the model's ranked "differential". Temperature 0 always takes the top one (greedy decoding); higher temperatures flatten the list; top-p keeps only the top tokens that add up to p. WardWise: 0.3 for writing, 0 for reading photos (`providers.py`).
- **Deterministic**: same input, same output. LLMs mostly are not; even at temperature 0 long answers can drift. Temperature 0 gives the most likely answer, not a correct one.
- **`max_tokens`, `finish_reason`** (fundamental): the hard cap on output tokens, and why generation stopped: `stop` (finished) or `length` (cut off). Cut-off JSON is useless, so WardWise treats `length` as a broken answer and tries again.
- **Reasoning model, reasoning effort, test-time compute**: models trained to write working notes before answering; the thinking is ordinary tokens, counted against `max_tokens` and the rate limit, usually hidden but still charged. Effort sets how long it thinks. WardWise uses `low` (`LLM_REASONING_EFFORT` in `config.py`); calls that leave it out get the model's longer default.
- **Chat completions** (fundamental): the standard LLM call, `POST {base_url}/chat/completions`, JSON in (model, messages, settings) and JSON out (the reply, `finish_reason`, token `usage`). An ordinary REST call. `write_json` in `providers.py`.
- **System, user, assistant roles** (fundamental): standing orders from the developer, this turn's request, the model's earlier replies. Models are trained to weigh the system message more, but it is not a locked door.
- **Chat template**: how the roles become one token sequence, with marker tokens between messages. Costs tokens even when empty.
- **Stateless model, conversation history** (fundamental): the model remembers nothing between calls; chat apps resend the whole conversation every turn, so each turn costs more and old turns must eventually be trimmed or summarised. A locum who has never met the patient.
- **OpenAI-compatible API** (fundamental): OpenAI's request format, accepted by Groq, OpenRouter, Ollama, vLLM and others. A standard requisition form; the data goes wherever `base_url` points, not to OpenAI. Same shape, uneven features (`reasoning_effort`, strict schemas, audio).
- **Multimodal, base64**: one model taking more than one kind of input (text and an image in one message, `read_handwriting`); base64 writes any bytes as plain letters so a photo fits inside JSON.
- **RAG (retrieval-augmented generation)**, first meeting: send only the passages relevant to the question instead of all the material every time. Why phase 8 needs it; 5c goes deeper.

### 5b. Making it trustworthy (Parts 5 and 6)

- **Prompt, system prompt** (fundamental): everything the model receives in one call; the system prompt is the developer's standing instructions, unseen by users. Not orders but the opening of a document the model continues: a good prompt makes the wanted continuation the most likely one. A locum's handover sheet. `INSTRUCTIONS` in `generate.py`; `AGENTS.md` is one too.
- **Prompt engineering vs context engineering**: designing and testing the prompt vs deciding everything that goes into the context window (instructions, material, history, retrieved passages). Mostly clear specification writing, like a protocol, not magic words.
- **Role prompt**: "You write study packs for…". Sets voice and focus, adds no knowledge. A name badge.
- **Delimiters**: tags that mark where the data starts and stops (`<material>`), so data is not taken for instructions. 5c goes deeper.
- **Zero-shot, few-shot, in-context learning** (fundamental): instructions only vs instructions plus worked examples; the model copies the pattern of the examples for that call only, with no training. WardWise is zero-shot: one example pack (about 2,500 tokens) would cut the room for material from about 1,591 words to about 133, and invite copying.
- **Example contamination (copying)**: content or shape from a few-shot example leaking into the output (an asthma fact in a DKA pack). Not "data leakage", which means test data in training data or private data escaping.
- **Prompt versioning, regression**: the prompt is code, changed in commits with reasons (`git log -L` on `INSTRUCTIONS`); rules pull against each other ("never pad" vs "cover every topic"), so a change can break what worked, and prompt edits need re-testing.
- **Structured vs unstructured data** (fundamental): named fields with types (a lab form, FHIR, JSON) vs free text (letters, notes, Markdown). Software needs the first; scraping the second breaks. Turning notes into fields is **information extraction**.
- **Parsing**: turning text into a data structure (`json.loads`, `PackDraft.model_validate_json`).
- **JSON Schema**: a standard description of the shape JSON must have (fields, types, required, allowed values, no extras). Generated from `PackDraft` by `model_json_schema()` in `providers.py`; about 750 tokens per call, inside `OVERHEAD_TOKENS`.
- **Prompt-only JSON vs JSON mode vs strict structured output** (fundamental): best effort vs valid syntax guaranteed vs syntax and shape guaranteed. Seen live: a 7B model asked nicely gave 0 of 5 usable replies.
- **Constrained decoding, logit masking** (fundamental): inside the token loop, the provider crosses out every token that would break the schema before the pick, then rescales the rest. A drop-down in e-prescribing instead of a free-text box. The model is unchanged. Guarantees the shape only if the provider supports it for that model and the output finishes within `max_tokens`; never guarantees content, and can force filler into required fields (hence maximums, not minimums).
- **Single source of truth** (fundamental): define a thing once and derive the rest. `PackDraft` both instructs Groq (the schema) and checks the answer (Pydantic).
- **Syntax vs schema vs semantics** (fundamental): well-formed? right fields and types? makes sense? "Semantic" means "to do with meaning": a perfectly written prescription for 5 g of IV salbutamol is a semantic error. WardWise: `json.loads` and strict mode, then Pydantic, then `check()` and `is_grounded`. Also in semantic search (by meaning) and semantic HTML.
- **Validation vs grounding vs verification** (fundamental): right form (guaranteed) vs traceable to the source (flagged by `is_grounded`, `uncovered`) vs true (not automated: the student and trusted sources). `is_grounded` checks that the quote exists, not that the item says what the quote says.
- **Entailment, LLM-as-judge** (first meeting): does one sentence follow from another; a second model call grading the first. Candidates for closing the gap above. Part 7 goes deeper.
- **Transient vs permanent errors** (fundamental): may succeed on another try (a broken form, a busy service) vs will fail the same way every time (unsupported feature, wrong key). A haemolysed sample is redrawn; a test the lab does not run is not.
- **Retry policy, fail fast**: what to retry, how often, after what wait; give up at once with a clear message on permanent errors. WardWise: the `openai` library retries 429s, timeouts and 5xx with backoff (`max_retries=2`); `write_pack` gives one more try only for `InvalidOutput` and `ValidationError`; everything else goes straight to the student.
- **Idempotent** (fundamental): safe to do twice. Rechecking a blood pressure, not re-giving a dose. Writing a pack has no side effects, so retrying is safe; payments and bookings need care.
- **Exception inheritance, exception chaining**: `InvalidOutput` is a kind of `ProviderError`, so code can catch the narrow kind to retry and the broad kind for messages; `raise … from last_error` shows the student plain words and keeps the technical cause for the log.
- **Log what happened, not what was said**: the retry log records the error type only, never the material or the answer. Logs live longer and are seen by more people than the data.

### 5b. Making it trustworthy (Part 7)

- **Hallucination (better: confabulation)** (fundamental): fluent, confident output not supported by the input or not true. Like a Korsakoff patient filling memory gaps, with no intent and no awareness. Expected behaviour of a plausible-text generator, reduced but never removed by better models, prompts or temperature 0. Five causes: the loop aims for plausible not true; training rewards guessing over "I don't know" (an exam with no negative marking); no going back once a token is written (snowballing); gaps the task asks it to fill; the pull toward the typical ("oxygen" becomes "high-flow oxygen").
- **Intrinsic vs extrinsic hallucination**: contradicts the source (a card saying insulin comes first when the teacher said fluid) vs adds what the source does not say (potassium doses nobody taught; may even be true).
- **Faithfulness vs factuality** (fundamental): true to the source vs true about the world. WardWise needs faithfulness first: correct but untaught content still misleads a student who thinks it came from the teacher.
- **Grounded / traceable**: the item's quote exists in the material (`is_grounded` in `generate.py`). A surrogate marker for faithfulness, like blood pressure for strokes: "not found" means check this one, "found" does not mean correct.
- **Normalisation**: cleaning text before comparing, like recoding "M", "male", "Male" in SPSS. `_words`: plain characters (NFKC), lower case, clinical symbols kept as words so "< 92%" never matches "> 92%".
- **Deterministic check**: plain code, same answer every time, free, cannot hallucinate. WardWise verifies with code, not with another AI call.
- **Coverage, omission** (fundamental): the reverse question, what the session taught that the pack left out (`uncovered`, `passages`). Grounding is like precision, coverage like recall; a pack needs both. Passages of 40 to 80 words; only grounded quotes tick a passage; when in doubt a passage is shown.
- **Position bias**: models spread correct MCQ answers unevenly and favour positions when judging. A systematic error, so it is designed out by randomisation, as in a trial (`_shuffled`).
- **Random vs systematic error** (fundamental): noise you detect case by case (hallucinations: the quote check) vs a consistent push you remove by design (position bias: shuffling).
- **Seed, pseudo-random**: computer randomness comes from a formula; the same seed gives the same sequence. Seeding the shuffle with the question text keeps the order reproducible, so tests are not flaky and bug reports can be replayed.
- **Flaky test**: a test that passes or fails by chance. Destroys trust in the test suite.
- **Eval** (fundamental): a fixed set of inputs plus a way to score outputs, rerun after every change of prompt, model or settings. A clinical audit cycle for AI. Results are rates over a set, not one run.
- **Tests vs evals** (fundamental): tests check our code with a stand-in model, pass or fail (`fake_writer` in `test_generate.py`); evals measure the real model's behaviour as rates. WardWise has 108 tests and only hand-run live checks so far (eval set idea in `docs/ideas.md`).
- **Code, human and LLM graders; rubric; LLM-as-judge**: deterministic checks (cheap, surrogate only), clinicians with a fixed marking scheme (gold standard, slow; agreement measured with Cohen's kappa), a second model scoring the first (scales, but biased and fallible, so validated against clinician labels first, like a new test against a gold standard).
- **Benchmark**: a public eval such as MedQA. Passing one measures one narrow thing; it does not make a tool ready for the clinic.

### 5c. Safety and the wider map (Part 8)
- **Prompt injection** (fundamental): text inside the data that the model treats as instructions. The nurse with no separate prescription chart: instructions and data arrive as one token sequence, and roles are a learned weighting, not a wall. Unsolved industry-wide; defences lower the odds.
- **Direct vs indirect injection**: the user types the attack (spoils only their own pack in WardWise) vs the attack hides in content the user did not write (a photographed handout, a speaker on a recording). Indirect is the dangerous kind.
- **SQL injection, parameterised queries**: the older cousin, cured by sending command and data through separate channels. LLMs have no such second channel yet.
- **Lethal trifecta**: private data, untrusted content, and a way to send things out. Remove a leg to contain injection. WardWise's model has untrusted content only.
- **Delimiter injection, tag escaping** (fundamental): data that contains the markers meant to fence it in, closing the box early (`</notes></material>`). Ask "what if the data contains our special characters?" everywhere. `_untag` in `generate.py` strips WardWise's four tag names; it fixes characters, but the model reads meaning, so a fake "END OF MATERIAL" header still passes.
- **Threat modelling**: naming each threat and which defence covers it. Grounding covers invention, not injection.
- **Swiss cheese model**: Reason's patient-safety picture of defence in depth. Code and design slices (schema, caps, `_no_links`, no agency) hold whatever the model; prompt slices ("treat it as data") weaken with a weaker model. "Never put a security boundary in the prompt."
- **Excessive agency, no agency**: what the model is allowed to do. WardWise's model has no tools and can only hand back a form, so a successful injection spoils one pack.
- **Jailbreak** (fundamental): getting a model to do what its makers trained it to refuse. Attacker is the user; target is the maker's safety training, not the app's instructions.
- **Many-shot jailbreaking, crescendo, low-resource languages**: fill the context with fake compliant examples (few-shot copying as a weapon); escalate a little each turn; translate the request into a language with little safety training data.
- **Over-refusal, dual-use dilemma**: refusing legitimate medical content (overdose thresholds) vs the same educational context being faked by an attacker. Safety and helpfulness trade off.
- **Data in transit, at rest, in use**: moving, stored, being processed. HTTPS covers transit; the provider must read plain text to process it.
- **Controller vs processor**: who decides why data is processed (WardWise) vs who processes it for them (Groq).
- **Retention, zero data retention (ZDR), training on inputs, data residency**: how long the provider keeps inputs; a promise to keep none (usually paid plans); whether inputs improve future models; which country the servers are in. Once data leaves, protection is a contract, not code.
- **HIPAA (BAA), GDPR, Rwanda's Law No. 058/2021**: health data is a protected category; sending it to a foreign provider is a legal process. Look up the details per project.
- **Data flow map, DPIA** (fundamental): every place data travels and is copied, with who can delete each copy; the first page of a Data Protection Impact Assessment. For a spoken name in WardWise: device, job folder, held result, two Groq trips, IndexedDB, exported files, reading searches.
- **Content-free logs, LLM observability**: WardWise logs sizes, times and error types, never material, because logs live long, are widely read and are forgotten in deletion. Observability tools log every prompt by default, tempting because LLM bugs live in the exact input; use synthetic data and consent-based exported reports instead.
- **OWASP Top 10 for LLM Applications** (2025): the shared checklist (injection, sensitive information disclosure, supply chain, poisoning, improper output handling, excessive agency, system prompt leakage, vector and embedding weaknesses, misinformation, unbounded consumption). Knowing to walk your system through it is the fundamental; the numbering is a detail.
- **Model output is untrusted input** (fundamental): validate and escape what comes out as well as what goes in. Inserted as HTML, model text could carry a script (cross-site scripting, XSS); React shows text as text.
- **Kerckhoffs's principle**: a system should stay safe when everything about it is known except the keys. WardWise's prompt is public; the API key lives in `.env`, never in a prompt.

### 5c. Safety and the wider map (Part 9, embeddings)
- **Embedding, vector** (fundamental): a list of numbers that works as coordinates for meaning, so texts about the same thing land close together. A pharmacy shelved by therapeutic class, not alphabetically: "heart attack" sits beside "myocardial infarction" with no words in common. The axes are learned in training, not designed, and nobody can read them.
- **Dimensions, collision**: how many numbers an embedding has (384 in bge-small). With too few axes, different kinds of thing land on one spot (asthma, wheeze, salbutamol, peak flow); every distinction needs room to vary. The exact number is a detail.
- **Cosine similarity, dot product** (fundamental): do two arrows point the same way? 1 same direction, 0 unrelated. On vectors scaled to length 1 (normalised) it is just the dot product. For centred profiles it equals Pearson's correlation. Read scores as a ranking, not as absolutes: many models squeeze them into a high band (anisotropy, a detail).
- **Lexical (keyword) search vs semantic search** (fundamental): matching words (`youtube.py`, with hand-made patches for plurals and status asthmaticus) vs matching meaning (embeddings). Lexical misses synonyms; semantic misses exact distinctions.
- **Embedding model, encoder vs decoder** (fundamental): an encoder reads the whole text in both directions and returns one vector (the BERT family, about 33 million weights for bge-small, runs on a laptop); a decoder writes one token at a time, left to right (the GPT family, the LLM in WardWise). Reading for gist is a far easier job than writing.
- **Static vs contextual embeddings**: one fixed vector per word (word2vec, 2013; "king − man + woman ≈ queen") vs a vector that depends on the neighbours (transformers, BERT 2018). Attention, in the layers, pulls the same word in different directions; the lookup table always gives the same starting card.
- **Pooling, CLS token, normalising**: squeezing many token vectors into one for the sentence, by averaging (mean pooling) or by a special token whose job is to absorb the whole sentence (CLS, the chair's summary); then scaling the arrow to length 1. Details.
- **Contrastive learning, positives and negatives, in-batch negatives** (fundamental): training by an exam of pairs. Pull a question and its true passage together, push the others apart; in a batch of 32 pairs the other 31 answers are free distractors. The source of the pairs (web search, PubMed clicks for MedCPT, image captions for CLIP) shapes what "related" means.
- **Hard negatives**: plausible distractors (status epilepticus for status asthmaticus), as in a good single-best-answer question. Without them the model never pays for confusing near-misses.
- **Close is not correct** (fundamental): embeddings learn topic, not truth or logic. Negation and conditions score close to their opposites ("do not start insulin" 0.84 from "start insulin", live). Clinical informatics has fought negation for decades (NegEx, 2001: "no evidence of pneumonia").
- **Domain-specific embedding models**: trained on medical pairs (MedCPT, from NCBI). Choose any model by testing on your own material, not by reputation.
- **Embedding inversion** (OWASP LLM08): the original text can be partly rebuilt from its vector, so a vector store of clinical text needs the same protection as the text.
- **Hugging Face, Spaces, MTEB, safetensors**: the "GitHub for models"; free browser demos; a leaderboard for embedding models; a model file format that cannot run hidden code (older "pickle" files can). A model file is software: known publishers, pinned versions.
- **Library vs model**: the code that runs a model (`fastembed`, ONNX Runtime) vs the learned weights it loads (`bge-small-en-v1.5`, 65 MB). The analyser vs its calibration.

### 5c. Safety and the wider map (Part 9, vector search, RAG and tool calling)
- **Vector search, indexing vs querying** (fundamental): embed every passage once, ahead of time (the index), then at each question embed only the question, compare it by cosine with every stored vector and sort. The index at the back of a textbook. 20 passages took 0.11 s to index and 0.007 s to search.
- **Top-k retrieval, k-nearest neighbours (k-NN)** (fundamental): keep the k closest passages. Comparing against every passage is brute force, fine up to tens of thousands. Scores are often crowded (0.66 to 0.69 for six passages, live), so the cut-off at k is close to a coin toss.
- **The retriever is not the LLM** (fundamental): a small embedding model plus plain code chooses the passages; the LLM only reads what it is handed. The hospital library catalogue vs the consultant.
- **Approximate nearest neighbour (ANN), HNSW, vector database**: fast, almost-best search for millions of vectors, and the stores that hold them (pgvector in Postgres, the database under Supabase; FAISS, Chroma, Pinecone). Details to look up when needed.
- **RAG, retrieval-augmented generation** (fundamental): retrieve passages, augment the prompt with them, generate the answer. An open-book exam where a librarian chooses which pages you may open: answer quality is capped by retrieval recall.
- **Retrieval omission vs generation omission** (fundamental): the passage was never sent (RAG top 3 dropped the 3.5 potassium threshold and fluids first) vs it was sent and the model judged it irrelevant (with the whole session, fluids first was still missing). Either way the answer is faithful to its context, incomplete against the session, and the model does not warn you: it cannot flag what it never saw.
- **Long context vs RAG** (fundamental): "if it fits, send it all; retrieve when it does not". A WardWise session (about 3,600 tokens with instructions) fits a context window of over 100,000, so phase 8 v1 should send the whole session; RAG is the scaling path for all of a student's packs, the lobby and the literature. The cost is resending everything on each question (stateless model, 8,000 tokens a minute on the free tier).
- **Fixed vs variable cost in tokens**: instructions, tags and the question cost the same on every call; only the passages scale. 3 passages cost 183 tokens, 20 cost 505, not 1,225. About 1.3 to 1.5 tokens per English word.
- **Relevance vs entailment**: whether a passage is about the question vs whether it says the same thing (does B follow from A?). Embedding similarity measures relevance; the generator, reading the actual words, handles negation and conditions.
- **Tool calling, function calling** (fundamental): the model is given named tools with input schemas and may reply with a structured request ("run `search_session` with query 'insulin start'"); our code decides whether to run it and sends the result back in a message with the role `tool`. The model never runs anything: a consultant writing an order, the nurse or lab carrying it out. Structured output put to work.
- **`finish_reason: tool_calls`**: the same field as "length" and "stop", here meaning "I am waiting for a tool result". The model picks tools by their descriptions, so descriptions are prompt engineering.
- **Every tool is a permission** (fundamental): read-only search is low risk; a tool that writes or sends hands over agency and can complete the lethal trifecta. Scope tools like access rights.

### 5c. Safety and the wider map (Part 9, agents)
- **Agent** (fundamental): an ordinary model that has learned to write tool requests, plus code you write around it: tools, a goal, a loop and guardrails. Not a special model; it sits at the app level of model, provider, app. The intern given a goal, not the nurse given one order. A toy one is about 40 lines; Claude Code is a large one.
- **The agent loop** (fundamental): ask the model, run the tool it asks for, send the result back, repeat until it stops asking or code stops it. Frameworks (OpenAI Agents SDK, LangGraph, Claude Agent SDK) are this loop with extras; details to look up.
- **Workflow vs agent** (fundamental): in a workflow your code fixes the path (WardWise's pack: one call, validate, check quotes); in an agent the model chooses the path. Use the simplest that works: an agent earns its place only when the steps cannot be known in advance.
- **Cost of a loop**: a stateless model is resent the whole conversation at every step, so each step costs more than the last (187 to 1,220 tokens) and the total grows roughly with the square of the steps. A 250-token session cost 6,831 tokens as an agent.
- **Guardrails at the tool boundary** (fundamental): code that checks each tool request before running it (refuse a card whose quote is not in the session) and around the loop (step cap, token cap, code decides "done"). Guardrails interact: a coverage nudge sent the injected line back and so delivered the attack. A cap must say what it cut.
- **Propose, don't act; human-in-the-loop; least privilege** (fundamental): a tool that drafts for a person to approve instead of saving or sending; give each tool the smallest power that does the job.
- **Provenance**: showing where each piece of output came from (the session line beside each card). What actually exposed the injected paracetamol card was provenance shown to a human, not a check.
- **Hook (Claude Code)**: your own script the harness runs before (`PreToolUse`, can block) or after (`PostToolUse`, can send a failure back) one of Claude's tool calls. WardWise's runs the back-end tests after each edit. A permission deny rule is the simpler tool when a call only needs blocking.

### 5c. Safety and the wider map (Part 9, multimodal and the three levers)
- **How a model reads a picture** (fundamental): the photo is cut into patches (tiles of 14 to 28 pixels); a vision encoder (often a vision transformer, ViT, frequently descended from CLIP) turns each patch into a vector; a projector resizes those to the LLM's token size; the image tokens join the word tokens in one sequence. The output is still text, predicted one token at a time. Bolted on (LLaVA, most open models) vs natively multimodal (Gemini): a detail.
- **Image tokens**: a picture is paid for by its area, not its content. On Groq's `qwen3.8-27b` every photo cost 1,794 tokens whatever size was sent (2048, 1024 or 512 pixels), because the provider resizes first; about 9 times the text on the page. Measure `usage.prompt_tokens`; don't derive it from patch size.
- **OCR vs vision LLM**: classic OCR (Tesseract) matches letter shapes and reports only what it sees, weak on handwriting; a vision LLM reads in context, far better on messy writing, but writes the most plausible word where the ink is unclear.
- **Silent substitution** (fundamental): the failure mode of any conversion from a messy input (photo, audio) to clean text: a plausible wrong reading with no sign of doubt. Seen live: "1.2-2g" read as "1-2g", with no [?], at two of three sizes.
- **Calibration** (fundamental): whether stated confidence matches how often one is right (70% sure, right 70% of the time). LLMs are poorly calibrated about their own words, so instructions that rely on self-doubt ("add [?] if unclear") are the weakest kind. You can't prompt a model into knowing what it doesn't know.
- **Laundering through conversion** (fundamental): an error made while turning a photo or recording into text passes every later check, because the checks (`is_grounded`) compare against the wrong copy. Check at the conversion point; nothing after it can tell. The ward version: a pharmacist checking against a mistranscribed drug chart.
- **Two readings compared by code (ensembling, self-consistency)**: read twice, differently, and flag where the readings disagree. Doesn't rely on either model knowing it's unsure; costs twice the tokens. In the live run the two sizes disagreed on exactly the wrong line.
- **Prompting vs RAG vs fine-tuning** (fundamental): tell the intern each shift (prompting: changes only the text sent; tasks, rules, format) vs hand them the pages (RAG: changes what it reads now; knowledge that is specific, current, private or must be cited) vs a rotation (fine-tuning: refits the weights; behaviour, style, narrow skills). Prompt first, RAG for knowledge, fine-tune for behaviour, and climb only when the step below has measurably failed. Choose by the kind of gap, not as a fixed ladder.
- **Why "fine-tune it on our guidelines" is usually wrong**: facts blur (patterns stick better than doses), it can't cite, it goes stale, and it can't forget: trained-in data can leak back out (memorisation) and one person's record can't be removed from the weights.
- **Dynamic few-shot**: retrieve the few examples most like the task and put them in the prompt. RAG feeding prompting; part of Medprompt; the rung to try before fine-tuning for style.
- **Medprompt** (2023): GPT-4 with careful prompting alone (chosen examples, step-by-step reasoning, several answers combined) beat the medically tuned Med-PaLM 2 on licensing-exam questions. Evidence that prompting is often underestimated.
- **LoRA**: a cheap kind of fine-tuning that trains a small add-on instead of all the weights. Detail to look up.

### 5c. Safety and the wider map (Part 9, AI in medicine)
- **The evidence ladder** (fundamental): benchmark, internal validation (held-out test set), external validation (another site, patients never seen), silent or shadow deployment, prospective trial (outcomes, not accuracy), post-market monitoring. Ask which rung the evidence is from and who ran the study.
- **Benchmark, contamination**: a standard test such as MedQA; contamination (data leakage) is when the test questions were in the training data, so a score partly measures memory. An AUROC near 1 should suggest leakage, not excellence.
- **Distribution shift, drift** (fundamental): the population, equipment or charting a model meets differ from what it learned on (a reference range from another population); drift is the same happening over time.
- **Accuracy vs impact**: an accurate tool can still fail to help. Alert fatigue (alarms usually wrong, so all are ignored) and automation bias (trusting the tool so much that one stops thinking).
- **AUROC**: the chance the model scores a random patient with the condition above a random patient without it; 0.5 a coin toss, 1 perfect. Epic's sepsis model: 0.76 to 0.83 by the vendor, 0.63 at an independent hospital.
- **Tests vs evals** (fundamental): software tests check the code works (WardWise's pytest, with stand-ins); evals measure the quality of the model's output across many cases. WardWise has tests and run-time guards, no evals yet.
- **Rubric, LLM-as-judge** (fundamental): "good" broken into parts, each given a judge matched to its difficulty (code, clinician, validated LLM judge, learners' results). An LLM judge is trusted only after it agrees with clinicians on a sample, measured with Cohen's kappa (agreement beyond chance). HealthBench is the large-scale version.
- **Bias** (fundamental): errors that fall systematically on the same group, not at random. Random error shrinks with more data; systematic error does not. Mostly selection bias in the training sample, sometimes a biased label (spending used as a measure of need).
- **Subgroup analysis**: performance reported separately for each group, because an overall average is dominated by the majority and hides a group served worse.
- **Intended purpose** (fundamental): what the maker says the software is for decides whether it is a medical device; the same code can be a study aid or a device. Foreseeable misuse also counts.
- **SaMD (Software as a Medical Device)**: software that is itself the device, defined by the IMDRF. Risk sets the class (in the EU, software informing diagnosis or treatment is at least class IIa); US routes 510(k), De Novo, PMA. Details to look up.
- **CDS transparency**: under the FDA's 2022 guidance, decision support can fall outside device rules partly when the clinician can independently review its basis; the same instinct as showing the quote beside the card.
- **EU AI Act**: AI in a medical device is high-risk AI, with duties on data quality, bias testing, human oversight and logging; for devices, from August 2027.
- **Change control, PCCP**: a regulated device is approved as it is, so changing the model is changing the device; a predetermined change control plan says in advance which changes are expected and how each is tested. WardWise's `.env` switch would become a validated change.
- **Rwanda**: Rwanda FDA regulates medical devices; Law No. 058/2021 on personal data treats health data as sensitive (supervised by NCSA), and sending it abroad (to Groq) is a cross-border transfer; a national AI policy since 2023. Privacy law applies before device law.

## 6. Storage and data ownership

- **Server-side vs client-side storage** (fundamental): data kept on a server (the hospital-held record: sync, sharing, backups, but one breach exposes everyone) vs on the user's device (the patient-held record: private, but no sync and easily lost). WardWise packs are client-side.
- **Local-first software**: data lives on the device first and syncs only if chosen (Obsidian, Apple Health). WardWise is local-first without sync.
- **Relay vs store** (fundamental): a server that holds data only while working on it (WardWise, WhatsApp until delivery) vs one that keeps the master copy.
- **Data at rest vs in transit**: sitting in storage vs travelling over the wire; each is protected separately.
- **Ownership in practice** (fundamental): four questions for every copy: who holds it, who can read it, who can delete it, who answers if it goes wrong.
- **Browser storage shelves**: cookies (small, sent with every request, mostly for logins; WardWise has none), localStorage (small text, a notepad: `lucy-theme`), sessionStorage (gone when the tab closes), IndexedDB (large objects, a filing cabinet: the `lucy` database), Cache Storage (copies of the site for offline use).
- **Storage is per origin** (fundamental): each origin has its own cupboard; two apps on one origin (`user.github.io/a` and `/b`) share it, hence WardWise on its own subdomain. Each browser and profile keeps separate storage; a private window starts empty and is wiped on close.
- **Synchronous vs asynchronous** (fundamental): the page waits (localStorage) vs carries on and gets the answer later as a promise (IndexedDB), like a 202 with a job ID.
- **Quota, eviction, persistent storage** (fundamental): each origin gets a share of disk; best-effort storage can be wiped without warning when space runs low; `navigator.storage.persist()` asks not to be. Edge and Chrome grant it silently only to well-used sites (`false` on localhost in session 6); Firefox asks. `askToKeepPacks` in `storage.ts`.
- **Safari's 7-day rule**: Safari deletes a website's script-written storage (IndexedDB too) after 7 days without a visit, unless the site is added to the home screen.
- **Object store, key, index**: a drawer of records, the field that finds one (`id`), and a sorted view (`by-saved`).
- **Transaction** (fundamental): a group of writes that succeeds or fails as a whole (an import).
- **Migration, schema version** (fundamental): converting stored data when its shape changes; data outlives the code that wrote it. `DB_VERSION` for drawers, `format` for records.
- **put vs add (upsert vs insert)**: save or overwrite vs save only if new. Import uses add, so a backup never overwrites.
- **Error translation**: technical error to the log, a plain sentence on screen (`QuotaExceededError` becomes "no room left").
- **Debouncing**: acting once activity stops, not on every event (the notes draft, half a second after typing).
- **Code splitting**: loading rarely used code only when needed (Zod at the Import click).
- **Trust does not travel with a file**: a forged export can put an invented quote into its own material too, so the import recheck proves consistency, not truth; the "imported" label is the real defence.
- **Data subject, controller, processor** (fundamental): the person the data is about; who decides why and how it is processed; who processes on the controller's behalf (Groq, a host). A shared library would make WardWise the controller of stored cases.
- **Data portability, right to erasure**: take your data with you (Export); have it deleted (Delete, Delete all).

## 7. Testing and security

- **Test, regression** (fundamental): a small program that runs code with a known input and checks the answer, like the lab's daily QC sample; a regression is something that worked and broke unnoticed.
- **Unit, integration, end-to-end tests; the test pyramid** (fundamental): one function, several parts together (a real request to the API), the whole app clicked like a user (Playwright); many cheap ones at the base, few slow ones at the top.
- **Test double (stand-in, fake, mock, stub)** (fundamental): a simulated patient for tests; free, fast, deterministic, can act out failures. `conftest.py` (`fake_transcribe`, `fake_writer`), `fake-indexeddb`. Can drift from the real service (the retired model passed every test).
- **Test coverage**: the share of lines the tests run; 100% means every line ran, not that it was checked well.
- **Continuous integration (CI)**: tests run automatically on every push (GitHub Actions). Not set up yet; a phase 10 candidate.
- **Threat modelling** (fundamental): what are we protecting (assets), from whom and how (threats), what stops them (mitigations).
- **CIA triad**: confidentiality, integrity, availability; most security problems damage one of them.
- **Secret rotation**: revoking a leaked key and issuing a new one; deleting the commit is not enough.
- **Magic bytes**: the opening bytes that identify a file's real type, whatever its name says (`files.py`).
- **XSS (cross-site scripting)**: sneaking code into a page through data; React shows text as text, which blocks the common form.
- **Denial of wallet**: abuse that spends someone's paid or free quota; why `/api/packs` needs an access code and rate limits before going public.
- **Content Security Policy (CSP)**: a header naming the sources a page may load code and data from. Phase 10.
- **Supply chain attack** (fundamental): compromising a dependency instead of the app (event-stream 2018, xz 2024).
- **Lockfile, pinning, version ranges**: lockfiles freeze exact installed versions; `"4.6.5"` is a pin, `"^19.2.8"` allows newer compatible versions. `npm audit`, `pip-audit` check for known vulnerabilities.
- **Least privilege** (fundamental): each part gets only the access it needs (the browser holds no key).
- **OWASP Top 10**: the standard list of web app risks; a separate OWASP list covers LLM apps.
- **Never trust the client** (fundamental): checks in the page are a courtesy (quick feedback); checks on the server are the safety, because anyone can send requests without the page. Both exist for the photo limit: `NotesPhotos.tsx` and `routes.py`.
- **Trust boundary, validate at the boundary** (fundamental): wherever data enters from outside (requests, files, other APIs, AI answers), check it once, strictly, so the inside can trust it. Admission wristbands. Plain type hints and TypeScript types check nothing at run time; Pydantic and Zod do.
- **Defence in depth** (fundamental): several independent layers, so one mistake is not enough (the response model filter plus never putting keys in job data; three layers of deletion).
- **Authentication vs authorisation** (fundamental): who you are (sign-in) vs what you may see (only your own packs). Needed if WardWise ever has accounts.
- **Supply chain for AI skills**: a skill's instructions steer the AI like code steers a program; read them, pin a reviewed copy, never auto-update by link.
- **Browser extensions**: run inside every page and can send requests of their own (a Google Fonts request appeared in WardWise's Network tab that WardWise's code never makes). We control WardWise's code, not the visitor's browser.

## 8. Building WardWise (from 2026-11-10)
- **Attack surface** (fundamental): every place a stranger can send something into your system. Deleting the slide readers removed the riskiest part of WardWise's (files are the hardest input to make safe).
- **Breaking change**: a change to an API contract that old callers cannot survive. Ship both sides together, and decide on purpose whether to keep reading old data (backward compatibility, a tolerant reader) or leave it behind, as WardWise did with slides.
- **Human in the loop, before or after** (fundamental): where the human check sits. WardWise moved it from before the pack (check, then write) to after (write, then check), like a lab that releases results at once and flags critical values.
- **Automation bias** (fundamental): people trust what a machine hands them and stop checking. The counter-measures are making the check easy and pointing it at what matters (highlights and a count).
- **Screening-test thinking for alerts**: a highlighter is a screening test. Tune it for sensitivity when a miss is costly (a wrong dose) and a false alarm is cheap (a glance). Too many false alarms, though, and people stop looking (alert fatigue).
- **Edit distance (Levenshtein distance)**: the fewest single-letter changes that turn one word into another ("ipertropium" to "ipratropium" is 2). The engine behind fuzzy matching and spell-checkers. `editDistance` in `lib/highlight.ts`.
- **Pure function** (fundamental): output depends only on input, with no side effects, so it is easy to test and reuse. `findMarks(text)` gives marks for any text, the original or the student's correction.
- **Word error rate (WER)**: the share of words a transcript got wrong (substituted, missing or added), the standard score for speech-to-text. A general WER hides what matters here; a critical-term error rate (doses, drugs) measures the costly errors.
- **Speech-to-text hallucination**: words that were never said, often added in silence ("Thank you." at the end of a silent stretch). Worse than a misspelling, because nothing flags it.
- **Leaderboard vs your own data**: benchmarks use other speakers and other words; a model that wins on American English may not win on Rwandan-accented ward talk. Decide with a small test set of your own (an eval set).
- **Map-reduce** (fundamental): do the same job on each piece (map), then combine the results (reduce). Search engines, big-data tools and long-document AI all work this way. WardWise maps "take notes on this part" over the parts of a long round, then reduces the notes into one pack (`_write_long` in `generate.py`).
- **Chunking and overlap**: cutting long text into pieces a model can take in one go. Cut at natural boundaries (passages, sentences) and repeat a little across each cut, so an idea that spans it is whole in at least one piece (`split_parts`).
- **Rate limit vs context window, again** (fundamental): the model could read an hour-long round at once (its context window is about 131,000 tokens); the free tier only lets WardWise send 8,000 tokens a minute. Chunking here works around the rate limit, not the model.
- **Client-side rate limiting (pacing)**: keeping to a provider's allowance yourself instead of being refused. WardWise counts what it sent to each model in the last 60 seconds (a **sliding window**) and waits for room (`pacing.py`). The general family includes the token bucket; the opposite approach is to send, get a 429 and retry with **backoff**.
- **Lock (mutual exclusion)**: when several threads share one count, only one may read and change it at a time, or two could both see room that only fits one. `threading.Lock` in `pacing.py` and `jobs.py`.
- **Plan first, then details (output ordering)**: a model writes its answer one token at a time, so a field it writes first (the list of topics, a question's topic) steers everything after it. Listing the topics before the points stopped the note-taker skipping DKA.
- **Concrete targets beat vague instructions**: "spread across the topics" was ignored; "Asthma: 3; Malaria: 2; PPH: 1" was kept. Work out what you can in code and give the model numbers.
- **Largest remainder method (apportionment)**: share a whole number of seats in proportion to votes: give each its whole part, then the leftover seats to the biggest remainders. WardWise shares flashcards and questions among topics this way, weighted by how much each was taught and stressed (`share`).
- **Reference, not copy**: let one thing point at another by an id instead of repeating it, like a foreign key in a database. The writer names "note 7" and WardWise fills in note 7's exact quote, so answers are a third shorter and quotes cannot be miscopied (`from_notes`).
- **Graceful degradation** (fundamental): when one part fails, deliver the rest rather than nothing. A long pack whose quiz fails still arrives, and its Quiz tab offers to write the quiz from the pack.
- **Information hiding**: a part of a system keeps its inner workings to itself and shows only what others need. WardWise splits a long session into parts, but the student, who uploaded one session, only ever sees one session being read. A **leaky abstraction** is one whose inner details show through.
- **Optimistic concurrency (compare and set)**: save a change only if the thing has not changed since you read it, checked by a version stamp, instead of locking it while you work. WardWise adds a quiz written later only if the pack's `savedAt` still matches (`addQuiz`).
- **Hierarchical summarisation**: condensing notes that are themselves too long a second time, in a tree. Not needed for 90 minutes; the likely next step for 3-hour rounds, with transcription as the recording goes.

### Phase 8a. Ask about my session: the engine (2026-11-10)
- **BM25 (lexical search)** (fundamental): ranks passages by the search words they contain. Rare words count for more (inverse document frequency), a repeated word helps less each time (saturation), and long passages are held back (length normalisation). The classic search-engine formula, about 40 lines in `app/ask/bm25.py`. **Lexical** means matching words; **semantic** means matching meaning (embeddings). Lexical misses synonyms, which is why the rewriter adds them.
- **Query rewriting**: turning the student's question into a better search before searching: a follow-up ("and the dose?") made to stand on its own, synonyms added, short index-style terms for the literature. Done by the small model, since it is cheap and has its own allowance.
- **Federated search (federated retrieval)** (fundamental): one question sent to several sources at once, each answering with its own best results. Scores from different sources are on different scales (like a GCS and a pain score), so they are not pooled into one ranking; each source gets its own places and the answer writer chooses.
- **Evidence-source layer (adapter pattern)** (fundamental): every source, the session included, answers the same call, `search(query)`, so a new one (OpenEvidence) is one more class. An **adapter** wraps something with its own interface so it fits a shared one, like a travel plug.
- **Citation checking**: code confirms each part of an answer cites a passage that was really sent and that its quote is in that passage; uncited parts are dropped. It proves the words exist, not that the claim follows from them.
- **Abstention** (fundamental): a designed "I don't know". When the passages do not answer, WardWise says so rather than letting the model answer from memory.
- **Population mismatch**: applying evidence from one group (adults) to another (children). Handled in the answer form, not only the prompt: each part states whether its passages are about the group asked about ("yes", "not stated", "no"), and code drops "no" and flags "not stated".
- **Spike**: a short, throwaway test to answer one question before committing to a design ("can we get StatPearls text by API?"). Answer: not the chapter, but its PubMed abstract is a short clinical summary of it (about 100 to 400 words).
- **Defence in depth** (fundamental): several independent layers against one risk, so one failing is not enough. Real-patient questions: the rewriter's flag, then code declines before any search, then the answer prompt, then the app's rule shown to users.

