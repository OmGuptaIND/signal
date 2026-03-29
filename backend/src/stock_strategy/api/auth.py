import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..logging_setup import get_logger
from ..models_db import InviteCode, User
from .core import get_db_session

logger = get_logger(__name__)


class CheckUserRequest(BaseModel):
    email: str


class RegisterRequest(BaseModel):
    email: str
    name: str | None = None
    image: str | None = None
    google_id: str | None = None
    invite_code: str


class GenerateCodesRequest(BaseModel):
    count: int = 5


class AuthRouter:
    def __init__(self):
        self.router = APIRouter()
        self._setup_routes()

    def _setup_routes(self):
        self.router.add_api_route("/api/users/check", self.check_user, methods=["POST"])
        self.router.add_api_route("/api/users/register", self.register_user, methods=["POST"])
        self.router.add_api_route("/api/invite-codes/generate", self.generate_codes, methods=["POST"])

    def check_user(self, body: CheckUserRequest, session: Session = Depends(get_db_session)) -> dict:
        if not session:
            raise HTTPException(status_code=500, detail="Database not available")

        user = session.query(User).filter(User.email == body.email).first()
        if user:
            return {
                "exists": True,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "image": user.image,
                },
            }
        return {"exists": False}

    def register_user(self, body: RegisterRequest, session: Session = Depends(get_db_session)) -> dict:
        if not session:
            raise HTTPException(status_code=500, detail="Database not available")

        # Check if user already exists
        existing = session.query(User).filter(User.email == body.email).first()
        if existing:
            return {
                "success": True,
                "user": {
                    "id": existing.id,
                    "email": existing.email,
                    "name": existing.name,
                    "image": existing.image,
                },
            }

        # Validate invite code
        invite = (
            session.query(InviteCode)
            .filter(InviteCode.code == body.invite_code, InviteCode.used_by_user_id.is_(None))
            .with_for_update()
            .first()
        )
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid or already used invite code")

        # Create user
        user = User(
            email=body.email,
            name=body.name,
            image=body.image,
            google_id=body.google_id,
        )
        session.add(user)
        session.flush()

        # Mark invite code as used
        invite.used_by_user_id = user.id
        invite.used_at = datetime.now(tz=UTC)

        session.commit()
        session.refresh(user)

        logger.info("New user registered: {} (invite code: {})", body.email, body.invite_code)

        return {
            "success": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "image": user.image,
            },
        }

    def generate_codes(self, body: GenerateCodesRequest, session: Session = Depends(get_db_session)) -> dict:
        if not session:
            raise HTTPException(status_code=500, detail="Database not available")

        codes = []
        for _ in range(body.count):
            code = secrets.token_urlsafe(6)  # ~8 char alphanumeric
            invite = InviteCode(code=code)
            session.add(invite)
            codes.append(code)

        session.commit()

        logger.info("Generated {} invite codes", len(codes))
        return {"codes": codes}
