from fastapi import APIRouter

from app.modules import auth_router, billing_router, inventory_router, orders_router, payments_router, reports_router, users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(inventory_router)
api_router.include_router(orders_router)
api_router.include_router(billing_router)
api_router.include_router(payments_router)
api_router.include_router(reports_router)
api_router.include_router(users_router)
