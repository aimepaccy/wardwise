import asyncio
from types import SimpleNamespace

import httpx2
import openai
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import jobs, providers
from app.guard import JOB_PATHS, Guard
from app.main import app as wardwise
from app.routes import router
from tests.test_api import WEBM, finished_job, photo, post

# The real photo reader and writer, kept before conftest swaps in their stand-ins for each test.
REAL_READ_HANDWRITING = providers.read_handwriting
REAL_WRITE_JSON = providers.write_json
CODE = 'ward-round-7'


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def guard_app(clock=None, **settings) -> FastAPI:
    """A tiny app behind the guard, standing in for WardWise's routes."""
    api = FastAPI()
    for path in sorted(JOB_PATHS):
        api.post(path)(lambda: {'ok': True})
    for path in ('/api/health', '/api/limits', '/api/reading', '/api/jobs/abc', '/api/access'):
        api.get(path)(lambda: {'ok': True})
    api.add_middleware(Guard, clock=clock or Clock(), **settings)
    return api


def guarded(clock=None, address='10.0.0.1', **settings) -> TestClient:
    return TestClient(guard_app(clock, **settings), client=(address, 5000))


def with_code(code=CODE):
    return {'X-Access-Code': code}


def test_without_a_code_set_nothing_is_asked():
    assert guarded().post('/api/packs').status_code == 200


def test_a_missing_or_wrong_code_is_turned_away():
    client = guarded(access_code=CODE)
    missing = client.post('/api/packs')
    assert missing.status_code == 401
    assert missing.json() == {'detail': 'Enter the access code to use WardWise.'}
    wrong = client.post('/api/packs', headers=with_code('ward-round-8'))
    assert wrong.status_code == 401
    assert wrong.json() == {'detail': 'That access code is not right.'}
    assert client.post('/api/packs', headers=with_code()).status_code == 200
    assert client.get('/api/access', headers=with_code()).status_code == 200


def test_health_and_limits_need_no_code():
    client = guarded(access_code=CODE)
    assert client.get('/api/health').status_code == 200
    assert client.get('/api/limits').status_code == 200


def test_polling_a_job_needs_the_code_too():
    assert guarded(access_code=CODE).get('/api/jobs/abc').status_code == 401


def test_after_ten_wrong_codes_even_the_right_one_waits():
    clock = Clock()
    client = guarded(clock, access_code=CODE)
    for _ in range(10):
        assert client.post('/api/packs', headers=with_code('guess')).status_code == 401
    blocked = client.post('/api/packs', headers=with_code())
    assert blocked.status_code == 429
    assert blocked.json() == {'detail': 'Too many wrong codes. Please try again in 15 minutes.'}
    assert blocked.headers['Retry-After'] == '900'
    clock.now += 15 * 60
    assert client.post('/api/packs', headers=with_code()).status_code == 200


def test_each_address_has_its_own_counts():
    api = guard_app(access_code=CODE, jobs_per_hour=1)
    first, second = (TestClient(api, client=(address, 5000)) for address in ('10.0.0.1', '10.0.0.2'))
    for _ in range(10):
        first.post('/api/packs', headers=with_code('guess'))
    assert first.post('/api/packs', headers=with_code()).status_code == 429
    assert second.post('/api/packs', headers=with_code()).status_code == 200
    assert second.post('/api/packs', headers=with_code()).status_code == 429  # its own hourly limit of 1


def test_every_route_that_starts_ai_work_is_counted():
    # A new job route added later must be added to JOB_PATHS too, or it would escape the hourly limit.
    posts = {route.path for route in router.routes if 'POST' in getattr(route, 'methods', set())}
    assert posts == JOB_PATHS


def test_a_path_prefix_from_a_proxy_does_not_get_around_the_guard():
    sent = []

    async def send(message):
        sent.append(message)

    async def endpoint(scope, receive, send):
        raise AssertionError('the request reached the app')

    scope = {'type': 'http', 'method': 'POST', 'path': '/x/api/sessions', 'root_path': '/x', 'headers': [], 'client': ('10.0.0.1', 1)}
    asyncio.run(Guard(endpoint, access_code=CODE)(scope, None, send))
    assert sent[0]['status'] == 401


