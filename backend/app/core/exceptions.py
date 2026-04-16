from dataclasses import dataclass


@dataclass
class AppError(Exception):
    code: str
    message: str
    status_code: int = 400


class NotFoundError(AppError):
    def __init__(self, message: str):
        super().__init__(code="NOT_FOUND", message=message, status_code=404)


class ConflictError(AppError):
    def __init__(self, message: str):
        super().__init__(code="CONFLICT", message=message, status_code=409)


class DomainValidationError(AppError):
    def __init__(self, message: str):
        super().__init__(code="VALIDATION_ERROR", message=message, status_code=400)


class AuthenticationError(AppError):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(code="AUTHENTICATION_ERROR", message=message, status_code=401)


class InsufficientStockError(AppError):
    def __init__(self, message: str = "Insufficient stock for requested item"):
        super().__init__(code="INSUFFICIENT_STOCK", message=message, status_code=409)


class PaymentFailedError(AppError):
    def __init__(self, message: str = "Payment could not be processed", status_code: int = 400):
        super().__init__(code="PAYMENT_FAILED", message=message, status_code=status_code)
