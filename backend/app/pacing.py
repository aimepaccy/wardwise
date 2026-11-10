"""Keeping to the provider's allowance of tokens per minute, one model at a time.

A free tier refuses a call that would take the last minute over its allowance. Rather than be refused and
retry blindly, WardWise keeps its own count of what it sent in the last 60 seconds (a sliding window) and
waits, before a call, until there is room. It counts for itself instead of reading a provider's headers,
so it works the same with any provider.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable

# A rough rule for English: about 4 characters per token. Medical words cost a little more, so we round down.
CHARS_PER_TOKEN = 3.5
WINDOW_SECONDS = 60
# While waiting, the student is told how long is left every few seconds.
UPDATE_EVERY_SECONDS = 5


def estimate_tokens(text: str) -> int:
    return round(len(text) / CHARS_PER_TOKEN)


class TokenWindow:
    """What one model was sent in the last minute, and how long until there is room for more."""

    def __init__(self, per_minute: int, clock=time.monotonic, sleep=time.sleep):
        self.per_minute = per_minute
        self._clock = clock
        self._sleep = sleep
        self._sent: deque[tuple[float, int]] = deque()
        # Jobs run on worker threads, so two students' calls take turns to read and change the count.
        self._lock = threading.Lock()

    def reserve(self, tokens: int, on_wait: Callable[[int], None] | None = None) -> None:
        """Return once `tokens` fit in the last minute's allowance, counting them as sent.
        `on_wait` hears the seconds left while waiting, then 0 when the wait is over."""
        # A call larger than the whole allowance can never fit; it goes alone, once the minute is clear.
        tokens = min(tokens, self.per_minute)
        waited = False
        while True:
            with self._lock:
                delay = self._delay(tokens)
                if delay == 0:
                    self._sent.append((self._clock(), tokens))
                    break
            waited = True
            if on_wait:
                on_wait(math.ceil(delay))
            self._sleep(min(delay, UPDATE_EVERY_SECONDS))
        if waited and on_wait:
            on_wait(0)

    def _delay(self, tokens: int) -> float:
        """Seconds until `tokens` fit: 0 if they fit now."""
        now = self._clock()
        while self._sent and self._sent[0][0] <= now - WINDOW_SECONDS:
            self._sent.popleft()
        in_use = sum(sent for _, sent in self._sent)
        if in_use + tokens <= self.per_minute:
            return 0
        # The oldest calls leave the window first: wait until enough of them have gone.
        for at, sent in self._sent:
            in_use -= sent
            if in_use + tokens <= self.per_minute:
                return at + WINDOW_SECONDS - now
        return 0  # not reached: once every call has left, any reservation fits


_windows: dict[str, TokenWindow] = {}
_windows_lock = threading.Lock()


def reserve(model: str, per_minute: int, tokens: int, on_wait: Callable[[int], None] | None = None) -> None:
    """Wait for room in `model`'s allowance. One window per model: each has its own allowance."""
    with _windows_lock:
        window = _windows.get(model)
        if window is None or window.per_minute != per_minute:
            window = _windows[model] = TokenWindow(per_minute)
    window.reserve(tokens, on_wait)
