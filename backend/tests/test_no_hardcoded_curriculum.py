"""
test_no_hardcoded_curriculum.py

P0 Architectural Acceptance Tests — SentiNews Learn LCMS

INV-001: No curriculum-specific string literals may exist as branching conditions
         in backend/app/**. All curriculum meaning must originate from DB rows.

INV-002: Dynamic module creation — a completely new domain module (Financial Statements,
         Valuation, etc.) must be creatable via POST /curriculum/modules with its own
         DB-persisted metadata, and retrieved verbatim — zero code changes required.

Acceptance criterion: NEW CURRICULUM = DATABASE CONTENT, NOT NEW PYTHON/REACT CODE.
"""
import ast
import os
import json
import uuid
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

# ── Path Fixtures ─────────────────────────────────────────────────────────────

APP_DIR = Path(__file__).parent.parent / "app"
CURRICULUM_API_FILE = APP_DIR / "api" / "v1" / "curriculum.py"

# ── INV-001 : Static AST Check — No Hardcoded Curriculum Branches ─────────────

# Curriculum-specific string literals that must NOT appear as branching predicates
# in any application-layer Python file. These are domain names, module titles, and
# learning copy that must live exclusively in DB rows.
FORBIDDEN_CURRICULUM_LITERALS = [
    "market",                  # was used in: "market" in mod.slug.lower()
    "Candlestick Foundations",
    "candlestick",
    "OPEN",                    # as a market state string used in branching
    "market analysis",
    "Financial Statements",    # must NOT be in code as a branch predicate
    "Revenue",                 # must NOT be in code as a branch predicate
    "order book",
    "bid-ask",
    "Candlestick Price Action",
    "Order Book & Market Microstructure",
]


def _collect_string_if_comparisons(tree: ast.Module) -> list[str]:
    """
    Walk the AST and find any `str in obj.attr.lower()` comparisons or
    string literals used directly in if-conditions. Returns a list of
    found forbidden literals.
    """
    violations = []
    for node in ast.walk(tree):
        # Check `if X in Y.lower()` patterns — this is the exact anti-pattern removed
        if isinstance(node, ast.Compare):
            for comp_val in [node.left] + node.comparators:
                if isinstance(comp_val, ast.Constant) and isinstance(comp_val.value, str):
                    for forbidden in FORBIDDEN_CURRICULUM_LITERALS:
                        if forbidden.lower() in comp_val.value.lower():
                            violations.append(
                                f"Forbidden curriculum literal '{comp_val.value}' "
                                f"found in comparison expression (line {node.lineno})"
                            )
    return violations


def test_no_hardcoded_curriculum_branches_in_app_layer():
    """
    INV-001: AST-level scan of backend/app/**/*.py files.

    Verifies that no application Python file contains curriculum-specific string
    literals used as branching conditions. The scan looks for Compare nodes where
    the left or right operand is a forbidden curriculum string constant.

    This test will catch regressions where someone re-introduces slug-based
    heuristics to infer curriculum meaning from module/lesson names.
    """
    # Only scan application logic (api, services, models, schemas, core, etc.)
    # Exclude DB seeding scripts which intentionally populate seed fixtures
    app_py_files = [
        p for p in APP_DIR.rglob("*.py")
        if "seed" not in p.name.lower() and "db" not in p.parts
    ]
    assert len(app_py_files) > 0, "No Python files found under backend/app/"

    all_violations = []
    for py_file in app_py_files:
        try:
            source = py_file.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=str(py_file))
            violations = _collect_string_if_comparisons(tree)
            for v in violations:
                all_violations.append(f"{py_file.relative_to(APP_DIR.parent.parent)}: {v}")
        except SyntaxError:
            # If a file has a syntax error, it will fail at import time — skip here
            pass

    assert all_violations == [], (
        "HARDCODED CURRICULUM BRANCHES DETECTED in application layer.\n"
        "All curriculum content must come from DB records, not code.\n"
        "Violations:\n" + "\n".join(all_violations)
    )


