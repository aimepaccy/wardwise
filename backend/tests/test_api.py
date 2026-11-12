import io

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app import extract, jobs, providers
from app.limits import BodySizeLimit
from app.main import app
from tests.conftest import FAKE_HANDWRITING, FAKE_TRANSCRIPT

client = TestClient(app)

PDF = b'%PDF-1.7\n%fake but correctly signed\n'
WEBM = b'\x1a\x45\xdf\xa3' + bytes(40)
M4A = b'\x00\x00\x00\x20ftypM4A ' + bytes(40)
WAV = b'RIFF\x24\x00\x00\x00WAVEfmt ' + bytes(40)
OGG = b'OggS' + bytes(40)
FLAC = b'fLaC' + bytes(40)
MP3_TAGGED = b'ID3\x04' + bytes(40)
MP3_FRAME = b'\xff\xfb\x90\x64' + bytes(40)


def photo(kind: str = 'JPEG', size: tuple[int, int] = (40, 30), exif: Image.Exif | None = None) -> bytes:
    buffer = io.BytesIO()
    Image.new('RGB', size, 'white').save(buffer, kind, **({'exif': exif} if exif else {}))
    return buffer.getvalue()


def post(audio: tuple[str, bytes] | None = None, photos: list[tuple[str, bytes]] | None = None):
    parts = [('audio', audio)] if audio else []
    parts += [('photos', (name, content)) for name, content in photos or []]
    return client.post('/api/sessions', files=parts or None)


def receipt_of(response):
    assert response.status_code == 202
    return response.json()['receipt']


# The test client runs background jobs before it returns, so the job is already finished here.
def finished_job(response):
    state = client.get(f"/api/jobs/{response.json()['job_id']}").json()
    assert state['status'] in ('done', 'failed')
    return state


def test_health():
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_limits():
    assert client.get('/api/limits').json() == {
        'max_audio_mb': 25,
        'max_photos': 5,
        'max_photo_mb': 15,
        # About 85 to 90 minutes of talk, condensed first; up to about 12 minutes, written in one go.
        'max_pack_words': 11491,
        'max_pack_chars': 68950,
        'quick_pack_chars': 9700,
    }


def test_receipt_for_audio_and_photos():
    shot = photo()
    assert receipt_of(post(audio=('rec.webm', WEBM), photos=[('page.jpg', shot)])) == {
        'audio': {'name': 'rec.webm', 'kind': 'webm', 'size_bytes': len(WEBM)},
        'photos': [{'name': 'page.jpg', 'kind': 'jpeg', 'size_bytes': len(shot)}],
    }


def test_photo_formats_are_accepted():
    shots = [('page.jpg', photo('JPEG')), ('page.png', photo('PNG')), ('page.webp', photo('WEBP'))]
    receipt = receipt_of(post(photos=shots))
    assert [entry['kind'] for entry in receipt['photos']] == ['jpeg', 'png', 'webp']


def test_renamed_photo_is_rejected():
    assert post(photos=[('notes.jpg', PDF)]).status_code == 415


def test_too_many_photos():
    assert post(photos=[(f'page-{n}.jpg', photo()) for n in range(6)]).status_code == 422


def test_photo_over_15_mb():
    assert post(photos=[('huge.jpg', photo() + bytes(15 * 1024 * 1024))]).status_code == 413


def test_job_reads_handwritten_notes_in_order(fake_read_handwriting):
    state = finished_job(post(photos=[('page-1.png', photo('PNG')), ('page-2.jpg', photo())]))
    assert state['status'] == 'done'
    assert state['materials']['notes'] == f'{FAKE_HANDWRITING}\n\n{FAKE_HANDWRITING}'
    # Every photo reaches the vision model as a JPEG, whatever it was sent as.
    assert all(jpeg.startswith(b'\xff\xd8\xff') for jpeg in fake_read_handwriting)


def test_photos_are_made_smaller_and_lose_their_metadata(fake_read_handwriting):
    exif = Image.Exif()
    exif[0x010F] = 'Phone maker'  # Camera make; GPS position lives in the same block.
    finished_job(post(photos=[('big.jpg', photo(size=(4000, 3000), exif=exif))]))
    sent = Image.open(io.BytesIO(fake_read_handwriting[0]))
    assert max(sent.size) == 2048
    assert len(sent.getexif()) == 0


def test_photo_without_handwriting_gets_a_warning(monkeypatch):
    monkeypatch.setattr(providers, 'read_handwriting', lambda jpeg: '')
    state = finished_job(post(photos=[('blank.jpg', photo())]))
    assert state['materials']['notes'] is None
    assert state['materials']['warnings'] == ['WardWise found no handwriting in blank.jpg.']


