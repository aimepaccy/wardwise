"""Long sessions: condensed part by part into notes, then written as one pack, at the provider's pace."""

import json

import httpx2
import openai
from fastapi.testclient import TestClient

from app import generate, pacing, providers
from app.main import app
from app.schemas import CondensedPoint, PackRequest
from tests.conftest import fake_pack, fake_points, noted

client = TestClient(app)


def lecture(sentences: int) -> str:
    """An invented teaching transcript, one line long, as Whisper writes it."""
    return ' '.join(f'Teaching point number {i} is about safe asthma care on the ward.' for i in range(sentences))


LONG = lecture(400)  # about 25,000 characters: a few parts
PARTS = len(generate.split_parts(PackRequest(transcript=LONG)))


def notes_for_every_part(*quotes: str) -> list[str]:
    return [json.dumps(fake_points(*quotes))] * PARTS


def write_long(**body) -> dict:
    response = client.post('/api/packs', json=body)
    assert response.status_code == 202, response.text
    return client.get(f'/api/jobs/{response.json()["job_id"]}').json()


def test_parts_fit_keep_their_order_and_overlap():
    parts = generate.split_parts(PackRequest(transcript=LONG))
    assert len(parts) > 1
    assert all(len(part.transcript) <= generate.part_chars() for part in parts)
    # Each part starts with the passage the part before ended with.
    for before, after in zip(parts, parts[1:]):
        assert after.transcript.startswith(generate.passages(before)[-1])
    assert 'number 0 ' in parts[0].transcript and 'number 399 ' in parts[-1].transcript


def test_a_longer_part_may_give_more_points():
    parts = [PackRequest(transcript='x' * 12_000), PackRequest(transcript='x' * 12_000), PackRequest(transcript='x' * 1000)]
    big, _, small = generate.points_per_part(parts)
    assert big > small >= generate.MIN_POINTS_PER_PART
    assert sum(generate.points_per_part(parts)) * generate.CHARS_PER_POINT <= generate.quick_chars() * 1.1


def test_notes_and_transcript_are_never_mixed_in_a_part():
    parts = generate.split_parts(PackRequest(notes='Silent chest is life threatening.', transcript=LONG))
    assert parts[0].notes and parts[0].transcript is None
    assert all(not part.notes for part in parts[1:])


def test_the_shown_limit_never_needs_more_parts_than_allowed():
    half = generate.max_chars() // 2
    request = PackRequest(notes=lecture(2000)[:half], transcript=lecture(2000)[:half])
    assert len(generate.split_parts(request)) <= generate.MAX_PARTS


def test_a_longer_session_earns_a_bigger_pack_up_to_a_ceiling():
    assert generate.caps_for(1000) == generate.Caps(overview=4, summary=10, flashcards=10, questions=5)
    assert generate.caps_for(20_000) == generate.Caps(overview=6, summary=15, flashcards=20, questions=10)


def test_short_material_is_written_in_one_call(fake_writer):
    write_long(transcript=lecture(20))
    assert [call['form'] for call in fake_writer['calls']] == ['PackDraft']


def test_long_session_is_condensed_then_written_as_one_pack(fake_writer):
    quote = 'Teaching point number 7 is about safe asthma care'
    fake_writer['answers'].append(json.dumps(fake_points(quote, signals=('stressed',))))
    fake_writer['answers'].extend(notes_for_every_part('number 300 is about safe asthma care')[1:])
    state = write_long(transcript=LONG)
    assert state['status'] == 'done', state
    forms = [call['form'] for call in fake_writer['calls']]
    assert forms == ['CondensedPart'] * PARTS + ['PackBodyDraft', 'QuizDraft']
    # The notes go to the smaller model; the pack to the main writer.
    assert fake_writer['calls'][0]['model'] == ('openai/gpt-oss-20b', 8000)
    body_call = fake_writer['calls'][PARTS]
    assert body_call['model'] is None
    # The writer reads the notes, not the session, with the importance of each point.
    assert '<points>' in body_call['material'] and '(stressed)' in body_call['material'] and LONG not in body_call['material']
    assert '- flashcards: 16,' in body_call['instructions']  # for 4,800 words
    assert len(state['pack']['questions']) == 1


