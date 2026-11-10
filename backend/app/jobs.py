"""Background jobs: answer at once with a job number, do the slow work afterwards.

Jobs and their results live only in this server's memory, and only until the browser
collects them (or 15 minutes, if it never does).
"""

import logging
import secrets
import shutil
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from app import extract, generate, providers
from app.schemas import AudioKind, JobState, Materials, PackRequest

RESULT_TTL_SECONDS = 15 * 60
# Every job's uploads live under this one folder, so leftovers can be found and removed.
JOBS_ROOT = Path(tempfile.gettempdir()) / 'wardwise-jobs'

log = logging.getLogger('wardwise.jobs')


@dataclass
class PhotoInput:
    path: Path
    name: str


@dataclass
class JobInput:
    folder: Path
    audio: Path | None = None
    audio_kind: AudioKind | None = None
    photos: list[PhotoInput] = field(default_factory=list)


@dataclass
class Job:
    state: JobState
    created: float = field(default_factory=time.monotonic)


_jobs: dict[str, Job] = {}
# Jobs run on worker threads, so reads and writes to the shared dictionary take turns.
_lock = threading.Lock()


def new_folder() -> Path:
    JOBS_ROOT.mkdir(exist_ok=True)
    return Path(tempfile.mkdtemp(dir=JOBS_ROOT))


def sweep_folders(older_than_seconds: float = 0) -> None:
    """Delete job folders left behind, for example by a crash or a restart in the middle of a job."""
    if not JOBS_ROOT.exists():
        return
    cutoff = time.time() - older_than_seconds
    for folder in JOBS_ROOT.iterdir():
        if folder.stat().st_mtime <= cutoff:
            shutil.rmtree(folder, ignore_errors=True)


def create() -> str:
    _forget_old()
    job_id = secrets.token_hex(16)
    with _lock:
        _jobs[job_id] = Job(JobState(status='queued', step='Waiting to start'))
    return job_id


def get(job_id: str) -> JobState | None:
    _forget_old()
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        # A finished job is handed over once and then forgotten.
        if job.state.status in ('done', 'failed'):
            del _jobs[job_id]
        return job.state.model_copy()


def _update(job_id: str, **changes) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if job:
            job.state = job.state.model_copy(update=changes)


def _forget_old() -> None:
    cutoff = time.monotonic() - RESULT_TTL_SECONDS
    with _lock:
        for job_id in [job_id for job_id, job in _jobs.items() if job.created < cutoff]:
            del _jobs[job_id]
    sweep_folders(older_than_seconds=RESULT_TTL_SECONDS)


def _read_photos(photos: list[PhotoInput], warnings: list[str]) -> str | None:
    pages = []
    for photo in photos:
        try:
            jpeg = extract.photo_for_reading(photo.path)
        except extract.UnreadableFile:
            warnings.append(f'{photo.name} could not be read as a photo.')
            continue
        # A busy or unreachable service still fails the job; a turned-down photo only warns.
        try:
            text = providers.read_handwriting(jpeg)
        except providers.PhotoCutShort:
            warnings.append(f'{photo.name} has too much writing to read at once. Try half a page per photo.')
            continue
        except providers.UnreadablePhoto:
            warnings.append(f'WardWise could not read {photo.name}. Try a clearer photo.')
            continue
        if text:
            pages.append(text)
        else:
            warnings.append(f'WardWise found no handwriting in {photo.name}.')
    return '\n\n'.join(pages) if pages else None


def run(job_id: str, work: JobInput) -> None:
    started = time.monotonic()
    try:
        warnings: list[str] = []
        notes = None
        if work.photos:
            _update(job_id, status='working', step='Reading your handwritten notes')
            notes = _read_photos(work.photos, warnings)

        transcript = None
        if work.audio is not None and work.audio_kind is not None:
            _update(job_id, status='working', step='Transcribing the recording')
            transcript = providers.transcribe(work.audio, work.audio_kind)
            if not transcript:
                warnings.append('No speech was heard in the recording.')

        materials = Materials(transcript=transcript, notes=notes, warnings=warnings)
        _update(job_id, status='done', step='Done', materials=materials)
    except Exception as error:
        _fail(job_id, error, 'Something went wrong while reading your material.')
    finally:
        shutil.rmtree(work.folder, ignore_errors=True)
        log.info('Job %s finished in %.1f s', job_id, time.monotonic() - started)


def write(job_id: str, request: PackRequest) -> None:
    started = time.monotonic()
    try:
        _update(job_id, status='working', step='Writing your study pack')
        pack = generate.write_pack(request)
        _update(job_id, status='done', step='Done', pack=pack)
    except Exception as error:
        _fail(job_id, error, 'Something went wrong while writing your study pack.')
    finally:
        log.info('Job %s finished in %.1f s', job_id, time.monotonic() - started)


def _fail(job_id: str, error: Exception, fallback: str) -> None:
    if isinstance(error, providers.ProviderError):
        # For the operator: what kind of failure, never the student's material.
        # The error code is safe to log; the response body is not (it can echo the student's material).
        cause = error.__cause__
        while isinstance(cause, providers.ProviderError) and cause.__cause__ is not None:
            cause = cause.__cause__
        status = getattr(cause, 'status_code', '-')
        code = getattr(cause, 'code', '-')
        log.warning('Job %s: provider failed (%s, status %s, code %s)', job_id, type(cause).__name__, status, code)
        _update(job_id, status='failed', step='Failed', error=str(error))
    else:
        log.error('Job %s failed', job_id, exc_info=error)
        _update(job_id, status='failed', step='Failed', error=fallback)
