from fastapi import APIRouter

from app.api.routes import health

# All API endpoints are collected here and mounted under /api in main.py
api_router = APIRouter()
api_router.include_router(health.router)
