from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.conductor import router as conductor_router
from app.api.v1.smartsync import router as smartsync_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.routes import router as routes_router
from app.api.v1.tickets import router as tickets_router
from app.api.v1.trips import router as trips_router
from app.config import settings
from app.core.exceptions import DomainException
from app.database import init_db
from app.seed import seed_data
from app.services.expiry_job import expire_below_threshold_trips


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and seed default development data
    await init_db()
    try:
        await seed_data()
    except Exception as e:
        print(f"Warning during seed: {e}")
    yield
    # Shutdown logic if needed


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="RailBus Core Backend & Conductor API Engine",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers
@app.exception_handler(DomainException)
async def domain_exception_handler(request: Request, exc: DomainException):
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail
    )


# Include API v1 Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(routes_router, prefix=settings.API_V1_STR)
app.include_router(trips_router, prefix=settings.API_V1_STR)
app.include_router(bookings_router, prefix=settings.API_V1_STR)
app.include_router(tickets_router, prefix=settings.API_V1_STR)
app.include_router(conductor_router, prefix=settings.API_V1_STR)
app.include_router(smartsync_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)



@app.get("/")
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "threshold_activation": settings.DEMAND_ACTIVATION_THRESHOLD,
        "version": settings.VERSION
    }