def test_each_item_gets_the_exact_quote_of_the_note_it_names(fake_writer):
    real = 'Teaching point number 7 is about safe asthma care'
    invented = 'sedation is safe and helps anxious patients settle'
    # The note-taker's first note is real; the second part's note is invented (not in the session).
    fake_writer['answers'].extend([json.dumps(fake_points(real)), *[json.dumps(fake_points(invented))] * (PARTS - 1)])
    body = noted(fake_pack(), 'summary', 'flashcards')
    body['summary'] = [
        {'topic': 'Acute asthma', 'text': 'Real.', 'point': 1},
        {'topic': 'Acute asthma', 'text': 'Invented.', 'point': 2},
        {'topic': 'Acute asthma', 'text': 'No such note.', 'point': 99},
        # A slip of the number: note 1 is real, but on another topic, so it cannot vouch for this point.
        {'topic': 'Malaria', 'text': 'Wrong note.', 'point': 1},
    ]
    fake_writer['answers'].append(json.dumps(body))
    pack = write_long(transcript=LONG)['pack']
    assert [(point['quote'], point['grounded']) for point in pack['summary']] == [
        (real, True),
        (invented, False),
        ('', False),
        ('', False),
    ]
    # The writer gave numbers, not quotes, and read numbered notes.
    assert '\n1. [Acute asthma]' in fake_writer['calls'][PARTS]['material']
    # Later parts were told the topic names already in use.
    assert 'Topics named in earlier parts: Acute asthma.' in fake_writer['calls'][1]['instructions']
    assert pack['passage_count'] == len(generate.passages(PackRequest(transcript=LONG)))


def test_a_failed_quiz_still_gives_the_pack(fake_writer):
    fake_writer['answers'].extend(
        notes_for_every_part('number 1 is about safe asthma care')
        + [json.dumps(noted(fake_pack(), 'summary', 'flashcards'))]
        + [providers.ProviderError('The writing service is busy. Please try again in a minute.')]
    )
    state = write_long(transcript=LONG)
    assert state['status'] == 'done'
    assert state['pack']['questions'] == [] and state['pack']['flashcards']


def test_a_session_with_no_teaching_is_explained(fake_writer):
    fake_writer['answers'].extend([json.dumps({'topics': [], 'points': []})] * PARTS)
    state = write_long(transcript=LONG)
    assert state['status'] == 'failed'
    assert 'no clinical teaching' in state['error']


def test_progress_names_each_step_but_never_the_parts(fake_writer):
    steps = []
    generate.write_pack(PackRequest(transcript=LONG), on_step=steps.append)
    assert steps == [
        'Writing your study pack',
        *(f'Taking notes on your session, about {PARTS - n + 2} minutes left' for n in range(1, PARTS + 1)),
        'Writing your study pack',
        'Writing the quiz',
    ]
    # The student uploaded one session: how WardWise splits it stays inside WardWise.
    assert not any('part' in step.lower() for step in steps)


def test_waiting_for_the_allowance_is_shown_plainly():
    steps = []
    on_wait = generate._waiting('Writing the quiz', steps.append)
    on_wait(40)
    on_wait(0)
    assert steps == ['Writing the quiz (next turn in about 40 s)', 'Writing the quiz']


def test_the_quiz_gets_a_third_try(fake_writer):
    broken = providers.InvalidOutput('The AI ran out of room before finishing.')
    fake_writer['answers'].extend(
        notes_for_every_part('number 1 is about safe asthma care')
        + [json.dumps(noted(fake_pack(), 'summary', 'flashcards')), broken, broken]
    )
    state = write_long(transcript=LONG)
    assert [call['form'] for call in fake_writer['calls']][-3:] == ['QuizDraft'] * 3
    assert len(state['pack']['questions']) == 1


def point(quote: str, *signals: str, text: str = 'A point.', topic: str = 'Asthma') -> CondensedPoint:
    return CondensedPoint(topic=topic, text=text, quote=quote, signals=list(signals))


