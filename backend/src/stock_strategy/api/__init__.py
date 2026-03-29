from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..logging_setup import setup_intercept_handlers
from .core import lifespan
from .auth import AuthRouter
from .kite import KiteRouter
from .runs import RunsRouter
from .signals import SignalsRouter

setup_intercept_handlers()

app = FastAPI(title="Stock Strategy API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