def test_curriculum_api_file_has_no_slug_based_branching():
    """
    Targeted check: curriculum.py specifically must not contain `is_market_basics`
    or any slug-substring conditional that was the original P0 violation.
    """
    source = CURRICULUM_API_FILE.read_text(encoding="utf-8")
    assert "is_market_basics" not in source, (
        "curriculum.py still contains `is_market_basics` slug-based branching. "
        "This must be removed — curriculum content must come from DB."
    )
    assert '"market" in mod.slug' not in source, (
        "curriculum.py still contains '\"market\" in mod.slug' slug-based branching."
    )
    assert "'market' in mod.slug" not in source, (
        "curriculum.py still contains \"'market' in mod.slug\" slug-based branching."
    )
    # The fallback strings allowed are generic module-name interpolations, not fixed strings
    forbidden_fixed_strings = [
        "order book depth, liquidity",
        "bid-ask spread mechanics",
        "single candle anatomy",
        "Candlestick Price Action Reading",
        "Order Book & Market Microstructure Analysis",
        "OHLC behavior",
        "intraperiod price discovery",
    ]
    for s in forbidden_fixed_strings:
        assert s not in source, (
            f"curriculum.py still contains hardcoded curriculum string: '{s}'. "
            f"This must be removed and replaced with DB-backed values."
        )


# ── INV-002 : Dynamic Module Creation Acceptance Test ─────────────────────────

import httpx
import pytest_asyncio

@pytest_asyncio.fixture(autouse=True)
async def clean_engine():
    yield
    from app.core.database import engine
    await engine.dispose()

@pytest_asyncio.fixture
async def async_client():
    from app.main import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_dynamic_module_creation_financial_statements(async_client):
    """
    INV-002: ACCEPTANCE TEST — Dynamic Module Creation.

    Creates a 'Financial Statements' module (completely different domain from
    the original Candlestick/Trading content) with its own:
    - learner_goal
    - why_this_matters
    - learning_outcomes

    Then retrieves it via GET /curriculum/modules/{slug} and asserts:
    1. The persisted metadata values are returned exactly as authored.
    2. No hardcoded Candlestick/Trading content is present in the response.
    3. The response does NOT contain any of the original hardcoded strings.

    This is the architectural acceptance criterion:
    NEW CURRICULUM = DATABASE CONTENT, NOT NEW PYTHON CODE.
    """
    # 1. Create the Financial Statements module
    test_slug = f"financial-statements-{uuid.uuid4().hex[:6]}"
    create_payload = {
        "name": "Financial Statements",
        "slug": test_slug,
        "description": "Master the three core financial statements used in fundamental analysis.",
        "learner_goal": (
            "Read and interpret an income statement, balance sheet, and cash flow statement "
            "for any publicly listed company without assistance."
        ),
        "why_this_matters": (
            "Every investment decision ultimately rests on the financial health of a business. "
            "Understanding financial statements is the bedrock skill of fundamental analysis."
        ),
        "learning_outcomes": [
            "Identify the three core financial statements and their distinct purpose.",
            "Calculate gross profit, operating income, and net income from an income statement.",
            "Distinguish current assets from non-current assets on a balance sheet.",
            "Explain why cash flow from operations is a better solvency signal than net income.",
            "Detect accounting red flags by comparing earnings to operating cash flow.",
        ],
        "completion_criteria": (
            "Complete all unit milestones and pass the Financial Statements Capstone "
            "with >= 80% demonstrating ability to analyze real company financials."
        ),
        "estimated_hours": 2.5,
        "level": "BEGINNER",
        "order_index": 99,
    }
    create_resp = await async_client.post(
        "/api/v1/curriculum/modules",
        json=create_payload,
        headers={"x-user-id": "b0370776-dcc9-449a-8bbb-b4d0cf9e9494"},
    )
    assert create_resp.status_code == 200, (
        f"Module creation failed: {create_resp.status_code} — {create_resp.text}"
    )
    created = create_resp.json()
    assert created["status"] == "SUCCESS"
    module_slug = created["slug"]

    # 2. Retrieve the module via slug
    get_resp = await async_client.get(
        f"/api/v1/curriculum/modules/{module_slug}",
        headers={"x-user-id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"},
    )
    assert get_resp.status_code == 200, (
        f"Module retrieval failed: {get_resp.status_code} — {get_resp.text}"
    )
    module_data = get_resp.json()

    # 3. Assert the authored metadata is returned verbatim from DB
    assert module_data["learner_goal"] == create_payload["learner_goal"], (
        f"learner_goal was not persisted/returned correctly.\n"
        f"Expected: {create_payload['learner_goal']}\n"
        f"Got: {module_data['learner_goal']}"
    )
    assert module_data["why_this_matters"] == create_payload["why_this_matters"], (
        "why_this_matters was not persisted/returned correctly."
    )
    assert module_data["learning_outcomes"] == create_payload["learning_outcomes"], (
        "learning_outcomes was not persisted/returned correctly."
    )

    # 4. Assert NONE of the original hardcoded Candlestick/Trading strings appear
    response_text = json.dumps(module_data)
    forbidden_in_response = [
        "order book depth",
        "bid-ask spread",
        "single candle anatomy",
        "OHLC",
        "Candlestick Price Action",
        "Order Book & Market Microstructure",
        "intraperiod price discovery",
        "candle anatomy",
        "market basics",
    ]
    for forbidden in forbidden_in_response:
        assert forbidden.lower() not in response_text.lower(), (
            f"HARDCODED CURRICULUM LEAK: Response for 'Financial Statements' module "
            f"contains forbidden string '{forbidden}'. "
            f"This means hardcoded curriculum content is still being injected from "
            f"application code rather than being read from DB."
        )

    # 5. Assert title reflects authoring, not hardcoded copy
    assert module_data["title"] == "Financial Statements"


