import uuid
import pytest
from pydantic import ValidationError
from app.schemas.content_authoring import (
    ContentType,
    ResponseType,
    ActivityType,
    CognitiveLevel,
    EvidenceRole,
    StoredBlock,
    LearnerBlock,
    LearnerBlockSerializer,
)


def test_closed_canonical_enums_reject_unknown_values():
    """Test unknown strings fail validation with ValidationError."""
    with pytest.raises(ValidationError):
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=0,
            content_type="UNKNOWN_CONTENT_TYPE",  # Invalid
            content={"text": "hello"},
            response_type=ResponseType.NONE,
        )

    with pytest.raises(ValidationError):
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=0,
            content_type=ContentType.HEADING,
            content={"text": "hello"},
            response_type="BANANA",  # Invalid
        )

    with pytest.raises(ValidationError):
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=0,
            content_type=ContentType.TEXT,
            content={"text": "hello"},
            activity_type="NOT_AN_ACTIVITY",  # Invalid
            response_type=ResponseType.NONE,
        )


def test_pure_content_rejects_evaluation_and_options():
    """Pure content blocks must not have evaluation secrets or options."""
    opt_id = str(uuid.uuid4())
    # Reject evaluation on NONE
    with pytest.raises(ValidationError) as exc:
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=0,
            content_type=ContentType.HEADING,
            content={"title": "Introduction"},
            response_type=ResponseType.NONE,
            evaluation={"correct_option_id": opt_id},
        )
    assert "Pure content blocks (response_type=NONE) must not have evaluation rules" in str(exc.value)

    # Reject options on NONE
    with pytest.raises(ValidationError) as exc:
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=0,
            content_type=ContentType.TEXT,
            content={"text": "Some text"},
            response_type=ResponseType.NONE,
            options=[{"id": opt_id, "text": "A"}],
        )
    assert "Pure content blocks must not define options" in str(exc.value)


def test_single_choice_requires_valid_options_and_answer_key():
    """SINGLE_CHOICE requires >= 2 options and matching correct_option_id."""
    opt1 = str(uuid.uuid4())
    opt2 = str(uuid.uuid4())

    # Fails if < 2 options
    with pytest.raises(ValidationError) as exc:
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=1,
            content_type=ContentType.SCENARIO,
            content={"prompt": "Choose"},
            activity_type=ActivityType.APPLICATION,
            response_type=ResponseType.SINGLE_CHOICE,
            options=[{"id": opt1, "text": "Only one"}],
            evaluation={"correct_option_id": opt1},
        )
    assert "SINGLE_CHOICE requires at least 2 options" in str(exc.value)

    # Fails if correct_option_id not in options
    with pytest.raises(ValidationError) as exc:
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=1,
            content_type=ContentType.SCENARIO,
            content={"prompt": "Choose"},
            response_type=ResponseType.SINGLE_CHOICE,
            options=[{"id": opt1, "text": "A"}, {"id": opt2, "text": "B"}],
            evaluation={"correct_option_id": str(uuid.uuid4())},  # Non-existent
        )
    assert "evaluation.correct_option_id must match a valid option ID" in str(exc.value)

    # Valid SINGLE_CHOICE passes
    valid_block = StoredBlock(
        id=str(uuid.uuid4()),
        order_index=1,
        content_type=ContentType.SCENARIO,
        content={"prompt": "Choose"},
        activity_type=ActivityType.APPLICATION,
        cognitive_level=CognitiveLevel.APPLY,
        response_type=ResponseType.SINGLE_CHOICE,
        options=[{"id": opt1, "text": "A"}, {"id": opt2, "text": "B"}],
        evaluation={"correct_option_id": opt1},
    )
    assert valid_block.response_type == ResponseType.SINGLE_CHOICE


def test_image_selection_requires_media_asset_ids_and_answer_key():
    """IMAGE_SELECTION requires media_asset_id on every option."""
    opt1 = str(uuid.uuid4())
    opt2 = str(uuid.uuid4())
    asset_id = str(uuid.uuid4())

    # Fails when option lacks media_asset_id
    with pytest.raises(ValidationError) as exc:
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=2,
            content_type=ContentType.TEXT,
            response_type=ResponseType.IMAGE_SELECTION,
            options=[{"id": opt1, "text": "Candle 1"}, {"id": opt2, "media_asset_id": asset_id}],
            evaluation={"correct_option_id": opt2},
        )
    assert "Every IMAGE_SELECTION option must define a valid media_asset_id" in str(exc.value)

    # Valid IMAGE_SELECTION passes
    valid_block = StoredBlock(
        id=str(uuid.uuid4()),
        order_index=2,
        content_type=ContentType.TEXT,
        response_type=ResponseType.IMAGE_SELECTION,
        options=[
            {"id": opt1, "media_asset_id": str(uuid.uuid4()), "label": "A"},
            {"id": opt2, "media_asset_id": str(uuid.uuid4()), "label": "B"},
        ],
        evaluation={"correct_option_id": opt1},
    )
    assert valid_block.response_type == ResponseType.IMAGE_SELECTION


