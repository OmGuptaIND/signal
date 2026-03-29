from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..logging_setup import get_logger
from .core import get_run_manager

logger = get_logger(__name__)


class StartRunRequest(BaseModel):
    access_token: str
    api_key: str
    api_secret: str


class StopRunRequest(BaseModel):
    pass


class RunsRouter:
    def __init__(self):
        self.router = APIRouter()
        self._setup_routes()

    def _setup_routes(self):
        self.router.add_api_route("/api/runs", self.list_runs, methods=["GET"])
        self.router.add_api_route("/api/runs/active", self.active_run, methods=["GET"])
        self.router.add_api_route("/api/runs/start", self.start_run, methods=["POST"])
        self.router.add_api_route("/api/runs/{run_id}/stop", self.stop_run, methods=["POST"])

    def list_runs(self, run_manager=Depends(get_run_manager)) -> dict:
        runs = run_manager.get_runs(limit=20)
        return {"runs": runs}

    def active_run(self, run_manager=Depends(get_run_manager)) -> dict:
        run = run_manager.get_active_run()
        return {"run": run}

    async def start_run(self, body: StartRunRequest, run_manager=Depends(get_run_manager)) -> dict:
        if not body.access_token:
            raise HTTPException(status_code=400, detail="access_token is required")
        if not body.api_key:
            raise HTTPException(status_code=400, detail="api_key is required")

        try:
            run = await run_manager.start_run(
                access_token=body.access_token,
                api_key=body.api_key,
                api_secret=body.api_secret,
            )
            return {"run": run}
        except Exception as exc:
            logger.error("failed to start run: {}", exc)
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    async def stop_run(self, run_id: int, run_manager=Depends(get_run_manager)) -> dict:
        run = await run_manager.stop_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found or already stopped")
        return {"run": run}
