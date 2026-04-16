from datetime import UTC, datetime


def utcnow() -> datetime:
    """Return a naive UTC datetime without using deprecated datetime.utcnow()."""
    return datetime.now(UTC).replace(tzinfo=None)
