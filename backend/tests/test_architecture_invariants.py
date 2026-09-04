"""
Architecture Invariant Tests — AST and Structural Boundary Enforcement.
Ensures critical architectural contracts cannot be broken by future pull requests.
"""
import ast
import os
import pytest
from pathlib import Path

BACKEND_APP_DIR = Path(__file__).parent.parent / "app"


def test_no_lower_level_commits_in_pipeline():
    """
    INVARIANT: Sub-modules in services/learning/pipeline/ must never invoke
    db.commit() or db.rollback(). Only the top-level unit of work / orchestrator
    controls transactional commit/rollback boundaries.
    """
    pipeline_dir = BACKEND_APP_DIR / "services" / "learning" / "pipeline"
    exempt_files = {"orchestrator.py"}

    violations = []
    for py_file in pipeline_dir.glob("*.py"):
        if py_file.name in exempt_files or py_file.name.startswith("__"):
            continue

        content = py_file.read_text(encoding="utf-8")
        tree = ast.parse(content, filename=str(py_file))

        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                if node.func.attr in ("commit", "rollback"):
                    violations.append(f"{py_file.name}:{node.lineno} calls .{node.func.attr}()")

    assert not violations, f"Architectural violation: Lower-level pipeline files called commit/rollback: {violations}"


def test_core_learning_decoupled_from_auth_models():
    """
    INVARIANT: Core learning pipeline modules must remain decoupled from
    user authentication models (app.models.user.User - auth identity) and auth utilities (app.core.auth).
    UserProfile is permitted for streak/activity projection.
    """
    learning_dir = BACKEND_APP_DIR / "services" / "learning"

    violations = []
    for py_file in learning_dir.rglob("*.py"):
        if py_file.name.startswith("__"):
            continue

        content = py_file.read_text(encoding="utf-8")
        tree = ast.parse(content, filename=str(py_file))

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name == "app.core.auth" or alias.name == "app.models.user.User":
                        violations.append(f"{py_file.name}:{node.lineno} imports {alias.name}")
            elif isinstance(node, ast.ImportFrom):
                if node.module == "app.core.auth":
                    violations.append(f"{py_file.name}:{node.lineno} imports from app.core.auth")
                elif node.module == "app.models.user":
                    for name in node.names:
                        if name.name == "User":
                            violations.append(f"{py_file.name}:{node.lineno} imports User from app.models.user")

    assert not violations, f"Architectural violation: Core learning imported auth identity: {violations}"


def test_mark_lesson_completed_does_not_write_concept_mastery():
    """
    INVARIANT: mark_lesson_completed in LearnerCurriculumStateService must
    only write UserProgress. It must never directly insert, update, or mutate ConceptMastery.
    """
    service_file = BACKEND_APP_DIR / "services" / "curriculum" / "learner_curriculum_state_service.py"
    content = service_file.read_text(encoding="utf-8")
    tree = ast.parse(content, filename=str(service_file))

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "mark_lesson_completed":
            fn_code = ast.unparse(node)
            assert "pg_insert(ConceptMastery)" not in fn_code, "mark_lesson_completed must not insert ConceptMastery"
            assert "ConceptMastery.values" not in fn_code, "mark_lesson_completed must not write ConceptMastery"
            assert "pg_insert(UserProgress)" in fn_code, "mark_lesson_completed must insert UserProgress"


def test_active_models_metadata_registration():
    """
    INVARIANT: All active SQLAlchemy domain models must be cleanly registered in Base.metadata.
    """
    from app.core.database import Base
    import app.models  # central import registry

    table_names = set(Base.metadata.tables.keys())
    expected_core_tables = {
        "users",
        "user_profiles",
        "refresh_sessions",
        "domains",
        "worlds",
        "series",
        "modules",
        "units",
        "unit_concepts",
        "concepts",
        "concept_relationships",
        "lessons",
        "lesson_versions",
        "learning_objectives",
        "learning_activities",
        "learning_sessions",
        "learning_session_items",
        "learning_attempts",
        "user_progress",
        "concept_mastery",
        "review_items",
        "review_attempts",
        "audit_logs",
        "telemetry_events",
        "idempotency_records",
    }

    assert expected_core_tables.issubset(table_names), (
        f"Missing expected tables in Base.metadata: {expected_core_tables - table_names}"
    )
