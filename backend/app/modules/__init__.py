from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.inventory.router import router as inventory_router
from app.modules.orders.router import router as orders_router
from app.modules.payments.router import router as payments_router
from app.modules.reports.router import router as reports_router

__all__ = [
    "auth_router",
    "inventory_router",
    "orders_router",
    "billing_router",
    "payments_router",
    "reports_router",
]
