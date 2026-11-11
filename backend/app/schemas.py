from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Far above what fits in one study pack; the token budget is the real limit. This only stops absurd requests.
MAX_TEXT_CHARS = 200_000
MAX_QUESTION_CHARS = 500
AudioKind = Literal['webm', 'ogg', 'mp4', 'wav', 'mp3', 'flac']
PhotoKind = Literal['jpeg', 'png', 'webp']


class Health(BaseModel):
    status: Literal['ok']


class AudioReceipt(BaseModel):
    name: str
    kind: AudioKind
    size_bytes: int


class PhotoReceipt(BaseModel):
    name: str
    kind: PhotoKind
    size_bytes: int


class SessionReceipt(BaseModel):
    audio: AudioReceipt | None
    photos: list[PhotoReceipt]


class Materials(BaseModel):
    transcript: str | None
    # Handwritten notes as WardWise read them from photos, in the order the photos were added.
    notes: str | None = None
    warnings: list[str]


JobStatus = Literal['queued', 'working', 'done', 'failed']


class JobCreated(BaseModel):
    job_id: str
    receipt: SessionReceipt


# What the student sends to have a study pack written: their corrected copy of what WardWise heard
# and read. Only text; the files themselves were deleted after reading.
class PackRequest(BaseModel):
    # Notes as read from the photos; the word budget is the real limit.
    notes: str = Field('', max_length=MAX_TEXT_CHARS)
    transcript: str | None = Field(None, max_length=MAX_TEXT_CHARS)


# A pack's teaching point, sent back to have a quiz written for a pack that came without one.
class QuizPoint(BaseModel):
    # Packs written before topics existed have none.
    topic: str = Field('', max_length=200)
    text: str = Field(max_length=2000)
    quote: str = Field(max_length=2000)


# The pack's points to write from, and the session they came from, to check each question's quote against.
class QuizRequest(PackRequest):
    points: list[QuizPoint] = Field(min_length=1, max_length=30)


# The form the AI fills in. `extra='forbid'` makes the JSON schema say "no other fields", which strict
# structured output requires. Counts are maximums only: thin material should give fewer items, not invented ones.
class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')


class TeachingPoint(Strict):
    topic: str = Field(description='The condition or clinical problem this point belongs to, 1 to 4 words.')
    text: str = Field(description='One teaching point, one or two sentences.')
    quote: str = Field(description='Words copied exactly from the material that support this point.')


class Flashcard(Strict):
    front: str = Field(description='A question or prompt.')
    back: str = Field(description='The answer, short.')
    quote: str = Field(description='Words copied exactly from the material that support this card.')


class Option(Strict):
    text: str
    explanation: str = Field(description='Why this option is right or wrong.')


class Question(Strict):
    stem: str = Field(description='A short clinical scenario ending in a question.')
    options: list[Option] = Field(description='Exactly five options, A to E.')
    answer: Literal['A', 'B', 'C', 'D', 'E']
    quote: str = Field(description='Words copied exactly from the material that support the answer.')


class PackDraft(Strict):
    title: str
    overview: list[str] = Field(description='Two to four short paragraphs summarising the whole session, in order.')
    summary: list[TeachingPoint] = Field(description='The key teaching points.')
    flashcards: list[Flashcard]
    questions: list[Question]
    search_terms: list[str] = Field(description='Search terms for further reading. Never links or references.')


# A long session is written in steps. First its parts are condensed into notes: teaching points, each with
# an exact quote, and the signals that say why it matters, so the most important ones can be chosen.
Signal = Literal['stressed', 'repeated', 'safety', 'exam']


class CondensedPoint(Strict):
    topic: str = Field(description='The condition or clinical problem this point belongs to, 1 to 4 words.')
    text: str = Field(description='The teaching point in one sentence.')
    quote: str = Field(description='Words copied exactly from the material that support this point.')
    signals: list[Signal] = Field(description='Why it matters. Empty if none.')


class CondensedPart(Strict):
    # Written first, as a plan: listing every topic before the points makes a model less likely to skip one.
    topics: list[str] = Field(description='Every topic taught in this part, in order, each once.')
    points: list[CondensedPoint]


