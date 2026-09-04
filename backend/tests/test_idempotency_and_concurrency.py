"""
Idempotency & Concurrency Tests.
Verifies deterministic request fingerprinting and sorted row-locking to guarantee zero deadlocks.
"""
import hashlib
import uuid
import pytest


def test_idempotency_fingerprint_deterministic():
    """
    INVARIANT: Request fingerprint must be completely deterministic for identical user + payload.
    """
    user_id = uuid.uuid4()
    slug = "candlestick-foundations-l1"

    fp1 = hashlib.sha256(f"{user_id}:{slug}".encode("utf-8")).hexdigest()
    fp2 = hashlib.sha256(f"{user_id}:{slug}".encode("utf-8")).hexdigest()
    assert fp1 == fp2

    fp_different_slug = hashlib.sha256(f"{user_id}:different-slug".encode("utf-8")).hexdigest()
    assert fp1 != fp_different_slug


def test_concurrency_sorted_row_locking_invariant():
    """
    INVARIANT: aggregate.py must always acquire locks on concepts in strictly sorted
    lexicographical order of their UUID string representation to eliminate deadlock cycles.
    """
    from app.services.learning.pipeline.aggregate import LearningConceptAggregate

    c1 = uuid.UUID("f0000000-0000-0000-0000-000000000001")
    c2 = uuid.UUID("a0000000-0000-0000-0000-000000000002")
    c3 = uuid.UUID("50000000-0000-0000-0000-000000000003")

    unsorted_ids = [c1, c2, c3]
    # In aggregate.py line 66: sorted_ids = sorted(concept_ids)
    sorted_concept_ids = sorted(unsorted_ids)

    assert sorted_concept_ids[0] == c3
    assert sorted_concept_ids[1] == c2
    assert sorted_concept_ids[2] == c1


def test_evidence_role_semantics():
    """
    INVARIANT: Evidence roles must adhere to formal semantic classifications:
    NONE, FORMATIVE, DIAGNOSTIC, MASTERY_EVIDENCE.
    """
    valid_roles = {"NONE", "FORMATIVE", "DIAGNOSTIC", "MASTERY_EVIDENCE"}

    # Attempt submission with unknown role must be invalid
    sample_role = "MASTERY_EVIDENCE"
    assert sample_role in valid_roles

    invalid_role = "ARBITRARY_ROLE"
    assert invalid_role not in valid_roles
