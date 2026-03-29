import asyncio
import json
from collections.abc import AsyncGenerator

from .logging_setup import get_logger

logger = get_logger(__name__)


class EventBroadcaster:
    def __init__(self) -> None:
        self.queues: list[asyncio.Queue] = []

    def get_state(self) -> str:
        return f"{len(self.queues)} clients"

    def put_nowait(self, event_type: str, data: dict) -> None:
        payload = json.dumps({"type": event_type, "data": data})
        for idx, queue in enumerate(self.queues):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                logger.warning(f"Client {idx} queue is full, skipping event")

    async def stream(self) -> AsyncGenerator[str, None]:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.queues.append(queue)
        logger.info(f"SSE client connected. Total clients: {len(self.queues)}")

        try:
            # Yield initial connection message
            yield json.dumps({"type": "connected", "data": {"message": "SSE established"}})

            while True:
                payload = await queue.get()
                yield payload
        except asyncio.CancelledError:
            logger.info("SSE client disconnected.")
        finally:
            if queue in self.queues:
                self.queues.remove(queue)
            logger.info(f"SSE disconnected. Remaining clients: {len(self.queues)}")

broadcaster = EventBroadcaster()