@pytest.mark.asyncio
async def test_dynamic_module_update_metadata(async_client):
    """
    Verifies that PATCH /curriculum/modules/{module_id} correctly updates
    all pedagogical metadata fields via DB, not code.
    """
    # Create a module first
    slug = f"valuation-{uuid.uuid4().hex[:6]}"
    create_resp = await async_client.post(
        "/api/v1/curriculum/modules",
        json={"name": "Valuation", "slug": slug},
        headers={"x-user-id": "b0370776-dcc9-449a-8bbb-b4d0cf9e9494"},
    )
    assert create_resp.status_code == 200
    module_id = create_resp.json()["module_id"]

    # Update with full metadata
    patch_resp = await async_client.patch(
        f"/api/v1/curriculum/modules/{module_id}",
        json={
            "learner_goal": "Value any company using DCF, comparables, and precedent transactions.",
            "why_this_matters": "Valuation determines whether a stock is worth buying at its current price.",
            "learning_outcomes": [
                "Calculate intrinsic value using a discounted cash flow model.",
                "Apply EV/EBITDA multiples for comparable company analysis.",
            ],
            "level": "INTERMEDIATE",
            "estimated_hours": 3.0,
        },
        headers={"x-user-id": "b0370776-dcc9-449a-8bbb-b4d0cf9e9494"},
    )
    assert patch_resp.status_code == 200, f"PATCH failed: {patch_resp.text}"

    # Verify by reading back
    get_resp = await async_client.get(
        f"/api/v1/curriculum/modules/{slug}",
        headers={"x-user-id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"},
    )
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["learner_goal"] == "Value any company using DCF, comparables, and precedent transactions."
    assert data["level"] == "INTERMEDIATE"
    assert data["estimated_hours"] == 3.0
    assert len(data["learning_outcomes"]) == 2


def test_manifest_is_valid_json_and_covers_required_invariants():
    """
    Verifies test_manifest.json is valid JSON and contains all required
    invariant categories: dynamic_curriculum, block_schema, learner_sanitization,
    session_stream, media_security, objective_resolution, authorization,
    concurrency, publication, architecture.
    """
    manifest_path = Path(__file__).parent / "test_manifest.json"
    assert manifest_path.exists(), "test_manifest.json is missing"

    with open(manifest_path) as f:
        manifest = json.load(f)

    assert "invariants" in manifest, "manifest missing 'invariants' key"
    assert len(manifest["invariants"]) >= 20, (
        f"manifest has only {len(manifest['invariants'])} invariants; expected >= 20"
    )

    required_categories = {
        "architecture",
        "curriculum_data",
        "block_schema",
        "learner_sanitization",
        "session_stream",
        "media_security",
        "objective_resolution",
        "authorization",
        "concurrency",
        "publication",
        "evaluation",
        "preview_isolation",
    }
    found_categories = {inv["category"] for inv in manifest["invariants"]}
    missing = required_categories - found_categories
    assert not missing, f"test_manifest.json is missing invariant categories: {missing}"

    p0_count = sum(1 for inv in manifest["invariants"] if inv.get("severity") == "P0_BLOCKER")
    assert p0_count >= 10, (
        f"Expected >= 10 P0_BLOCKER invariants in manifest, found {p0_count}"
    )