def test_true_false_requires_two_options():
    """TRUE_FALSE requires exactly 2 options."""
    opt1 = str(uuid.uuid4())
    opt2 = str(uuid.uuid4())
    opt3 = str(uuid.uuid4())

    with pytest.raises(ValidationError) as exc:
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=3,
            content_type=ContentType.TEXT,
            response_type=ResponseType.TRUE_FALSE,
            options=[{"id": opt1, "text": "T"}, {"id": opt2, "text": "F"}, {"id": opt3, "text": "Maybe"}],
            evaluation={"correct_option_id": opt1},
        )
    assert "TRUE_FALSE requires exactly 2 options" in str(exc.value)


def test_mastery_evidence_requires_interactive_type_and_key():
    """MASTERY_EVIDENCE cannot be attached to pure content."""
    with pytest.raises(ValidationError) as exc:
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=4,
            content_type=ContentType.CALLOUT,
            content={"takeaway": "Important rule"},
            response_type=ResponseType.NONE,
            evidence_role=EvidenceRole.MASTERY_EVIDENCE,
        )
    assert "MASTERY_EVIDENCE requires an interactive response_type" in str(exc.value)


def test_image_requires_media_reference():
    """ContentType.IMAGE requires media_asset_id."""
    with pytest.raises(ValidationError) as exc:
        StoredBlock(
            id=str(uuid.uuid4()),
            order_index=5,
            content_type=ContentType.IMAGE,
            content={"caption": "Chart"},
            response_type=ResponseType.NONE,
        )
    assert "IMAGE blocks require a media_asset_id" in str(exc.value)


def test_learner_block_serializer_sanitizes_all_interactive_types():
    """LearnerBlockSerializer scrubs evaluation, correct_option_id, and is_correct flags."""
    opt1 = str(uuid.uuid4())
    opt2 = str(uuid.uuid4())

    # 1. SINGLE_CHOICE test
    mcq_block = StoredBlock(
        id=str(uuid.uuid4()),
        order_index=0,
        content_type=ContentType.SCENARIO,
        content={"prompt": "What is the open?"},
        response_type=ResponseType.SINGLE_CHOICE,
        options=[
            {"id": opt1, "text": "100", "is_correct": True},
            {"id": opt2, "text": "110", "is_correct": False},
        ],
        evaluation={"correct_option_id": opt1, "misconception_map": {opt2: "Wrong!"}},
    )
    serialized_mcq = LearnerBlockSerializer.serialize(mcq_block)
    assert "evaluation" not in serialized_mcq
    assert "correct_option_id" not in serialized_mcq
    assert serialized_mcq["is_interactive"] is True
    for opt in serialized_mcq["options"]:
        assert "is_correct" not in opt
        assert "evaluation" not in opt

    # 2. IMAGE_SELECTION test
    img_block = StoredBlock(
        id=str(uuid.uuid4()),
        order_index=1,
        content_type=ContentType.TEXT,
        response_type=ResponseType.IMAGE_SELECTION,
        options=[
            {"id": opt1, "media_asset_id": str(uuid.uuid4()), "is_correct": True},
            {"id": opt2, "media_asset_id": str(uuid.uuid4()), "is_correct": False},
        ],
        evaluation={"correct_option_id": opt1},
    )
    serialized_img = LearnerBlockSerializer.serialize(img_block)
    assert "evaluation" not in serialized_img
    assert "correct_option_id" not in serialized_img
    for opt in serialized_img["options"]:
        assert "is_correct" not in opt

    # 3. Pure Content test
    content_block = StoredBlock(
        id=str(uuid.uuid4()),
        order_index=2,
        content_type=ContentType.ANALOGY,
        content={"metaphor": "The starting line"},
        response_type=ResponseType.NONE,
    )
    serialized_content = LearnerBlockSerializer.serialize(content_block)
    assert serialized_content["is_interactive"] is False
    assert "evaluation" not in serialized_content