# Then the pack is written from the numbered notes, in two calls, since the answers of both do not fit in one.
# Items name the point they come from by its number instead of copying its quote (a reference, not a copy):
# the answer is a third shorter, and WardWise fills in the point's exact quote itself.
POINT = Field(description='The number of the note this comes from.')


class NotedTeachingPoint(Strict):
    topic: str = Field(description='The condition or clinical problem this point belongs to, 1 to 4 words.')
    text: str = Field(description='One teaching point, one or two sentences.')
    point: int = POINT


class NotedFlashcard(Strict):
    topic: str = Field(description='The topic this card is on, exactly as named in the list.')
    front: str = Field(description='A question or prompt.')
    back: str = Field(description='The answer, short.')
    point: int = POINT


class NotedQuestion(Strict):
    # Named first, like the note-taker's topic list: it keeps the writer counting each topic's share.
    topic: str = Field(description='The topic this question is on, exactly as named in the list.')
    stem: str = Field(description='A short clinical scenario ending in a question.')
    options: list[Option] = Field(description='Exactly five options, A to E.')
    answer: Literal['A', 'B', 'C', 'D', 'E']
    point: int = POINT


class PackBodyDraft(Strict):
    title: str
    overview: list[str] = Field(description='Short paragraphs summarising the whole session, in order.')
    summary: list[NotedTeachingPoint] = Field(description='The key teaching points.')
    flashcards: list[NotedFlashcard]
    search_terms: list[str] = Field(description='Search terms for further reading. Never links or references.')


class QuizDraft(Strict):
    questions: list[NotedQuestion]


# What the browser receives: the AI's work plus WardWise's own checks.
class CheckedPoint(TeachingPoint):
    grounded: bool


class CheckedFlashcard(Flashcard):
    grounded: bool


class CheckedQuestion(Question):
    grounded: bool


class StudyPack(BaseModel):
    title: str
    overview: list[str]
    summary: list[CheckedPoint]
    flashcards: list[CheckedFlashcard]
    questions: list[CheckedQuestion]
    search_terms: list[str]
    # Coverage: passages of the material that no item in the pack draws on, out of how many in all.
    uncovered: list[str]
    passage_count: int
    model: str


class PackJobCreated(BaseModel):
    job_id: str


# "Ask about my session". The browser sends the session with each question, since the server keeps no copy,
# and the last few turns of the chat, so a follow-up ("and the dose?") can be understood.
class ChatTurn(BaseModel):
    question: str = Field(max_length=MAX_QUESTION_CHARS)
    answer: str = Field(max_length=4000)


class AskRequest(PackRequest):
    question: str = Field(min_length=2, max_length=MAX_QUESTION_CHARS)
    history: list[ChatTurn] = Field(default_factory=list, max_length=10)
    # The pack's title, so a short question ("how long for prednisolone?") is searched in the session's context.
    topic: str = Field('', max_length=200)


class QuestionDraft(Strict):
    question: str = Field(description='The latest question, rewritten to stand on its own.')
    keywords: list[str] = Field(description='Words and synonyms to find the answer in the session.')
    search_terms: list[str] = Field(description='1 to 3 short search terms for medical literature, most specific first.')
    group: str = Field(description='The patient group the question asks about, such as "children"; empty if none.')
    real_patient: bool = Field(description="True if the question is about a real person's care rather than the teaching.")


class AnswerPartDraft(Strict):
    text: str = Field(description='One or two sentences of the answer.')
    sources: list[int] = Field(description='The numbers of the passages this part rests on.')
    quote: str = Field(description='Words copied exactly from the first passage in sources.')
    applies: Literal['yes', 'not stated', 'no'] = Field(
        description='Do the cited passages say they are about the group in <group>, or else the patients in <population>? "yes" if neither is given.'
    )


class AnswerDraft(Strict):
    parts: list[AnswerPartDraft] = Field(description='The answer in short parts; none if the passages do not answer it.')
    disagree: bool = Field(description='True if the session and the literature say different things.')


SourceKind = Literal['session', 'pubmed', 'statpearls']


