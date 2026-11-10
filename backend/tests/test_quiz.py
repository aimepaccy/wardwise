"""A quiz written on its own, for a pack that came without one: from the pack's teaching points."""

import json

from fastapi.testclient import TestClient

from app import providers
from app.main import app
from tests.conftest import FAKE_NOTES, fake_pack, noted

client = TestClient(app)

REAL = 'prednisolone 40 mg once daily for five days'
INVENTED = 'sedation is safe and helps anxious patients settle'


def point(quote: str = REAL, topic: str = 'Acute asthma', text: str = 'Oral steroids for five days.') -> dict:
    return {'topic': topic, 'text': text, 'quote': quote}


def write_quiz(**body) -> dict:
    response = client.post('/api/quizzes', json={'notes': FAKE_NOTES, **body})
    assert response.status_code == 202, response.text
    return client.get(f'/api/jobs/{response.json()["job_id"]}').json()


def test_a_quiz_is_written_from_the_packs_points(fake_writer):
    state = write_quiz(points=[point()])
    assert state['status'] == 'done', state
    [question] = state['questions']
    # The writer named point 1, so the question carries that point's quote, checked against the session.
    assert question['quote'] == REAL and question['grounded']
    [call] = fake_writer['calls']
    assert call['form'] == 'QuizDraft' and call['model'] is None
    # The writer reads the numbered points, not the session.
    assert '\n1. [Acute asthma] Oral steroids for five days.' in call['material']
    assert FAKE_NOTES not in call['material']
    assert "The session's key teaching points are numbered" in call['instructions']


def test_points_not_found_in_the_session_are_left_out(fake_writer):
    write_quiz(points=[point(INVENTED, text='Invented.'), point()])
    material = fake_writer['calls'][0]['material']
    assert INVENTED not in material and REAL in material


def test_points_from_packs_without_topics_still_work(fake_writer):
    answer = {'questions': noted(fake_pack(), 'questions')['questions']}
    answer['questions'][0]['topic'] = 'This session'
    fake_writer['answers'].append(json.dumps(answer))
    state = write_quiz(points=[point(topic='')])
    assert '[This session]' in fake_writer['calls'][0]['material']
    assert state['questions'][0]['grounded']


def test_the_quiz_is_tried_three_times_then_explained(fake_writer):
    fake_writer['answers'].extend([providers.InvalidOutput('The AI ran out of room before finishing.')] * 3)
    state = write_quiz(points=[point()])
    assert len(fake_writer['calls']) == 3
    assert state['status'] == 'failed'
    assert state['error'] == 'WardWise could not write the quiz this time. Please try again.'


def test_a_quiz_with_no_usable_questions_is_tried_again(fake_writer):
    fake_writer['answers'].append(json.dumps({'questions': []}))
    state = write_quiz(points=[point()])
    assert len(fake_writer['calls']) == 2
    assert len(state['questions']) == 1


def test_a_quiz_needs_points():
    assert client.post('/api/quizzes', json={'notes': FAKE_NOTES, 'points': []}).status_code == 422


def test_points_too_long_for_one_call_are_refused_before_any_call(fake_writer):
    long_points = [point(text='x' * 1900) for _ in range(30)]
    state = write_quiz(points=long_points)
    assert state['status'] == 'failed' and 'too long' in state['error']
    assert fake_writer['calls'] == []


def test_when_no_quote_is_found_all_points_are_used_and_questions_marked(fake_writer):
    state = write_quiz(points=[point(INVENTED, text='Invented.')])
    assert INVENTED in fake_writer['calls'][0]['material']
    assert state['questions'][0]['grounded'] is False
