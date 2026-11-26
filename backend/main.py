from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config.config import settings
from backend.api.routers.router import router as api_router
from backend.api.routers.auth import router as auth_router, ensure_demo_user
from backend.services.models.storage.database.connection import engine, Base, async_session
import backend.services.models.storage.database.models  # noqa: F401

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Context manager managing application startup and shutdown events.
    Creates database tables on startup.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as session:
        await ensure_demo_user(session)
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Explainable Clinical Decision Support System for Medical Imaging",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register central routers
app.include_router(api_router, prefix=settings.API_PREFIX)
app.include_router(auth_router, prefix=settings.API_PREFIX)

@app.get("/")
async def root() -> dict:
    """
    Root endpoint returning basic application information.
    """
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
