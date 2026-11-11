"""The evidence-source layer: every source answers the same call, `search(query)`, with passages.

The student's session is one source among the others, searched the same way. A new source (OpenEvidence,
if access comes) is one more class with a `search`, added to `LITERATURE`; nothing else changes.
"""

import asyncio
from dataclasses import dataclass
from typing import Protocol

from app.ask import bm25
from app.generate import cut
from app.reading import ncbi
from app.schemas import SourceKind

# Matches, each handed on with its neighbours, so up to three times as many cut passages reach the answer.
SESSION_PASSAGES = 5
LITERATURE_PASSAGES = 3
# From one article at most, so a single long abstract cannot fill a source's places.
PER_DOCUMENT = 2
ARTICLES = 3
CHAPTERS = 2


@dataclass(frozen=True)
class Query:
    question: str
    # Words and synonyms for searching the session.
    keywords: list[str]
    # Short index-style terms for the literature, most specific first.
    terms: list[str]
    # The patient group the question asks about, such as "children"; empty if none.
    group: str = ''
    real_patient: bool = False
    # The patients the session is about, worked out by code; stands in for `group` when the question names none.
    population: str = ''

    @property
    def about(self) -> str:
        return self.group or self.population


@dataclass(frozen=True)
class Passage:
    kind: SourceKind
    title: str
    text: str
    url: str | None = None
    detail: str = ''


class Source(Protocol):
    name: str

    async def search(self, query: Query) -> list[Passage]: ...


def _best(query: Query, candidates: list[Passage], limit: int, per_document: int | None = None) -> list[Passage]:
    """The passages that best match the question's words, at most `per_document` from any one title.

    The patient group counts as one more search word: a nudge towards passages about the right patients, not a
    filter, since many articles about adults never say "adults".
    """
    ranked = bm25.rank([query.question, *query.keywords, query.about], [passage.text for passage in candidates])
    chosen: list[Passage] = []
    taken: dict[str, int] = {}
    for index, _ in ranked:
        passage = candidates[index]
        if per_document and taken.get(passage.title, 0) >= per_document:
            continue
        taken[passage.title] = taken.get(passage.title, 0) + 1
        chosen.append(passage)
        if len(chosen) == limit:
            break
    return chosen


class Session:
    """The student's own recording and notes, sent by the browser with each question.

    Searched in small passages, so a match is precise, but each match is handed on with the passage before and
    after it: talk often carries its point across an edge ("those patients need intensive care" follows the
    passage that says which patients). Neighbours that touch or overlap are joined into one passage.
    """

    name = 'Your session'

    def __init__(self, notes: str, transcript: str | None):
        texts = {'Your notes': cut(notes), 'Your recording': cut(transcript or '')}
        self.passages = [Passage('session', title, text) for title, parts in texts.items() for text in parts]

    async def search(self, query: Query) -> list[Passage]:
        return await asyncio.to_thread(self._search, query)

    def _search(self, query: Query) -> list[Passage]:
        # The session's patients are its own, so the group is not a search word here.
        ranked = bm25.rank([query.question, *query.keywords], [passage.text for passage in self.passages])
        hits = [index for index, _ in ranked[:SESSION_PASSAGES]]
        chosen = sorted({
            near for index in hits for near in (index - 1, index, index + 1)
            if 0 <= near < len(self.passages) and self.passages[near].title == self.passages[index].title
        })
        # In reading order, not best first: the answer numbers sources by document, so order carries no rank.
        runs: list[list[int]] = []
        for index in chosen:
            if runs and runs[-1][-1] == index - 1 and self.passages[index].title == self.passages[index - 1].title:
                runs[-1].append(index)
            else:
                runs.append([index])
        return [
            Passage('session', self.passages[run[0]].title, ' '.join(self.passages[i].text for i in run))
            for run in runs
        ]


class _Ncbi:
    name: str
    kind: SourceKind
    count: int
    statpearls: bool

    async def search(self, query: Query) -> list[Passage]:
        ids = await ncbi.find_for_answer(query.terms, self.count, statpearls=self.statpearls)
        candidates = [
            Passage(self.kind, abstract.title, text, abstract.url, abstract.detail)
            for abstract in await ncbi.abstracts(ids)
            for text in cut(abstract.text)
        ]
        return _best(query, candidates, LITERATURE_PASSAGES, PER_DOCUMENT)


class PubMed(_Ncbi):
    name = 'PubMed'
    kind = 'pubmed'
    count = ARTICLES
    statpearls = False


class StatPearls(_Ncbi):
    name = 'StatPearls'
    kind = 'statpearls'
    count = CHAPTERS
    statpearls = True


LITERATURE: list[Source] = [PubMed(), StatPearls()]
