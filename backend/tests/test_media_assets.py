import io
import pytest
from PIL import Image
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token


import random


def create_tiny_png() -> bytes:
    buf = io.BytesIO()
    r = random.randint(0, 255)
    g = random.randint(0, 255)
    b = random.randint(0, 255)
    img = Image.new("RGB", (100, 100), color=(r, g, b))
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_media_upload_png_success_and_deduplication():
    token, _ = create_access_token("00000000-0000-0000-0000-000000000001", role="SUPER_ADMIN")
    headers = {"Authorization": f"Bearer {token}"}
    png_bytes = create_tiny_png()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Upload valid PNG
        files = {"file": ("test_candlestick.png", png_bytes, "image/png")}
        res = await client.post("/api/v1/admin/media/upload", headers=headers, files=files)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["deduplicated"] is False
        assert data["width"] == 100
        assert data["height"] == 100
        assert data["mime_type"] == "image/png"
        assert "media_asset_id" in data
        first_id = data["media_asset_id"]

        # 2. Upload identical PNG (Deduplication test)
        files_dup = {"file": ("test_candlestick_dup.png", png_bytes, "image/png")}
        res_dup = await client.post("/api/v1/admin/media/upload", headers=headers, files=files_dup)
        assert res_dup.status_code == 200
        data_dup = res_dup.json()
        assert data_dup["deduplicated"] is True
        assert data_dup["media_asset_id"] == first_id

        # 3. List media assets
        res_list = await client.get("/api/v1/admin/media", headers=headers)
        assert res_list.status_code == 200
        list_data = res_list.json()
        assert any(m["media_asset_id"] == first_id for m in list_data["media"])


@pytest.mark.asyncio
async def test_media_upload_svg_rejected():
    token, _ = create_access_token("00000000-0000-0000-0000-000000000001", role="SUPER_ADMIN")
    headers = {"Authorization": f"Bearer {token}"}
    svg_bytes = b"<svg><circle cx='50' cy='50' r='40'/></svg>"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("malicious.svg", svg_bytes, "image/svg+xml")}
        res = await client.post("/api/v1/admin/media/upload", headers=headers, files=files)
        assert res.status_code == 400
        err_text = res.json().get("message", "") or res.json().get("detail", "")
        assert "SVG_DISABLED_FOR_SECURITY" in err_text


@pytest.mark.asyncio
async def test_media_upload_fake_extension_magic_byte_check():
    token, _ = create_access_token("00000000-0000-0000-0000-000000000001", role="SUPER_ADMIN")
    headers = {"Authorization": f"Bearer {token}"}
    fake_png_bytes = b"NOT_A_REAL_PNG_HEADER_JUST_TEXT"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("fake.png", fake_png_bytes, "image/png")}
        res = await client.post("/api/v1/admin/media/upload", headers=headers, files=files)
        assert res.status_code == 400
        err_text = res.json().get("message", "") or res.json().get("detail", "")
        assert "INVALID_FILE_SIGNATURE" in err_text
