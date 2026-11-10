"""PubMed articles and StatPearls chapters, both from NCBI's E-utilities.

Each lookup is two calls: esearch finds the ids, esummary gives titles and details for those ids.
For "Ask about my session", efetch gives the abstracts themselves. Every StatPearls chapter is also in
PubMed, with a short clinical summary of the chapter as its abstract, so one call serves both sources.
"""

import html
import re
from dataclasses import dataclass
from datetime import date

from app.config import get_settings
from app.reading import web
from app.schemas import ReadingLink

EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
MAX_ARTICLES = 3
MAX_CHAPTERS = 3
RETRY_STATUSES = {429, 500, 502, 503, 504}
RECENT_YEARS = 15

_PMID = re.compile(r'^\d{1,9}$')
_NBK = re.compile(r'^NBK\d{1,9}$')
_TAG = re.compile(r'<[^>]+>')
_SEARCH_WORD = re.compile(r'[\w-]+')
# The chapter's title sits in one known tag of a small piece of XML, so a pattern is enough and no XML parser
# is needed (Python's built-in one is not meant for XML from outside sources).
_CHAPTER_TITLE = re.compile(r'type="chapter"[^>]*>\s*<Title>(.*?)</Title>', re.DOTALL)

# NCBI allows 3 requests a second without a key and 10 with one. Every call from every student waits its turn.
_spacing: web.Spacing | None = None


def _queue() -> web.Spacing:
    global _spacing
    if _spacing is None:
        _spacing = web.Spacing(10 if get_settings().ncbi_api_key.get_secret_value() else 3)
    return _spacing


async def _call(tool: str, params: dict, retmode: str):
    params = params | {'retmode': retmode, 'tool': 'wardwise'}
    key = get_settings().ncbi_api_key.get_secret_value()
    if key:
        params['api_key'] = key
    # NCBI now and then turns a call away (429) or fails (5xx) under load; one more try, in the queue again, usually works.
    for attempt in range(2):
        await _queue().wait()
        response = await web.client().get(f'{EUTILS}/{tool}', params=params)
        if response.status_code not in RETRY_STATUSES or attempt:
            break
    response.raise_for_status()
    return response


async def _get(tool: str, params: dict) -> dict:
    return (await _call(tool, params, 'json')).json()


async def _search(database: str, query: str, count: int) -> list[str]:
    found = await _get('esearch.fcgi', {'db': database, 'term': query, 'retmax': count, 'sort': 'relevance'})
    return found['esearchresult']['idlist']


async def _summaries(database: str, ids: list[str]) -> list[dict]:
    found = (await _get('esummary.fcgi', {'db': database, 'id': ','.join(ids)}))['result']
    return [found[uid] for uid in found.get('uids', []) if uid in found]


def _tagged(term: str, field: str) -> str:
    """Each word tied to a field, as in "peak[ti] AND flow[ti]".

    Left untagged, NCBI guesses what each word is (automatic term mapping) and guesses badly:
    it read "peak" as an author's name and "flow" as the journal Flow.
    """
    return ' AND '.join(f'{word}[{field}]' for word in _SEARCH_WORD.findall(term))


def _plain(text: str) -> str:
    """Titles can carry HTML such as <i>; React would show the tags as text, so they go."""
    return html.unescape(_TAG.sub('', text)).strip()


async def pubmed(term: str) -> list[ReadingLink]:
    # Words in the title keep articles on topic (in the abstract alone, a term is often a side point).
    # Reviews and guidelines suit a student best; if there are none, any article will do.
    in_title = _tagged(term, 'ti')
    if not in_title:
        return []
    ids = await _search('pubmed', f'{in_title} AND (review[pt] OR guideline[pt]) AND english[lang]', MAX_ARTICLES)
    if not ids:
        ids = await _search('pubmed', f'{in_title} AND english[lang]', MAX_ARTICLES)
    if not ids:
        return []

    links = []
    for article in await _summaries('pubmed', ids):
        pmid = str(article.get('uid', ''))
        title = _plain(article.get('title', ''))
        if not _PMID.match(pmid) or not title:
            continue
        year = str(article.get('pubdate', ''))[:4]
        kinds = article.get('pubtype', [])
        kind = next((k for k in ('Practice Guideline', 'Guideline', 'Systematic Review', 'Review') if k in kinds), '')
        detail = ', '.join(part for part in (article.get('fulljournalname', ''), year) if part)
        links.append(ReadingLink(
            title=title,
            url=f'https://pubmed.ncbi.nlm.nih.gov/{pmid}/',
            detail=f'{detail} · {kind}' if kind else detail,
        ))
    return links


async def statpearls(term: str) -> list[ReadingLink]:
    # The search returns pieces of chapters (sections, tables), so several pieces can share one chapter.
    words = _tagged(term, 'All Fields')
    if not words:
        return []
    ids = await _search('books', f'{words} AND statpearls[book]', 12)
    if not ids:
        return []

    links: list[ReadingLink] = []
    seen = set()
    for piece in await _summaries('books', ids):
        chapter = piece.get('chapteraccessionid', '')
        if not _NBK.match(chapter) or chapter in seen:
            continue
        found = _CHAPTER_TITLE.search(piece.get('bookinfo', ''))
        title = _plain(found.group(1)) if found else ''
        if not title:
            continue
        seen.add(chapter)
        links.append(ReadingLink(title=title, url=f'https://www.ncbi.nlm.nih.gov/books/{chapter}/', detail='StatPearls'))
        if len(links) == MAX_CHAPTERS:
            break
    return links


