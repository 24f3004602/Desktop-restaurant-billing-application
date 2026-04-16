from sqlalchemy.orm import Session

from app.modules.auth.schemas import PasswordChangeRequest
from app.modules.auth.service import change_current_user_password
from app.modules.users.models import User


def change_my_password(db: Session, current_user: User, payload: PasswordChangeRequest) -> None:
    change_current_user_password(db, current_user, payload)
