from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.modules.users.models import User
from app.modules.users.schemas import PasswordChangeRequest, PasswordChangeResponse
from app.modules.users.service import change_my_password

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me/password", response_model=PasswordChangeResponse)
def update_my_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> PasswordChangeResponse:
    change_my_password(db, current_user, payload)
    return PasswordChangeResponse()
