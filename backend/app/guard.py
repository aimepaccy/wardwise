"""The door to the API: the access code, limits per address, and a cap on work in progress.

It runs as middleware, before FastAPI reads the request body, so a stranger without the code is turned away
before uploading anything, and a refused request costs the server almost nothing.
"""

import hmac
import math
import threading
import time
from collections import deque

from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app import jobs

ACCESS_HEADER = b'x-access-code'
# Anyone may ask whether the server is up, and what its limits are (including whether a code is needed).
OPEN_PATHS = {'/api/health', '/api/limits'}
# Requests that start AI work: each counts towards the hourly limit and the cap on jobs in progress.
JOB_PATHS = {'/api/sessions', '/api/packs', '/api/quizzes', '/api/highlights', '/api/ask'}
READING_PATH = '/api/reading'
# Wrong codes allowed per address before it must wait, so the code cannot be guessed by trying many.
MAX_WRONG_CODES = 10
WRONG_CODE_WINDOW_SECONDS = 15 * 60
HOUR = 60 * 60


class SlidingWindow:
    """How many times each address did something in the last `seconds`, and how long until it may again."""

    def __init__(self, limit: int, seconds: float, clock=time.monotonic):
        self.limit = limit
        self.seconds = seconds
        self._clock = clock
        self._times: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def wait(self, key: str) -> float:
        """Seconds until `key` may act again: 0 if it may now. A limit of 0 means no limit."""
        if self.limit <= 0:
            return 0
        with self._lock:
            # Looking does not add the address to the table; only `add` does, and it also tidies the table.
            if key not in self._times:
                return 0
            times = self._recent(key)
            if len(times) < self.limit:
                return 0
            return times[0] + self.seconds - self._clock()

    def add(self, key: str) -> None:
        with self._lock:
            self._recent(key).append(self._clock())
            if len(self._times) > 10_000:
                self._forget_quiet()

    def _recent(self, key: str) -> deque[float]:
        times = self._times.setdefault(key, deque())
        cutoff = self._clock() - self.seconds
        while times and times[0] <= cutoff:
            times.popleft()
        return times

    def _forget_quiet(self) -> None:
        """Drop addresses with nothing in the window, so the table cannot grow without end."""
        cutoff = self._clock() - self.seconds
        for key in [key for key, times in self._times.items() if not times or times[-1] <= cutoff]:
            del self._times[key]


class Guard:
    def __init__(
        self,
        app: ASGIApp,
        access_code: str = '',
        jobs_per_hour: int = 0,
        reading_per_hour: int = 0,
        max_active_jobs: int = 0,
        clock=time.monotonic,
    ) -> None:
        self.app = app
        self.access_code = access_code.encode()
        self.jobs = SlidingWindow(jobs_per_hour, HOUR, clock)
        self.reading = SlidingWindow(reading_per_hour, HOUR, clock)
        self.wrong_codes = SlidingWindow(MAX_WRONG_CODES, WRONG_CODE_WINDOW_SECONDS, clock)
        self.max_active_jobs = max_active_jobs

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # The path the routes see: without the prefix a proxy may add (root_path), so the two can never disagree.
        path = scope.get('path', '')
        root = scope.get('root_path', '')
        if root and path.startswith(root):
            path = path[len(root) :]
        if scope['type'] != 'http' or scope['method'] == 'OPTIONS' or not path.startswith('/api/') or path in OPEN_PATHS:
            await self.app(scope, receive, send)
            return

        refusal = self._check(scope, path)
        if refusal is not None:
            await refusal(scope, receive, send)
            return
        await self.app(scope, receive, send)

    def _check(self, scope: Scope, path: str) -> JSONResponse | None:
        address = client_address(scope)

        if self.access_code:
            wait = self.wrong_codes.wait(address)
            if wait:
                return _too_many(f'Too many wrong codes. Please try again in {_minutes(wait)}.', wait)
            given = dict(scope['headers']).get(ACCESS_HEADER)
            if given is None:
                return JSONResponse({'detail': 'Enter the access code to use WardWise.'}, status_code=401)
            # Compared in constant time, so how long the check takes gives nothing away about the code.
            if not hmac.compare_digest(given, self.access_code):
                self.wrong_codes.add(address)
                return JSONResponse({'detail': 'That access code is not right.'}, status_code=401)

        if scope['method'] == 'POST' and path in JOB_PATHS:
            if self.max_active_jobs and jobs.active() >= self.max_active_jobs:
                return _too_many("WardWise is busy with other students' work. Please try again in a minute.", 60)
            return self._count(self.jobs, address, 'You have reached the limit for this hour.')
        if path == READING_PATH:
            return self._count(self.reading, address, 'You have looked up a lot of reading this hour.')
        return None

    def _count(self, window: SlidingWindow, address: str, reason: str) -> JSONResponse | None:
        wait = window.wait(address)
        if wait:
            return _too_many(f'{reason} Please try again in {_minutes(wait)}.', wait)
        window.add(address)
        return None


def client_address(scope: Scope) -> str:
    # Behind a hosting provider's proxy this is the proxy's address, not the student's; the server must then be
    # started so it reads the real one from the proxy's headers, trusting only the host's own hop (build item 7b).
    client = scope.get('client')
    return client[0] if client else 'unknown'


def _too_many(message: str, wait: float) -> JSONResponse:
    # Retry-After tells any client, in a standard way, how many seconds to wait.
    return JSONResponse({'detail': message}, status_code=429, headers={'Retry-After': str(math.ceil(wait))})


def _minutes(seconds: float) -> str:
    minutes = max(1, math.ceil(seconds / 60))
    return 'a minute' if minutes == 1 else f'{minutes} minutes'