def guard_in(api: FastAPI, client: TestClient) -> Guard:
    client.get('/api/health')  # the middleware is assembled on the first request
    middleware = api.middleware_stack
    while not isinstance(middleware, Guard):
        middleware = middleware.app
    return middleware


def test_looking_up_an_address_does_not_store_it():
    api = guard_app(access_code=CODE)
    client = TestClient(api, client=('10.0.0.9', 5000))
    client.post('/api/packs', headers=with_code())
    assert guard_in(api, client).wrong_codes._times == {}


def test_a_refusal_reaches_the_page_with_its_wait(monkeypatch):
    # On the real app, CORS wraps the guard, so the page can read a 401 and the Retry-After header of a 429.
    client = TestClient(wardwise)
    monkeypatch.setattr(guard_in(wardwise, client), 'access_code', CODE.encode())
    response = client.post('/api/packs', headers={'Origin': 'http://localhost:5173'}, json={'notes': 'x'})
    assert response.status_code == 401
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'
    assert 'retry-after' in response.headers['access-control-expose-headers'].lower()


@pytest.mark.parametrize('path', ['/api/quizzes', '/api/ask', '/api/highlights'])
def test_text_only_requests_have_a_small_body_limit(path):
    response = TestClient(wardwise).post(path, content=b'x' * (2 * 1024 * 1024 + 1), headers={'Content-Type': 'application/json'})
    assert response.status_code == 413


def test_a_request_without_the_code_is_refused_before_its_body_is_read():
    async def never_read():
        raise AssertionError('the body was read')

    sent = []

    async def send(message):
        sent.append(message)

    async def endpoint(scope, receive, send):
        raise AssertionError('the request reached the app')

    scope = {'type': 'http', 'method': 'POST', 'path': '/api/sessions', 'headers': [], 'client': ('10.0.0.1', 5000)}
    asyncio.run(Guard(endpoint, access_code=CODE)(scope, never_read, send))
    assert sent[0]['status'] == 401


def test_jobs_are_limited_per_address_per_hour():
    clock = Clock()
    client = guarded(clock, jobs_per_hour=2)
    assert client.post('/api/sessions').status_code == 200
    clock.now += 600
    assert client.post('/api/ask').status_code == 200
    refused = client.post('/api/packs')
    assert refused.status_code == 429
    assert refused.json() == {'detail': 'You have reached the limit for this hour. Please try again in 50 minutes.'}
    assert refused.headers['Retry-After'] == '3000'
    # Checking on a job is not starting one.
    assert client.get('/api/jobs/abc').status_code == 200
    # The first request leaves the hour, so one more fits.
    clock.now += 3000
    assert client.post('/api/packs').status_code == 200


def test_reading_has_its_own_hourly_limit():
    client = guarded(reading_per_hour=1, jobs_per_hour=1)
    assert client.get('/api/reading').status_code == 200
    assert client.get('/api/reading').status_code == 429
    assert client.post('/api/packs').status_code == 200


def test_too_much_work_in_progress_is_turned_away_as_busy(monkeypatch):
    client = guarded(max_active_jobs=2, jobs_per_hour=1)
    monkeypatch.setattr(jobs, 'active', lambda: 2)
    busy = client.post('/api/packs')
    assert busy.status_code == 429
    assert busy.json() == {'detail': "WardWise is busy with other students' work. Please try again in a minute."}
    # Reading needs no AI writing, so it is not held up.
    assert client.get('/api/reading').status_code == 200
    # A busy refusal does not use up the student's hourly count.
    monkeypatch.setattr(jobs, 'active', lambda: 1)
    assert client.post('/api/packs').status_code == 200


