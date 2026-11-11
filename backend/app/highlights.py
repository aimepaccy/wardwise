"""Week highlights: the most important teaching of a student's week, as a few short paragraphs of prose.

Written from the teaching points of the week's packs, which were each checked against their session when
the pack was written; the sessions themselves are not sent again. Every paragraph cites the points it rests
on, and code keeps only paragraphs whose citations are real. What a paragraph says is not checked against
the points it cites (as with every quote check, a citation shows where an idea came from, not that it was
carried over faithfully), so the highlights are labelled as written by AI.
"""

import logging
from collections.abc import Callable

from app import providers
from app.config import get_settings
from app.generate import _DATA_ONLY, _ask, _no_links, _tries, _untag
from app.pacing import CHARS_PER_TOKEN
from app.schemas import Highlight, HighlightsDraft, HighlightsRequest, WeekHighlights, WeekPoint

log = logging.getLogger('wardwise.highlights')

# Room for the answer and the model's silent reasoning, and for these instructions with the form.
OUTPUT_TOKENS = 3000
OVERHEAD_TOKENS = 1000
MIN_HIGHLIGHTS, MAX_HIGHLIGHTS = 3, 6
LABEL = "Writing your week's highlights"


def instructions(count: int) -> str:
    return f"""You write a short weekly review for a medical student, from the key teaching points of their \
ward-round sessions this week. They will read it, or listen to it, at the weekend.

The points are numbered, between <material> tags, one per line: its number, then in square brackets the day, \
the session and the topic, then the point. Each point was checked against what was taught. {_DATA_ONLY}

Write up to {count} highlights: the things most worth carrying from this week. Each has:
- heading: two to six words naming the theme.
- text: two to four sentences of plain, flowing prose. No lists, symbols or headings inside it.
- points: the numbers of the points it rests on, at least one.

Rules:
- Choose what matters most for safe practice: first steps, doses, thresholds, red flags, and what was stressed.
- Use only what the points say. Add no facts, doses, numbers or drug names they do not give, and no reasons, \
consequences or advice of your own ("this prevents...", "this confirms...", "escalate care").
- Keep every dose, number, unit and drug name exactly as the points give it.
- Where two sessions teach the same drug, sign or principle for the same patient group, you may join them in one \
highlight and cite both. Keep teaching about different patient groups (such as adults and children) in separate \
highlights, and do not join unrelated conditions to make a theme.
- You may say which day or session something came from, in passing.
- No links, references or sources.
"""


def _line(number: int, point: WeekPoint, request: HighlightsRequest) -> str:
    def clean(text: str) -> str:
        return ' '.join(_untag(text).split())

    session = request.sessions[point.session - 1]
    label = ' · '.join(clean(part) for part in (session.day, session.title, point.topic) if part.strip())
    return f'{number}. [{label}] {clean(point.text)}'


def room() -> int:
    """How many characters of points one call can take, within a minute's allowance (never below none)."""
    return max(0, int((get_settings().llm_tokens_per_minute - OUTPUT_TOKENS - OVERHEAD_TOKENS) * CHARS_PER_TOKEN))


def _usable(request: HighlightsRequest) -> list[int]:
    """Points with text, for a session that was sent."""
    return [i for i, point in enumerate(request.points) if point.text.strip() and point.session <= len(request.sessions)]


def fit(request: HighlightsRequest, space: int) -> list[int]:
    """The points to write from, as indexes into request.points, in the order sent. A busy week may have more
    than one call takes: points are then taken from each session in turn (each session's first, then its
    second...), so every session keeps its main teaching, and the rest are left out."""
    by_session: dict[int, list[int]] = {}
    for index in _usable(request):
        by_session.setdefault(request.points[index].session, []).append(index)
    queues = list(by_session.values())
    chosen: list[int] = []
    used = 0
    for depth in range(max((len(queue) for queue in queues), default=0)):
        for queue in queues:
            if depth < len(queue):
                # Numbered lines grow by a few characters; 10 covers "120. " and the line break.
                size = len(_line(0, request.points[queue[depth]], request)) + 10
                if used + size <= space:
                    chosen.append(queue[depth])
                    used += size
    return sorted(chosen)


def material(request: HighlightsRequest, chosen: list[int]) -> str:
    lines = (_line(number, request.points[index], request) for number, index in enumerate(chosen, start=1))
    return '<material>\n<points>\n' + '\n'.join(lines) + '\n</points>\n</material>'


def check(draft: HighlightsDraft, request: HighlightsRequest, chosen: list[int]) -> list[Highlight]:
    """Keeps highlights that cite at least one real point, with their citations in the browser's numbering,
    and works out their sessions from those points. Links are removed."""
    kept: list[Highlight] = []
    for item in draft.highlights[:MAX_HIGHLIGHTS]:
        cited = [chosen[number - 1] for number in dict.fromkeys(item.points) if 1 <= number <= len(chosen)]
        text = _no_links(item.text).strip()
        if not cited or not text:
            continue
        sessions = sorted({request.points[index].session for index in cited})
        # A heading is read aloud and shown as a title; an empty one takes the first cited point's topic or session.
        first = request.points[cited[0]]
        heading = _no_links(item.heading).strip() or first.topic.strip() or request.sessions[first.session - 1].title.strip()
        kept.append(Highlight(heading=heading, text=text, points=[i + 1 for i in cited], sessions=sessions))
    return kept


def write(request: HighlightsRequest, on_step: Callable[[str], None] = lambda step: None) -> WeekHighlights:
    if room() == 0:
        log.error('LLM_TOKENS_PER_MINUTE leaves no room for week highlights')
        raise providers.ProviderError("WardWise is not set up to write week highlights. Please tell whoever runs it.")
    chosen = fit(request, room())
    if not chosen:
        raise providers.ProviderError('This week has no teaching points to write highlights from.')
    topics = {(request.points[i].session, request.points[i].topic.strip().casefold()) for i in chosen}
    count = min(MAX_HIGHLIGHTS, max(MIN_HIGHLIGHTS, len(topics)))
    on_step(LABEL)

    def attempt() -> list[Highlight]:
        draft = _ask(instructions(count), material(request, chosen), HighlightsDraft, OUTPUT_TOKENS, LABEL, on_step)
        highlights = check(draft, request, chosen)
        if not highlights:
            raise providers.InvalidOutput('The AI wrote no highlights that cite the points.')
        return highlights

    highlights = _tries(attempt, 'Highlights', failure="your week's highlights")
    left_out = len(_usable(request)) - len(chosen)
    return WeekHighlights(highlights=highlights, left_out=left_out, model=get_settings().llm_model)