def test_a_turned_down_photo_does_not_stop_the_others(monkeypatch):
    def read(jpeg):
        if read.calls == 0:
            read.calls += 1
            raise providers.UnreadablePhoto('The photo reading service could not read this photo.')
        return FAKE_HANDWRITING

    read.calls = 0
    monkeypatch.setattr(providers, 'read_handwriting', read)
    state = finished_job(post(photos=[('blurry.jpg', photo()), ('clear.jpg', photo())]))
    assert state['status'] == 'done'
    assert state['materials']['notes'] == FAKE_HANDWRITING
    assert state['materials']['warnings'] == ['WardWise could not read blurry.jpg. Try a clearer photo.']


def test_the_agreed_word_for_no_handwriting_means_empty():
    assert providers.handwriting_from('NONE') == ''
    assert providers.handwriting_from('<think>A blank page.</think>\nNone.') == ''
    assert providers.handwriting_from('Pred 40 mg x5 days') == 'Pred 40 mg x5 days'
    # The word inside real notes is kept.
    assert providers.handwriting_from('Wheeze: none at rest') == 'Wheeze: none at rest'
    # Thinking cut off before its closing tag never reaches the notes.
    assert providers.handwriting_from('<think>The first line says') == ''


def test_a_page_cut_short_gets_its_own_warning(monkeypatch):
    def read(jpeg):
        raise providers.PhotoCutShort('The page has more writing than can be read in one go.')

    monkeypatch.setattr(providers, 'read_handwriting', read)
    state = finished_job(post(photos=[('dense.jpg', photo())]))
    assert state['status'] == 'done'
    assert state['materials']['warnings'] == [
        'dense.jpg has too much writing to read at once. Try half a page per photo.'
    ]


def test_photo_with_too_many_pixels_is_refused_before_decoding(monkeypatch, fake_read_handwriting):
    monkeypatch.setattr(extract, 'MAX_PHOTO_PIXELS', 100 * 100)
    state = finished_job(post(photos=[('huge.jpg', photo(size=(101, 100)))]))
    assert fake_read_handwriting == []
    assert state['materials']['warnings'] == ['huge.jpg could not be read as a photo.']


def test_photo_taken_sideways_is_turned_upright(fake_read_handwriting):
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: the camera was held on its side.
    finished_job(post(photos=[('sideways.jpg', photo(size=(400, 300), exif=exif))]))
    assert Image.open(io.BytesIO(fake_read_handwriting[0])).size == (300, 400)


def test_damaged_photo_gets_a_warning_not_a_failure():
    state = finished_job(post(photos=[('broken.jpg', photo()[:30])]))
    assert state['status'] == 'done'
    assert state['materials']['warnings'] == ['broken.jpg could not be read as a photo.']


def test_audio_formats_from_browsers_are_accepted():
    for name, content, kind in [
        ('rec.webm', WEBM, 'webm'),
        ('rec.m4a', M4A, 'mp4'),
        ('memo.wav', WAV, 'wav'),
        ('rec.ogg', OGG, 'ogg'),
        ('memo.flac', FLAC, 'flac'),
        ('tagged.mp3', MP3_TAGGED, 'mp3'),
        ('bare.mp3', MP3_FRAME, 'mp3'),
    ]:
        assert receipt_of(post(audio=(name, content)))['audio'] == {'name': name, 'kind': kind, 'size_bytes': len(content)}


def test_audio_only_is_enough():
    assert receipt_of(post(audio=('rec.webm', WEBM)))['photos'] == []


def test_renamed_audio_is_rejected():
    assert post(audio=('rec.webm', PDF)).status_code == 415


def test_audio_over_25_mb():
    big = WEBM + bytes(25 * 1024 * 1024)
    assert post(audio=('long.webm', big)).status_code == 413


def test_nothing_to_send():
    assert post().status_code == 422


# Slides and typed notes were removed on purpose: WardWise works from the round and handwritten notes.
def test_slides_and_typed_notes_are_not_accepted():
    slides = client.post('/api/sessions', files=[('slides', ('a.pdf', PDF))])
    typed = client.post('/api/sessions', data={'notes': 'Asthma: wheeze and cough'})
    for response in (slides, typed):
        assert response.status_code == 422
        assert response.json()['detail'] == 'Add a recording or photos of your notes to send.'

    # Sent alongside a recording, they are ignored: only the recording is read.
    response = client.post(
        '/api/sessions', data={'notes': 'typed'}, files=[('audio', ('rec.webm', WEBM)), ('slides', ('a.pdf', PDF))]
    )
    assert set(receipt_of(response)) == {'audio', 'photos'}
    assert finished_job(response)['materials']['notes'] is None


def test_request_cap_fits_the_largest_real_upload():
    from app.config import Settings
    from app.files import MAX_AUDIO_BYTES, MAX_PHOTO_BYTES, MAX_PHOTOS

    largest = MAX_AUDIO_BYTES + MAX_PHOTOS * MAX_PHOTO_BYTES
    cap = Settings.model_fields['max_request_mb'].default * 1024 * 1024
    # One MB to spare covers the multipart boundaries and headers.
    assert largest + 1024 * 1024 <= cap


