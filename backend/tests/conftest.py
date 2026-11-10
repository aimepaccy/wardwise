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
        'summary': [{'topic': 'Acute asthma', 'text': 'Oral steroids for five days.', 'quote': 'for five days in acute asthma'}],
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


def fake_points(*quotes: str, signals: tuple[str, ...] = ()) -> dict:
    """What the note-taker might write for one part of a long session: one point per quote."""
    return {
        'topics': ['Acute asthma'],
        'points': [
            {'topic': 'Acute asthma', 'text': f'Point from: {quote}', 'quote': quote, 'signals': list(signals)}
            for quote in quotes
        ]
    }


def noted(pack: dict, *keys: str, point: int = 1) -> dict:
    """A long session's writer names the note each item comes from instead of copying its quote."""
    changed = {key: [{'topic': 'Acute asthma', **item, 'point': point} for item in pack[key]] for key in keys}
    for items in changed.values():
        for item in items:
            item.pop('quote', None)
    return {key: value for key, value in (pack | changed).items() if key != 'questions' or 'questions' in keys}


# A valid answer for each form, so a stand-in call that is not given one still succeeds.
DEFAULT_ANSWERS = {
    'PackDraft': lambda: fake_pack(),
    'PackBodyDraft': lambda: noted(fake_pack(), 'summary', 'flashcards'),
    'QuizDraft': lambda: {'questions': noted(fake_pack(), 'questions')['questions']},
    'CondensedPart': lambda: fake_points('for five days in acute asthma'),
}


@pytest.fixture(autouse=True)
def no_waiting(monkeypatch):
    """Tests never wait for the provider's allowance: there is no provider."""
    from app import pacing

    monkeypatch.setattr(pacing, 'reserve', lambda *args, **kwargs: None)


@pytest.fixture(autouse=True)
def fake_writer(monkeypatch):
    """Stands in for the LLM: records each call and answers from a queue (a valid answer for the form by default)."""
    import json

    from app import providers

    calls = []
    answers = []

    def write_json(instructions, material, form, max_tokens, *, model=None, on_wait=None):
        calls.append({'instructions': instructions, 'material': material, 'form': form.__name__, 'model': model})
        answer = answers.pop(0) if answers else json.dumps(DEFAULT_ANSWERS[form.__name__]())
        if isinstance(answer, Exception):
            raise answer
        return answer, 1234

    monkeypatch.setattr(providers, 'write_json', write_json)
    return {'calls': calls, 'answers': answers}
