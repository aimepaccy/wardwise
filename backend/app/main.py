import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import jobs
from app.config import get_settings
from app.guard import Guard
from app.limits import BodySizeLimit
from app.reading import web, youtube
from app.routes import router

logging.basicConfig(level=logging.INFO, format='%(levelname)s:     %(name)s: %(message)s')
# The web client logs every address it calls, query string included, and an NCBI key travels in the
# query string. Only its warnings are kept, so a key never reaches the server's logs.
logging.getLogger('httpx2').setLevel(logging.WARNING)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Uploads left by a crash or a restart in the middle of a job are deleted before any new work.
    jobs.sweep_folders()
    # The YouTube catalogue loads and refreshes in the background, so start-up does not wait for it.
    refresher = asyncio.create_task(youtube.keep_fresh())
    yield
    refresher.cancel()
    with suppress(asyncio.CancelledError):
        await refresher
    await web.close()


protected = bool(settings.access_code.get_secret_value())
# The API's own documentation pages (/docs) help while building; a hosted copy with a code does without them.
docs = {'docs_url': None, 'redoc_url': None, 'openapi_url': None} if protected else {}
app = FastAPI(title='WardWise API', version='0.1.0', lifespan=lifespan, **docs)
app.include_router(router)

if not protected and not all(origin.startswith('http://localhost') for origin in settings.origins):
    logging.getLogger('wardwise').warning('ACCESS_CODE is empty, but the API allows a hosted page: anyone can use it.')

# The middleware added last runs first: CORS, then the guard, then the size limit. CORS goes outermost so that
# even a 401, 413 or 429 carries CORS headers, and the browser can show the real error. The guard comes before
# the size limit, so a request without the code is turned away before its body is read at all.
# Requests that carry only text get 2 MB, far more than fits in one pack, since their whole body is read into
# memory at once; only uploads (/api/sessions) get the full limit.
TEXT_ONLY = 2 * 1024 * 1024
app.add_middleware(
    BodySizeLimit,
    max_bytes=settings.max_request_mb * 1024 * 1024,
    path_limits={path: TEXT_ONLY for path in ('/api/packs', '/api/quizzes', '/api/ask', '/api/highlights')},
)
app.add_middleware(
    Guard,
    access_code=settings.access_code.get_secret_value(),
    jobs_per_hour=settings.jobs_per_hour,
    reading_per_hour=settings.reading_per_hour,
    max_active_jobs=settings.max_active_jobs,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_methods=['GET', 'POST'],
    allow_headers=['Content-Type', 'X-Access-Code'],
    # So the browser lets the page read how long to wait after a 429.
    expose_headers=['Retry-After'],
)
