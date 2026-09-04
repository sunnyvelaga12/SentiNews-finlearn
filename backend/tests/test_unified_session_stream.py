import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_unified_session_stream_and_curriculum_flexibility():
    """
    Validates:
    1. Creating custom modules and units dynamically (not hardcoded).
    2. Authoring a flexible lesson with mixed pure-content and interactive blocks.
    3. Publishing with atomic ContentProjectionService.
    4. Option B Unified Stream generation (pure content has is_interactive=False, interactive has is_interactive=True).
    5. Session progress tracking and exact resume position.
    6. Attempt evaluation on interactive blocks.
    7. Full tree verification across all modules.
    """
    admin_id = uuid.uuid4()
    editor_token, _ = create_access_token(str(admin_id), role="SUPER_ADMIN")
    headers = {
        "Authorization": f"Bearer {editor_token}",
        "Origin": "http://localhost:5173",
        "X-CSRF-Token": "valid_csrf_token",
        "X-Requested-With": "XMLHttpRequest",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        unique_suffix = uuid.uuid4().hex[:6]
        # 1. Create a brand new custom module (Flexible Curriculum!)
        mod_resp = await ac.post(
            "/api/v1/curriculum/modules",
            json={
                "name": f"Market Macro {unique_suffix}",
                "description": "Understanding interest rates, inflation, and monetary liquidity.",
            },
            headers=headers,
        )
        assert mod_resp.status_code == 200, f"Failed: {mod_resp.text}"
        mod_data = mod_resp.json()
        assert mod_data["status"] == "SUCCESS"
        module_id = mod_data["module_id"]

        # 2. Create a brand new unit in this module
        unit_resp = await ac.post(
            "/api/v1/curriculum/units",
            json={
                "module_id": module_id,
                "name": f"Unit 1: The Liquidity Cycle {unique_suffix}",
                "description": "How repo rates impact banking reserves.",
            },
            headers=headers,
        )
        assert unit_resp.status_code == 200, f"Failed: {unit_resp.text}"
        unit_data = unit_resp.json()
        unit_id = unit_data["unit_id"]

        # 3. Create a flexible lesson draft with mixed content & interactive blocks
        opt_a = str(uuid.uuid4())
        opt_b = str(uuid.uuid4())
        draft_payload = {
            "title": f"Repo Rates & Market Liquidity {unique_suffix}",
            "unit_id": unit_id,
            "blocks": [
                {
                    "id": "block_1",
                    "order_index": 1,
                    "content_type": "HEADING",
                    "response_type": "NONE",
                    "activity_type": "EXPERIENCE",
                    "content": {"title": "The Liquidity Tap", "level": 1},
                },
                {
                    "id": "block_2",
                    "order_index": 2,
                    "content_type": "TEXT",
                    "response_type": "NONE",
                    "activity_type": "EXPERIENCE",
                    "content": {"body": "When central banks raise repo rates, overnight commercial lending costs increase."},
                },
                {
                    "id": "block_3",
                    "order_index": 3,
                    "content_type": "CALLOUT",
                    "response_type": "NONE",
                    "activity_type": "EXPERIENCE",
                    "content": {"takeaway": "Higher repo rates drain surplus market liquidity."},
                },
                {
                    "id": "block_4",
                    "order_index": 4,
                    "content_type": "TEXT",
                    "response_type": "SINGLE_CHOICE",
                    "activity_type": "PRACTICE",
                    "content": {"prompt": "What immediately happens to short-term bond yields when repo rates rise?"},
                    "options": [
                        {"id": opt_a, "text": "They rise to reflect higher cost of capital."},
                        {"id": opt_b, "text": "They instantly drop to zero."},
                    ],
                    "evaluation": {
                        "correct_option_id": opt_a,
                        "explanation": "Yields rise alongside short-term policy rate hikes.",
                    },
                },
            ],
            "questions": [],
        }

        draft_res = await ac.post("/api/v1/admin/lessons/draft", json=draft_payload, headers=headers)
        assert draft_res.status_code == 200, f"Draft creation failed: {draft_res.text}"
        draft_data = draft_res.json()
        lesson_id = draft_data["lesson_id"]
        version_id = draft_data["version_id"]

        # 4. Verify curriculum tree shows our new module, unit, and lesson!
        tree_res = await ac.get("/api/v1/curriculum/admin/tree", headers=headers)
        assert tree_res.status_code == 200
        tree_data = tree_res.json()["tree"]
        all_modules = [m for d in tree_data for w in d.get("worlds", []) for s in w.get("series", []) for m in s.get("modules", [])]
        target_mod = next((m for m in all_modules if m["id"] == module_id), None)
        assert target_mod is not None, "New module must be present in curriculum tree"
        assert any(u["id"] == unit_id for u in target_mod["units"]), "New unit must be present in module"
        target_unit = next(u for u in target_mod["units"] if u["id"] == unit_id)
        assert any(l["id"] == lesson_id for l in target_unit["lessons"]), "New lesson must be present in unit"

        # 5. Publish the lesson
        pub_res = await ac.post(
            f"/api/v1/lessons/{lesson_id}/publish",
            json={"version_id": version_id, "notes": "Flexible lesson publication."},
            headers=headers,
        )
        assert pub_res.status_code == 200, f"Publish failed: {pub_res.text}"

        # 6. Create a learning session for this published lesson
        user_id = uuid.UUID("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
        sess_res = await ac.post(
            "/api/v1/learning/sessions",
            json={"lesson_version_id": version_id},
            params={"user_id": str(user_id)},
        )
        assert sess_res.status_code == 201, f"Session create failed: {sess_res.text}"
        sess_data = sess_res.json()
        session_id = sess_data["session_id"]
        items = sess_data["items"]

        # Check Option B Unified Stream characteristics:
        assert len(items) == 4
        # Pure-content blocks:
        assert items[0]["is_interactive"] is False
        assert items[0]["activity_id"] is None
        assert items[0]["position"] == 1
        assert items[1]["is_interactive"] is False
        assert items[2]["is_interactive"] is False

        # Interactive block:
        assert items[3]["is_interactive"] is True
        assert items[3]["activity_id"] is not None
        assert items[3]["position"] == 4
        # Assert NO secret answers leaked!
        assert "evaluation" not in items[3]["payload"]
        assert "correct_option_id" not in items[3]["payload"]

        # 7. Update session progress to card 3 (resuming on pure-content block)
        prog_res = await ac.post(
            f"/api/v1/learning/sessions/{session_id}/progress",
            json={"position": 3},
            params={"user_id": str(user_id)},
        )
        assert prog_res.status_code == 200, f"Progress failed ({prog_res.status_code}): {prog_res.text}"

        # 8. Fetch session: verifies resume_position and reconstructed stream
        get_sess_res = await ac.get(f"/api/v1/learning/sessions/{session_id}")
        assert get_sess_res.status_code == 200
        get_sess_data = get_sess_res.json()
        assert get_sess_data["resume_position"] == 3
        assert len(get_sess_data["items"]) == 4

        # 9. Submit attempt for the interactive block
        attempt_res = await ac.post(
            f"/api/v1/learning/sessions/{session_id}/activities/{items[3]['activity_id']}/attempts",
            json={"response": {"selected_option_id": opt_a}},
            params={"user_id": str(user_id)},
        )
        assert attempt_res.status_code == 200, f"Attempt failed: {attempt_res.text}"
        attempt_data = attempt_res.json()
        assert attempt_data.get("is_correct") is True or attempt_data.get("score", 0) > 0