def test_items_are_shared_so_every_topic_gets_one_and_stressed_topics_more():
    notes = (
        [point(f'asthma {i} point here', 'stressed', 'safety', topic='Asthma') for i in range(4)]
        + [point('malaria point here now', topic='Malaria')]
        + [point('bleeding point here now', topic='Postpartum haemorrhage')]
    )
    shares = generate.share(10, notes)
    assert list(shares) == ['Asthma', 'Malaria', 'Postpartum haemorrhage']  # the order taught
    assert sum(shares.values()) == 10
    assert shares['Malaria'] >= 1 and shares['Postpartum haemorrhage'] >= 1
    assert shares['Asthma'] > shares['Malaria']
    # More topics than items: the weightiest topics get one each, still in the order taught.
    assert generate.share(1, notes) == {'Asthma': 1}


def test_every_topic_keeps_a_point_when_the_notes_are_trimmed():
    filler = 'x' * 400
    points = [point(f'stressed point number {i} here', 'stressed', 'exam', text=filler) for i in range(30)]
    points.append(point('the last topic of the round', text=filler, topic='Postpartum haemorrhage'))
    tidy = generate.tidy_points(points)
    assert len(tidy) < len(points)
    assert tidy[-1].topic == 'Postpartum haemorrhage'
    assert generate.topics_of(tidy) == ['Asthma', 'Postpartum haemorrhage']


def test_a_point_from_the_overlap_is_kept_once_with_its_signals():
    twins = [point('peak flow between 33 and 50 percent'), point('a peak flow between 33 and 50 percent of best', 'exam')]
    tidy = generate.tidy_points(twins, part_of=[1, 2])
    assert len(tidy) == 1 and tidy[0].signals == ['exam']
    # Within one part, or between parts that do not touch, both are kept: they may teach different things.
    assert len(generate.tidy_points(twins, part_of=[1, 1])) == 2
    assert len(generate.tidy_points(twins, part_of=[1, 3])) == 2


def test_a_note_not_found_in_its_part_loses_its_signals(fake_writer):
    invented = 'sedation is safe and helps anxious patients settle'
    fake_writer['answers'].extend([json.dumps(fake_points(invented, signals=('stressed', 'safety')))] * PARTS)
    write_long(transcript=LONG)
    assert '(stressed' not in fake_writer['calls'][PARTS]['material']


def test_too_many_notes_lose_the_points_without_signals_first():
    filler = 'x' * 400
    points = [point(f'plain point number {i} here', text=filler) for i in range(30)]
    points.insert(25, point('never give a sedative on the ward', 'safety', 'stressed', text=filler))
    tidy = generate.tidy_points(points)
    assert len(generate.notes_material(tidy)) <= generate.quick_chars()
    assert any(p.signals for p in tidy)
    # Still in the order taught.
    numbers = [int(p.quote.split()[3]) for p in tidy if not p.signals]
    assert numbers == sorted(numbers)


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def test_the_pacer_waits_until_the_minute_has_room():
    clock = Clock()
    window = pacing.TokenWindow(8000, clock=clock, sleep=clock.sleep)
    heard = []
    window.reserve(6000)
    clock.now += 10
    window.reserve(5000, on_wait=heard.append)
    # The first call leaves the window 60 s after it was sent: 50 s from the second call.
    assert clock.now == 1060.0
    assert heard[0] == 50 and heard[-1] == 0


def test_the_pacer_lets_calls_through_while_there_is_room():
    clock = Clock()
    window = pacing.TokenWindow(8000, clock=clock, sleep=clock.sleep)
    window.reserve(3000)
    window.reserve(3000)
    assert clock.now == 1000.0


def test_a_call_bigger_than_the_allowance_goes_alone():
    clock = Clock()
    window = pacing.TokenWindow(8000, clock=clock, sleep=clock.sleep)
    window.reserve(100)
    window.reserve(20_000)
    assert clock.now == 1060.0


def test_the_daily_limit_has_its_own_message():
    response = httpx2.Response(429, request=httpx2.Request('POST', 'https://ai.example/v1'))
    error = openai.RateLimitError('Rate limit reached on tokens per day (TPD): Limit 200000', response=response, body=None)
    message = str(providers._translate(error, 'writing'))
    assert "today's AI allowance" in message and 'free' not in message
