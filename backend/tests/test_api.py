from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.session import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSession = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "test@aeroquant.io",
        "username": "testuser",
        "password": "securepassword123",
    })
    assert reg.status_code == 201
    assert reg.json()["email"] == "test@aeroquant.io"

    login = await client.post("/api/v1/auth/login", json={
        "email": "test@aeroquant.io",
        "password": "securepassword123",
    })
    assert login.status_code == 200
    assert "access_token" in login.json()


@pytest.mark.asyncio
async def test_routes_endpoint(client: AsyncClient):
    response = await client.get("/api/v1/routes")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
