import shutil
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile
from fastapi import Path as PathParam

from app import generate, jobs, reading
from app.files import (
    MAX_AUDIO_BYTES,
    MAX_AUDIO_MB,
    MAX_PHOTO_BYTES,
    MAX_PHOTO_MB,
    MAX_PHOTOS,
    detect_audio_kind,
    detect_photo_kind,
    display_name,
)
from app.schemas import (
    AudioReceipt,
    Health,
    JobCreated,
    JobState,
    Limits,
    PackJobCreated,
    PackRequest,
    PhotoReceipt,
    Reading,
    SessionReceipt,
)

router = APIRouter(prefix='/api')


@router.get('/health')
def health() -> Health:
    return Health(status='ok')


@router.get('/limits')
def limits() -> Limits:
    return Limits(
        max_audio_mb=MAX_AUDIO_MB,
        max_photos=MAX_PHOTOS,
        max_photo_mb=MAX_PHOTO_MB,
        max_pack_words=generate.allowed_words(),
        max_pack_chars=generate.allowed_chars(),
    )


@router.post('/sessions', status_code=202)
def receive_session(
    background: BackgroundTasks,
    audio: Annotated[UploadFile | None, File()] = None,
    photos: Annotated[list[UploadFile] | None, File()] = None,
) -> JobCreated:
    photos = photos or []

    if audio is None and not photos:
        raise HTTPException(status_code=422, detail='Add a recording or photos of your notes to send.')
    if len(photos) > MAX_PHOTOS:
        raise HTTPException(status_code=422, detail=f'You can send up to {MAX_PHOTOS} photos of notes.')

    audio_receipt = None
    if audio is not None:
        name = display_name(audio)
        size = audio.size or 0
        if size > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail=f'{name} is larger than {MAX_AUDIO_MB} MB.')
        kind = detect_audio_kind(audio)
        if kind is None:
            raise HTTPException(status_code=415, detail=f'{name} is not an audio format WardWise can read.')
        audio_receipt = AudioReceipt(name=name, kind=kind, size_bytes=size)

    photo_receipts = []
    for upload in photos:
        name = display_name(upload)
        size = upload.size or 0
        if size > MAX_PHOTO_BYTES:
            raise HTTPException(status_code=413, detail=f'{name} is larger than {MAX_PHOTO_MB} MB.')
        kind = detect_photo_kind(upload)
        if kind is None:
            raise HTTPException(status_code=415, detail=f'{name} is not a JPEG, PNG or WebP photo.')
        photo_receipts.append(PhotoReceipt(name=name, kind=kind, size_bytes=size))

    # FastAPI deletes the uploads when this request ends, so the job gets its own copies,
    # under generic names, in a private folder that the job deletes when it finishes.
    folder = jobs.new_folder()
    try:
        work = jobs.JobInput(folder=folder)
        if audio is not None and audio_receipt is not None:
            work.audio = _save(audio, folder / f'audio.{audio_receipt.kind}')
            work.audio_kind = audio_receipt.kind
        for number, (upload, receipt) in enumerate(zip(photos, photo_receipts)):
            path = _save(upload, folder / f'photo-{number}.{receipt.kind}')
            work.photos.append(jobs.PhotoInput(path=path, name=receipt.name))
        job_id = jobs.create()
        background.add_task(jobs.run, job_id, work)
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    receipt = SessionReceipt(audio=audio_receipt, photos=photo_receipts)
    return JobCreated(job_id=job_id, receipt=receipt)


@router.post('/packs', status_code=202)
def write_pack(request: PackRequest, background: BackgroundTasks) -> PackJobCreated:
    material = generate.assemble(request)
    if not material:
        raise HTTPException(status_code=422, detail='There is nothing to write a study pack from yet.')
    try:
        generate.check_budget(material)
    except generate.MaterialTooLong as error:
        present = [
            name
            for name, there in (
                ('your notes', request.notes.strip()),
                ('the transcript', request.transcript and request.transcript.strip()),
            )
            if there
        ]
        advice = present[0] if len(present) == 1 else ', '.join(present[:-1]) + ' or ' + present[-1]
        raise HTTPException(
            status_code=413,
            detail=(
                f'Your material is about {error.words:,} words, and WardWise can write from about '
                f'{error.allowed_words:,} at a time. Shorten {advice}.'
            ),
        ) from error
    job_id = jobs.create()
    background.add_task(jobs.write, job_id, request)
    return PackJobCreated(job_id=job_id)


# A GET, because it only reads: nothing changes on the server, and the same term always means the same request.
# It is `async` because it spends its time waiting on other services, and while it waits the server serves others.
@router.get('/reading')
async def further_reading(term: Annotated[str, Query(max_length=reading.MAX_TERM_CHARS)]) -> Reading:
    cleaned = reading.clean_term(term)
    if len(cleaned) < 2:
        raise HTTPException(status_code=422, detail='Give a search term of at least two letters.')
    return await reading.find(cleaned)


@router.get('/jobs/{job_id}')
def job_state(job_id: Annotated[str, PathParam(pattern='^[0-9a-f]{32}$')]) -> JobState:
    state = jobs.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail='This job has finished and its results were cleared, or it never existed.')
    return state


def _save(upload: UploadFile, destination: Path) -> Path:
    upload.file.seek(0)
    with destination.open('wb') as out:
        shutil.copyfileobj(upload.file, out)
    return destination
