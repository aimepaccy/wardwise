"""BM25, the classic formula for ranking passages by how well they match a set of search words.

A passage scores for each search word it contains. Rare words count for more than common ones (inverse
document frequency), repeating a word helps less each time (saturation, set by K1), and long passages are
held back so they do not win just by having more words (length normalisation, set by B).
"""

import math
import re
from collections import Counter

K1 = 1.5
B = 0.75

_WORD = re.compile(r'\w+')
# Words too common to tell passages apart.
_STOP = frozenset(
    'a an and are as at be but by can did do does for from had has have he her his how i if in into is it its '
    'me my no not of on or our she so than that the their them then there these they this to was we were what '
    'when where which who why will with would you your'.split()
)


def words(text: str) -> list[str]:
    """Lower case, without common words, and with a plural "s" taken off, so "nebulisers" finds "nebuliser"."""
    result = []
    for word in _WORD.findall(text.casefold()):
        if word in _STOP:
            continue
        if len(word) > 3 and word.endswith('s') and not word.endswith('ss'):
            word = word[:-1]
        result.append(word)
    return result


def rank(query: list[str], passages: list[str]) -> list[tuple[int, float]]:
    """Each passage's index and score, best first. Passages that match no search word are left out."""
    terms = set(words(' '.join(query)))
    counted = [Counter(words(passage)) for passage in passages]
    if not terms or not counted:
        return []
    average = sum(sum(counts.values()) for counts in counted) / len(counted) or 1
    found_in = {term: sum(1 for counts in counted if term in counts) for term in terms}

    scores = []
    for index, counts in enumerate(counted):
        length = sum(counts.values())
        score = 0.0
        for term in terms:
            times = counts.get(term, 0)
            if not times:
                continue
            rarity = math.log((len(counted) - found_in[term] + 0.5) / (found_in[term] + 0.5) + 1)
            score += rarity * times * (K1 + 1) / (times + K1 * (1 - B + B * length / average))
        if score > 0:
            scores.append((index, score))
    return sorted(scores, key=lambda pair: pair[1], reverse=True)
