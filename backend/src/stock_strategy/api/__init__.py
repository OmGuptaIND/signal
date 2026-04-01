from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from ..config import load_secrets
from ..logging_setup import setup_intercept_handlers
from .auth import AuthRouter
from .core import lifespan
from .kite import KiteRouter
from .runs import RunsRouter
from .signals import SignalsRouter

setup_intercept_handlers()

_secrets = load_secrets(".env")


class InternalKeyMiddleware(BaseHTTPMiddleware):
    """Require X-Internal-Key on all /api/* routes."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/"):
            # SSE stream uses its own short-lived token auth (stream_token query param)
            if request.url.path == "/api/signals/stream":
                return await call_next(request)
            expected = _secrets.internal_api_key
            if not expected:
                # Key not configured — allow through (dev fallback)
                return await call_next(request)
            provided = request.headers.get("X-Internal-Key", "")
            if provided != expected:
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)


app = FastAPI(title="Stock Strategy API", version="0.1.0", lifespan=lifespan)

_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_frontend_url = _secrets.frontend_base_url
if _frontend_url and _frontend_url not in _cors_origins:
    _cors_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(InternalKeyMiddleware)

auth_router = AuthRouter()
kite_router = KiteRouter()
signals_router = SignalsRouter()
runs_router = RunsRouter()

app.include_router(auth_router.router)
app.include_router(kite_router.router)
app.include_router(signals_router.router)
app.include_router(runs_router.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