class AnswerSource(BaseModel):
    number: int
    kind: SourceKind
    title: str
    # Built by WardWise from a checked id; never written by the AI. None for the session.
    url: str | None
    detail: str
    # The cited passages themselves, in the order cited, so the student can see what the answer rests on.
    passages: list[str]


class AnswerPart(BaseModel):
    text: str
    sources: list[int]
    quote: str
    # The quote was found in the passages this part cites.
    grounded: bool
    # The question asks about a group (such as children) and the cited passages do not say they are about it.
    group_unclear: bool = False


class Answer(BaseModel):
    # The question as WardWise understood it, after rewriting a follow-up to stand on its own.
    question: str
    parts: list[AnswerPart]
    # Only the sources the answer cites, numbered in the order they are first cited.
    sources: list[AnswerSource]
    disagree: bool
    # The patient group the question asks about, such as "children"; empty if none.
    group: str = ''
    # When the question names no group: the patients the session is about, which the answer was written for.
    population: str = ''
    # The question was about a real patient's care, so WardWise did not search or answer.
    declined: bool = False
    # The literature search terms used, so the student can see what was looked up.
    searched: list[str]
    # Sources that could not be searched this time, in plain words.
    notes: list[str]
    model: str


# Week highlights: a short review in prose of a week's sessions, written from their teaching points. The browser
# sends only points whose quote was found when each pack was written, without the quotes (code does not need
# them here, and they would take room). The sessions are numbered by their place in the list.
MAX_WEEK_SESSIONS = 20


class WeekSession(BaseModel):
    # The day it was saved, such as "Tuesday", so the writer can say when something was taught.
    day: str = Field(max_length=20)
    title: str = Field(max_length=200)


class WeekPoint(BaseModel):
    session: int = Field(ge=1, le=MAX_WEEK_SESSIONS)
    topic: str = Field('', max_length=200)
    text: str = Field(max_length=1000)


class HighlightsRequest(BaseModel):
    sessions: list[WeekSession] = Field(min_length=1, max_length=MAX_WEEK_SESSIONS)
    points: list[WeekPoint] = Field(min_length=1, max_length=300)


class HighlightDraft(Strict):
    heading: str = Field(description='Two to six words naming the theme.')
    text: str = Field(description='Two to four sentences of plain prose.')
    points: list[int] = Field(description='The numbers of the points this highlight rests on.')


class HighlightsDraft(Strict):
    highlights: list[HighlightDraft]


class Highlight(BaseModel):
    heading: str
    text: str
    # The points it cites, numbered as the browser sent them (from 1), and the sessions they come from, worked
    # out by code from the points, never taken from the AI.
    points: list[int]
    sessions: list[int]


class WeekHighlights(BaseModel):
    highlights: list[Highlight]
    # Points left out because the week had more than one call can take.
    left_out: int
    model: str


class JobState(BaseModel):
    status: JobStatus
    step: str
    materials: Materials | None = None
    pack: StudyPack | None = None
    # A quiz written on its own, for a pack that came without one.
    questions: list[CheckedQuestion] | None = None
    answer: Answer | None = None
    highlights: WeekHighlights | None = None
    error: str | None = None


class ReadingLink(BaseModel):
    title: str
    url: str
    # A short line under the title, such as the journal and year, or the channel.
    detail: str = ''


class ReadingSource(BaseModel):
    key: str
    name: str
    # One line on what the source is, shown under its name.
    about: str
    # 'results' lists what the service found; 'search' is one link to the service's own search page.
    kind: Literal['results', 'search']
    # 'off' means the source is not set up on this server (for example, no YouTube key).
    status: Literal['ok', 'failed', 'off']
    links: list[ReadingLink] = []
    note: str | None = None


class Reading(BaseModel):
    term: str
    sources: list[ReadingSource]


class Limits(BaseModel):
    max_audio_mb: int
    max_photos: int
    max_photo_mb: int
    # About how many words of material WardWise can write one study pack from.
    max_pack_words: int
    max_pack_chars: int
    # Up to this, the pack is written in one go (under a minute); longer material is condensed first (minutes).
    quick_pack_chars: int