def test_only_queued_and_working_jobs_count_as_active():
    first, second = jobs.create(), jobs.create()
    jobs._update(second, status='done')
    assert jobs.active() >= 1
    before = jobs.active()
    jobs._update(first, status='failed')
    assert jobs.active() == before - 1


def test_the_browser_may_send_the_code_from_the_page():
    # The custom header makes the browser ask first (a preflight), so CORS must allow it by name.
    response = TestClient(wardwise).options(
        '/api/packs',
        headers={
            'Origin': 'http://localhost:5173',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type,x-access-code',
        },
    )
    assert response.status_code == 200
    assert 'x-access-code' in response.headers['access-control-allow-headers'].lower()


# A retired model: the student is told it needs the settings changed, not to try again.
def _error(status: int, code: str) -> openai.APIStatusError:
    response = httpx2.Response(status, request=httpx2.Request('POST', 'https://ai.example/v1'))
    kind = {400: openai.BadRequestError, 404: openai.NotFoundError}[status]
    return kind('Model gone', response=response, body={'code': code})


def _client_raising(error):
    create = lambda **_: (_ for _ in ()).throw(error)  # noqa: E731
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


@pytest.mark.parametrize(('status', 'code'), [(400, 'model_decommissioned'), (404, 'model_not_found')])
def test_a_retired_writing_model_is_explained(monkeypatch, status, code):
    monkeypatch.setattr(providers, '_client', lambda *_: _client_raising(_error(status, code)))
    monkeypatch.setattr(providers.pacing, 'reserve', lambda *_, **__: None)
    with pytest.raises(providers.ModelUnavailable, match='no longer available'):
        REAL_WRITE_JSON('Instructions', 'Material', Answer, 100)


class Answer(providers.BaseModel):
    text: str


def test_a_retired_photo_model_fails_the_job_instead_of_warning_photo_by_photo(monkeypatch):
    monkeypatch.setattr(providers, '_client', lambda *_: _client_raising(_error(400, 'model_decommissioned')))
    with pytest.raises(providers.ModelUnavailable):
        REAL_READ_HANDWRITING(b'jpeg')
    monkeypatch.setattr(providers, 'read_handwriting', lambda jpeg: (_ for _ in ()).throw(providers.ModelUnavailable('gone')))
    state = finished_job(post(photos=[('page.jpg', photo())]))
    assert state['status'] == 'failed'
    assert state['error'] == 'gone'


@pytest.mark.parametrize('service', ['transcription', 'photo reading', 'writing'])
@pytest.mark.parametrize(('status', 'code'), [(400, 'model_decommissioned'), (404, 'model_not_found')])
def test_the_whole_sentence_reads_well_for_every_service(service, status, code):
    error = _error(status, code)
    gone = providers._translate(error, service) if status == 404 else providers._model_gone(error, service)
    assert str(gone) == (
        f'The {service} model WardWise is set to use is no longer available. '
        'The person running WardWise needs to choose another model in its settings.'
    )


def test_a_404_that_names_no_model_is_not_blamed_on_the_model():
    response = httpx2.Response(404, request=httpx2.Request('POST', 'https://ai.example/v1'))
    error = openai.NotFoundError('Not Found', response=response, body=None)
    translated = providers._translate(error, 'writing')
    assert not isinstance(translated, providers.ModelUnavailable)


def test_other_bad_requests_keep_their_own_words():
    error = _error(400, 'something_else')
    assert providers._model_gone(error, 'write') is None


def test_each_photo_is_shown_as_it_is_read(fake_read_handwriting):
    steps = []
    inputs = []
    for number in range(3):
        path = jobs.new_folder() / f'p{number}.jpg'
        path.write_bytes(photo())
        inputs.append(jobs.PhotoInput(path=path, name=path.name))
    jobs._read_photos(inputs, [], on_step=steps.append)
    assert steps == [f'Reading your handwritten notes (photo {n} of 3)' for n in (1, 2, 3)]


def test_audio_alone_still_works_through_the_real_app():
    assert finished_job(post(audio=('round.webm', WEBM)))['status'] == 'done'
