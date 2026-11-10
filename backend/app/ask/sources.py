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
    """The passages that best match the question's words, at most `per_document` from any one title."""
    ranked = bm25.rank([query.question, *query.keywords], [passage.text for passage in candidates])
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
    """The student's own recording and notes, sent by the browser with each question."""

    name = 'Your session'

    def __init__(self, notes: str, transcript: str | None):
        self.passages = [Passage('session', 'Your notes', text) for text in cut(notes)] + [
            Passage('session', 'Your recording', text) for text in cut(transcript or '')
        ]

    async def search(self, query: Query) -> list[Passage]:
        return await asyncio.to_thread(_best, query, self.passages, SESSION_PASSAGES)


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
