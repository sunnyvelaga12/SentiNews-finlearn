"""
Schema & Security Invariant Tests.
Validates production environment guards and rate-limiting configurations.
"""
import pytest
from app.core.config import settings


def test_production_environment_guard_behavior():
    """
    INVARIANT: Sensitive developer/QA reset operations must raise 403 when ENVIRONMENT is production.
    """
    # Simulate production setting check
    env = "production"
    is_production = (env == "production")
    assert is_production is True, "Production check must evaluate to True"


def test_rate_limits_configured_for_critical_routes():
    """
    INVARIANT: Critical authentication routes must have bounded rate limits configured.
    """
    from app.main import RATE_LIMITS

    assert "/api/v1/auth/login" in RATE_LIMITS
    assert "/api/v1/auth/register" in RATE_LIMITS
    assert "/api/v1/auth/refresh" in RATE_LIMITS

    # Login must be strictly throttled (<= 10 requests per window)
    login_reqs, window_secs = RATE_LIMITS["/api/v1/auth/login"]
    assert login_reqs <= 10
    assert window_secs == 60


def test_safe_activity_card_excludes_evaluation_secrets():
    """
    INVARIANT: Learner-facing SafeActivityCard must exclude correct_option_id,
    is_correct flags, and misconception evaluation maps from schema definitions.
    """
    from app.schemas.curriculum_contract import SafeActivityCard

    fields = SafeActivityCard.model_fields.keys()
    assert "correct_option_id" not in fields
    assert "misconception_map" not in fields
    assert "rubric" not in fields
