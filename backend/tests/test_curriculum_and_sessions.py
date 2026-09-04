"""
Curriculum & Session Pinning Invariant Tests.
Validates session version pinning and lesson progression contracts.
"""
import uuid
import pytest
from app.models.learning import LearningSession
from app.models.lesson import Lesson, LessonVersion
from app.models.curriculum import Module, Unit


def test_session_version_pinning_contract():
    """
    INVARIANT: LearningSession must have a lesson_version_id field to pin
    the exact content version for the duration of the learner's session.
    """
    assert hasattr(LearningSession, "lesson_version_id"), "LearningSession must pin lesson_version_id"
    assert hasattr(LearningSession, "user_id"), "LearningSession must track user_id"


def test_lesson_version_content_blocks_contract():
    """
    INVARIANT: LessonVersion is the canonical declarative content authority
    and must store activity blocks in JSON format via blocks_json.
    """
    assert hasattr(LessonVersion, "blocks_json"), "LessonVersion must have blocks_json attribute"
    assert hasattr(LessonVersion, "status"), "LessonVersion must track version status"
    assert hasattr(LessonVersion, "version_number"), "LessonVersion must track version_number"


def test_curriculum_hierarchy_contract():
    """
    INVARIANT: Curriculum hierarchy must strictly model Module -> Unit -> Lesson.
    """
    assert hasattr(Module, "slug")
    assert hasattr(Unit, "module_id")
    assert hasattr(Lesson, "slug")
