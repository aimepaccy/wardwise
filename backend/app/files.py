from pathlib import PurePath

from fastapi import UploadFile

from app.schemas import AudioKind, PhotoKind

# 25 MB is the long-standing direct-upload limit for Whisper; Groq lists larger limits only for paid plans.
MAX_AUDIO_MB = 25
MAX_AUDIO_BYTES = MAX_AUDIO_MB * 1024 * 1024

# Photos of handwritten notes, a few pages each. Phone cameras rarely go above 15 MB.
MAX_PHOTOS = 5
MAX_PHOTO_MB = 15
MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024


def detect_audio_kind(upload: UploadFile) -> AudioKind | None:
    """Identify the audio container by its opening bytes. All of these are formats Whisper accepts."""
    upload.file.seek(0)
    start = upload.file.read(12)
    upload.file.seek(0)

    if start.startswith(b'\x1a\x45\xdf\xa3'):
        return 'webm'
    if start.startswith(b'OggS'):
        return 'ogg'
    if start[4:8] == b'ftyp':
        return 'mp4'
    if start.startswith(b'RIFF') and start[8:12] == b'WAVE':
        return 'wav'
    if start.startswith(b'fLaC'):
        return 'flac'
    # MP3: either a tag block first, or straight into an audio frame (11 bits set).
    if start.startswith(b'ID3') or (len(start) > 1 and start[0] == 0xFF and start[1] & 0xE0 == 0xE0):
        return 'mp3'
    return None


def detect_photo_kind(upload: UploadFile) -> PhotoKind | None:
    """Identify a photo by its opening bytes. iPhones send JPEG when a photo is chosen in the browser."""
    upload.file.seek(0)
    start = upload.file.read(12)
    upload.file.seek(0)

    if start.startswith(b'\xff\xd8\xff'):
        return 'jpeg'
    if start.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if start.startswith(b'RIFF') and start[8:12] == b'WEBP':
        return 'webp'
    return None


def display_name(upload: UploadFile) -> str:
    # Used only for showing back to the user, never to build a path on disk.
    name = PurePath((upload.filename or 'file').replace('\\', '/')).name
    return name[:200] or 'file'
