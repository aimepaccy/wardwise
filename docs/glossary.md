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
- **JSON** (fundamental): text with labelled values, `{"max_slide_files": 5}`. The standard result format both sides read, so Python (server) and TypeScript (page) can talk. Every response in WardWise is JSON, errors included.
- **localhost**: "this same computer". WardWise's page runs at `localhost:5173`, its server at `localhost:8000`.
- **Port**: a numbered door on a computer; each program listens at its own. `API_URL` in `api.ts`
- **Job, job ID** (fundamental): work the server does in the background after it has answered; the ID is the lab number used to ask about it later. `backend/app/jobs.py`
- **Single source of truth** (fundamental): each fact lives in one place and everything else asks that place. The word meter asks the server for the word limit (`frontend/src/hooks/use-limits.ts`); the slide box keeps its own copy of "5 files" (`SlideDropZone.tsx`), which can drift from the server's.

## 2. The browser side

- **React** (fundamental): a library for building pages out of components. You describe what the page should look like for the current state; React does the redrawing. An observation chart that reprints itself from the latest values.
- **Declarative vs imperative** (fundamental): "here is what it should look like" vs "do this, then this". React is declarative; the old way of changing pages box by box is imperative.
- **Component** (fundamental): a reusable piece of the page that knows how to draw itself. A form template, filled in differently each time it is used. One per file in `frontend/src/components/`; `App` holds them all.
- **JSX**: the HTML-looking code inside TypeScript. `<Header theme={theme} />` means "draw a Header, with its `theme` slot filled in".
- **Props** (fundamental): what a parent hands a child: information and phone numbers (functions to call). The child reads them but cannot change them. `theme` and `onChange` in `ThemeToggle.tsx`
- **State** (fundamental): a component's own memory, which changes over time; changing it makes React redraw what depends on it. `theme` and `notes` in `App.tsx`, `cleared` in `NotesEditor.tsx`
- **Redraw (re-render)**: React drawing a component again after its state or props change.
- **Data down, events up** (fundamental): state flows down as props; children report what happened by calling the function they were given. "Down go data and phone numbers, up go phone calls." The theme button: `App` → `Header` → `ThemeToggle`, and the click back up.
- **Event, event handler**: something that happened (a click, a keystroke) and the function that runs when it does (`onClick`, `onChange`).
- **Lifting state up** (fundamental): keep state in the nearest common parent of every component that needs it, and no higher. `notes` lives in `App` because the editor, the word meter, the draft saver and Generate all need it; the Undo clear text stays in `NotesEditor`.
- **Controlled component** (fundamental): an input box that shows exactly what state says and reports every change up. A secretary typing only what the doctor dictates. The notes `Textarea` in `NotesEditor.tsx`. A broken `onChange` gives a box you cannot type in.
- **Derived state** (fundamental): anything that can be calculated from state is calculated on every redraw, never stored. BMI from weight and height. `countWords(value)` in `NotesEditor.tsx`, `busy` in `App.tsx`
- **Hook**: a function whose name starts with `use` that gives a component a power such as memory (`useState`) or a side job (`useEffect`); WardWise's own hooks are in `frontend/src/hooks/`. Details in a later session.
- **Premature optimisation**: making code faster before measuring whether it is slow. Usually costs clarity for nothing.
- **StrictMode**: in development only, React runs each component's start-up work twice to expose hidden bugs; that is why `limits` appears twice in the Network tab. `frontend/src/main.tsx`

## 3. Across the wire

- **Path**: the part of an address after the server, such as `/api/limits`. Matched exactly, letter by letter.
- **Status code** (fundamental): the three-digit stamp on every response. 2xx it worked; 4xx the request was wrong (the ward's fault); 5xx the server broke (the lab's fault). It describes this one request, not the history of the job.
- **200 OK**: here is your answer now.
- **202 Accepted**: received, the answer comes later; here is your job ID. Used by `POST /api/sessions` and `POST /api/packs`.
- **404 Not Found**: no such thing here: a wrong address, or a job the server no longer knows.
- **422 Unprocessable Content**: the form is filled in wrong (too many slide files, notes too long).
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
- **Binary vs text**: a recording or PDF is raw bytes, not letters, so it cannot go into JSON as it is.
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
- **Literal**: a tickbox, only the listed values are allowed (`Literal['pdf', 'pptx']`).
- **Response model**: the declared shape of an answer (`-> JobState`). Works as an output filter: only declared boxes leave, so a stray key in a job is dropped (shown live with a fake key).
- **Extra fields: ignore vs forbid**: Pydantic ignores unknown boxes by default (tolerant); `extra='forbid'` rejects them (strict). WardWise is tolerant with the browser and strict with the AI's form.
- **Silent failure vs fail loudly** (fundamental): an error nobody sees (a misspelled `transcipt` silently drops the transcript) is worse than a visible one. Fail loudly: stop and say so.
- **OpenAPI, /docs**: a standard machine-readable description of an API, generated by FastAPI from the code; `/docs` shows it as a page you can try requests from. Used to call others' APIs, test your own, hand an API to a teammate, generate client code, or describe a service to an AI.
- **API contract, API-first design**: teams agree the API description first, then build both sides in parallel against it.
- **415 Unsupported Media Type**: "we do not process this kind of sample": the file is not a PDF, PowerPoint or audio by its content.
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
- **Graceful degradation**: one broken part does not sink the rest. An unreadable slide becomes a warning and the pack is still written.
- **Data minimisation, storage limitation** (fundamental): keep the least data for the shortest time. In data protection laws (GDPR, and similar principles in Rwanda's law) and hospital retention policies.
- **`finally`** (fundamental): "run this whatever happened above". WardWise deletes a job's folder in a `finally`. Same idea as `with` in Python, `defer` in Go, `using` in C#.
- **WardWise's three layers of deletion**: `finally` at the end of each reading job; a sweep of `wardwise-jobs` at every start (for crashes and power cuts); a rolling sweep of folders older than 15 minutes.
- **Secure deletion**: deleting a file removes the signpost before the data is overwritten. A detail to look up.

## 5. The AI layer

- **Training vs inference** (fundamental): learning (weights adjusted on huge data, once, costly) vs use (input in, output out, weights unchanged). A printed textbook edition: reading it does not change it. Whisper does not improve from WardWise's recordings.
- **Weights**: the model's internal numbers, set during training.
- **Fine-tuning**: a short extra round of training on new data. Would need students' transcripts on a server, so not for WardWise.
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

## 6. Storage and data ownership

## 7. Testing and security

- **Never trust the client** (fundamental): checks in the page are a courtesy (quick feedback); checks on the server are the safety, because anyone can send requests without the page. Both exist for the slide limit: `SlideDropZone.tsx` and `routes.py`.
- **Trust boundary, validate at the boundary** (fundamental): wherever data enters from outside (requests, files, other APIs, AI answers), check it once, strictly, so the inside can trust it. Admission wristbands. Plain type hints and TypeScript types check nothing at run time; Pydantic and Zod do.
- **Defence in depth** (fundamental): several independent layers, so one mistake is not enough (the response model filter plus never putting keys in job data; three layers of deletion).
- **Authentication vs authorisation** (fundamental): who you are (sign-in) vs what you may see (only your own packs). Needed if WardWise ever has accounts.
- **Supply chain for AI skills**: a skill's instructions steer the AI like code steers a program; read them, pin a reviewed copy, never auto-update by link.
- **Browser extensions**: run inside every page and can send requests of their own (a Google Fonts request appeared in WardWise's Network tab that WardWise's code never makes). We control WardWise's code, not the visitor's browser.
