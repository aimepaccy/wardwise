"""Photos made ready for reading. Files come from strangers, so the reader has limits."""

import io
from pathlib import Path

from PIL import Image, ImageOps

# A small file can claim to be a huge picture (an "image bomb"); the size is read before any pixels are.
MAX_PHOTO_PIXELS = 25_000_000
# Enough to read handwriting, and small enough for the AI service's limit on images.
PHOTO_LONG_SIDE = 2048


class UnreadableFile(Exception):
    pass


def photo_for_reading(path: Path) -> bytes:
    """A smaller JPEG copy, turned the right way up. Saving a new copy also drops what the camera
    stored inside the photo, such as the place and time it was taken."""
    try:
        with Image.open(path) as photo:
            if photo.width * photo.height > MAX_PHOTO_PIXELS:
                raise UnreadableFile
            # Shrink first (a JPEG can be decoded at a reduced size), so a huge photo never sits in memory.
            photo.draft('RGB', (PHOTO_LONG_SIDE, PHOTO_LONG_SIDE))
            photo.thumbnail((PHOTO_LONG_SIDE, PHOTO_LONG_SIDE))
            upright = ImageOps.exif_transpose(photo).convert('RGBA')
            # Clear areas become white paper, not black, which would hide dark ink.
            page = Image.new('RGB', upright.size, 'white')
            page.paste(upright, mask=upright.getchannel('A'))
            out = io.BytesIO()
            page.save(out, 'JPEG', quality=85)
            return out.getvalue()
    except UnreadableFile:
        raise
    except Exception as error:
        raise UnreadableFile from error

