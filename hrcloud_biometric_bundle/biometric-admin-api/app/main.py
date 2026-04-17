from fastapi import FastAPI

from app.api.routes import router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="API administrativa biométrica para HRCloud"
)

app.include_router(router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict:
    return {
        "ok": True,
        "service": settings.app_name,
        "env": settings.app_env,
        "docs": f"{settings.api_prefix}/docs-notes"
    }