def test_job_transcribes(fake_transcribe):
    state = finished_job(post(audio=('round.webm', WEBM)))
    assert state['status'] == 'done'
    assert state['materials'] == {'transcript': FAKE_TRANSCRIPT, 'notes': None, 'warnings': [], 'removed': []}


def test_audio_reaches_the_provider_under_a_generic_name(fake_transcribe):
    finished_job(post(audio=('Ward round with Dr X.webm', WEBM)))
    assert fake_transcribe == [{'kind': 'webm', 'name': 'audio.webm', 'bytes': WEBM}]


def test_transcription_failure_is_explained(monkeypatch):
    def broken(audio, kind):
        raise providers.ProviderError('The transcription service is busy. Please try again in a minute.')

    monkeypatch.setattr(providers, 'transcribe', broken)
    state = finished_job(post(audio=('rec.webm', WEBM)))
    assert state == {
        'status': 'failed',
        'step': 'Failed',
        'materials': None,
        'pack': None,
        'questions': None,
        'answer': None,
        'highlights': None,
        'error': 'The transcription service is busy. Please try again in a minute.',
    }


def test_uploads_are_deleted_when_the_job_ends(monkeypatch):
    folders = []
    original = jobs.new_folder
    monkeypatch.setattr(jobs, 'new_folder', lambda: folders.append(original()) or folders[-1])

    finished_job(post(audio=('rec.webm', WEBM), photos=[('page.jpg', photo())]))
    assert len(folders) == 1
    assert not folders[0].exists()


def test_uploads_are_deleted_when_the_job_fails(monkeypatch):
    folders = []
    original = jobs.new_folder
    monkeypatch.setattr(jobs, 'new_folder', lambda: folders.append(original()) or folders[-1])

    def broken(audio, kind):
        raise providers.ProviderError('busy')

    def crashing(audio, kind):
        raise RuntimeError('unexpected')

    for failure in (broken, crashing):
        monkeypatch.setattr(providers, 'transcribe', failure)
        assert finished_job(post(audio=('rec.webm', WEBM)))['status'] == 'failed'
    assert len(folders) == 2
    assert not any(folder.exists() for folder in folders)


def test_unexpected_errors_get_a_plain_message(monkeypatch):
    def crashing(audio, kind):
        raise RuntimeError('internal detail that must not reach the student')

    monkeypatch.setattr(providers, 'transcribe', crashing)
    assert finished_job(post(audio=('rec.webm', WEBM)))['error'] == 'Something went wrong while reading your material.'


def test_finished_results_are_forgotten_once_collected():
    job_id = post(audio=('rec.webm', WEBM)).json()['job_id']
    assert client.get(f'/api/jobs/{job_id}').status_code == 200
    assert client.get(f'/api/jobs/{job_id}').status_code == 404


def test_leftover_uploads_are_swept_at_startup():
    leftover = jobs.new_folder()
    (leftover / 'audio.webm').write_bytes(WEBM)
    with TestClient(app):
        pass
    assert not leftover.exists()


def test_transcription_can_use_its_own_provider():
    from app.config import Settings

    shared = Settings(llm_base_url='https://llm.example/v1', llm_api_key='llm-key')
    assert shared.transcription_provider == ('https://llm.example/v1', 'llm-key')
    separate = Settings(
        llm_base_url='https://llm.example/v1',
        llm_api_key='llm-key',
        transcribe_base_url='https://speech.example/v1',
        transcribe_api_key='speech-key',
    )
    assert separate.transcription_provider == ('https://speech.example/v1', 'speech-key')


def test_unknown_job_is_404():
    assert client.get(f'/api/jobs/{"0" * 32}').status_code == 404


def test_malformed_job_id_is_refused():
    assert client.get('/api/jobs/..%2F..%2Fsecrets').status_code in (404, 422)


def test_missing_key_is_explained_without_calling_out(tmp_path, monkeypatch):
    monkeypatch.undo()  # use the real transcribe; the test settings have no key
    audio = tmp_path / 'audio.webm'
    audio.write_bytes(WEBM)
    with pytest.raises(providers.ProviderError, match='no AI key'):
        providers.transcribe(audio, 'webm')


def test_cors_allows_only_the_front_end():
    allowed = client.get('/api/health', headers={'Origin': 'http://localhost:5173'})
    other = client.get('/api/health', headers={'Origin': 'https://evil.example'})
    assert allowed.headers['access-control-allow-origin'] == 'http://localhost:5173'
    assert 'access-control-allow-origin' not in other.headers


def test_body_size_limit():
    tiny = FastAPI()

    @tiny.post('/echo')
    async def echo(body: dict) -> dict:
        return body

    tiny.add_middleware(BodySizeLimit, max_bytes=10)
    limited = TestClient(tiny)
    assert limited.post('/echo', json={'a': 1}).status_code == 200
    assert limited.post('/echo', json={'a': 'x' * 50}).status_code == 413
    streamed = limited.post('/echo', content=iter([b'{"a": "', b'x' * 50, b'"}']))
    assert streamed.status_code == 413
