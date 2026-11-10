import os

import pytest

# Tests use fixed settings, whatever is in the developer's own .env.
os.environ['ALLOWED_ORIGINS'] = 'http://localhost:5173'
os.environ['MAX_REQUEST_MB'] = '110'
# No real key, so no test can ever reach the AI provider.
os.environ['LLM_API_KEY'] = ''
os.environ['TRANSCRIBE_API_KEY'] = ''

FAKE_TRANSCRIPT = 'Wheeze is a sign of narrowed airways.'


@pytest.fixture(autouse=True)
def private_jobs_folder(monkeypatch, tmp_path):
    """Each test gets its own folder for uploads, so tests never touch the real one."""
    from app import jobs

    monkeypatch.setattr(jobs, 'JOBS_ROOT', tmp_path / 'wardwise-jobs')


@pytest.fixture(autouse=True)
def fake_transcribe(monkeypatch):
    """Stands in for the real provider: records each call and returns a fixed transcript."""
    from app import providers

    calls = []

    def transcribe(audio, kind):
        calls.append({'kind': kind, 'name': audio.name, 'bytes': audio.read_bytes()})
        return FAKE_TRANSCRIPT

    monkeypatch.setattr(providers, 'transcribe', transcribe)
    return calls


FAKE_HANDWRITING = 'Silent chest = life threatening'


@pytest.fixture(autouse=True)
def fake_read_handwriting(monkeypatch):
    """Stands in for the vision model: records each photo it is sent and returns fixed text."""
    from app import providers

    calls = []

    def read_handwriting(jpeg):
        calls.append(jpeg)
        return FAKE_HANDWRITING

    monkeypatch.setattr(providers, 'read_handwriting', read_handwriting)
    return calls


FAKE_NOTES = 'Give prednisolone 40 mg once daily for five days in acute asthma.'


def fake_pack(**changes) -> dict:
    """What a well-behaved AI might write from FAKE_NOTES: one quote from the notes, one invented."""
    option = {'text': 'Prednisolone', 'explanation': 'Correct for acute asthma.'}
    pack = {
        'title': 'Acute asthma',
        'overview': ['The session covered oral steroids in acute asthma.'],
        'summary': [{'text': 'Oral steroids for five days.', 'quote': 'for five days in acute asthma'}],
        'flashcards': [
            {'front': 'Steroid dose in acute asthma?', 'back': 'Prednisolone 40 mg', 'quote': 'prednisolone 40 mg once daily'},
            {'front': 'First-line biologic?', 'back': 'Omalizumab', 'quote': 'omalizumab is the first line biologic'},
        ],
        'questions': [
            {
                'stem': 'A 25-year-old with acute asthma. Which oral drug?',
                'options': [option] * 5,
                'answer': 'A',
                'quote': 'Give prednisolone 40 mg once daily for five days',
            }
        ],
        'search_terms': ['acute asthma oral corticosteroids'],
    }
    return pack | changes


@pytest.fixture(autouse=True)
def fake_writer(monkeypatch):
    """Stands in for the LLM: records each call and answers from a queue (a valid pack by default)."""
    import json

    from app import providers

    calls = []
    answers = []

    def write_json(instructions, material, form, max_tokens):
        calls.append({'material': material})
        answer = answers.pop(0) if answers else json.dumps(fake_pack())
        if isinstance(answer, Exception):
            raise answer
        return answer, 1234

    monkeypatch.setattr(providers, 'write_json', write_json)
    return {'calls': calls, 'answers': answers}