# Abstracts for "Ask about my session". efetch answers only in XML; as with chapter titles, a few known tags
# are read with patterns rather than a general XML parser.
_RECORD = re.compile(r'<(PubmedArticle|PubmedBookArticle)>(.*?)</\1>', re.DOTALL)
_RECORD_PMID = re.compile(r'<PMID[^>]*>(\d{1,9})</PMID>')
_ARTICLE_TITLE = re.compile(r'<ArticleTitle[^>]*>(.*?)</ArticleTitle>', re.DOTALL)
# Only the main abstract: an <OtherAbstract> holds translations and plain-language versions.
_ABSTRACT = re.compile(r'<Abstract>(.*?)</Abstract>', re.DOTALL)
_ABSTRACT_TEXT = re.compile(r'<AbstractText([^>]*)>(.*?)</AbstractText>', re.DOTALL)
# A superscript kept as "^", so 10<sup>9</sup>/L does not become 109/L.
_SUPERSCRIPT = re.compile(r'<sup>(.*?)</sup>', re.DOTALL)
_LABEL = re.compile(r'Label="([^"]*)"')
_BOOK_ID = re.compile(r'<ArticleId IdType="bookaccession">(NBK\d{1,9})</ArticleId>')
_JOURNAL = re.compile(r'<Journal>.*?<Title>(.*?)</Title>', re.DOTALL)
# Only inside PubDate: some give a MedlineDate there instead, and a later Year belongs to another date.
_YEAR = re.compile(r'<PubDate>(?:(?!</PubDate>).)*?<Year>(\d{4})</Year>', re.DOTALL)
MAX_ABSTRACT_CHARS = 6000


@dataclass
class Abstract:
    pmid: str
    title: str
    text: str
    url: str
    detail: str


async def find_for_answer(terms: list[str], count: int, *, statpearls: bool) -> list[str]:
    """PubMed ids for a question's search terms, most specific term first: each later term only fills the
    places left. (Joined with OR, a broad term crowded out the specific one.) Every word of a term must be in
    the title or abstract. StatPearls chapters are kept apart, so the two sources never repeat each other.
    For PubMed, recent reviews and guidelines come first."""
    ids: list[str] = []
    for index, term in enumerate(terms):
        words = _tagged(term, 'tiab')
        if not words or len(ids) >= count:
            continue
        if statpearls:
            found = await _search('pubmed', f'{words} AND statpearls[book]', count)
        else:
            # Doses and advice change, so recent reviews come first, then any recent article, then any at all.
            # Only the most specific term gets every step, so one question makes at most five searches here:
            # the NCBI queue (3 a second) is shared by every student and by Further reading.
            query = f'{words} AND english[lang] NOT statpearls[book]'
            recent = f'{query} AND ("{date.today().year - RECENT_YEARS}"[dp] : "3000"[dp])'
            steps = (f'{recent} AND (review[pt] OR guideline[pt])', recent, query) if index == 0 else (recent,)
            for attempt in steps:
                found = await _search('pubmed', attempt, count)
                if found:
                    break
        ids += [pmid for pmid in found if pmid not in ids][: count - len(ids)]
    return ids


async def abstracts(ids: list[str]) -> list[Abstract]:
    ids = [pmid for pmid in ids if _PMID.match(pmid)]
    if not ids:
        return []
    found = (await _call('efetch.fcgi', {'db': 'pubmed', 'id': ','.join(ids)}, 'xml')).text
    return [abstract for abstract in (_abstract(match.group(2)) for match in _RECORD.finditer(found)) if abstract]


def _abstract(record: str) -> Abstract | None:
    # A chapter lists its references, with their own ids, after its abstract; only the part before them is read.
    record = record.split('<ReferenceList', 1)[0]
    pmid = _RECORD_PMID.search(record)
    title = _ARTICLE_TITLE.search(record)
    abstract = _ABSTRACT.search(record)
    parts = []
    for attributes, text in _ABSTRACT_TEXT.findall(abstract.group(1) if abstract else ''):
        label = _LABEL.search(attributes)
        text = _plain(_SUPERSCRIPT.sub(r'^\1', text))
        parts.append(f'{label.group(1).title()}: {text}' if label and text else text)
    text = ' '.join(part for part in parts if part)[:MAX_ABSTRACT_CHARS]
    if not pmid or not title or not text:
        return None
    pmid = pmid.group(1)
    book = _BOOK_ID.search(record)
    if book:
        return Abstract(pmid, _plain(title.group(1)), text, f'https://www.ncbi.nlm.nih.gov/books/{book.group(1)}/', 'StatPearls')
    journal = _JOURNAL.search(record)
    year = _YEAR.search(record)
    detail = ', '.join(_plain(found.group(1)) for found in (journal, year) if found)
    return Abstract(pmid, _plain(title.group(1)), text, f'https://pubmed.ncbi.nlm.nih.gov/{pmid}/', detail)
