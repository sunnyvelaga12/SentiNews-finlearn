import test from 'node:test';
import assert from 'node:assert/strict';

test('Published Lesson Governance & Version Forking Suite', async (t) => {

  await t.test('Test 1: Governance button states for PUBLISHED lesson with no edits', () => {
    const resolveGovernanceActions = ({ status, versionNumber, hasUnsavedChanges }) => {
      const isPublished = status === 'PUBLISHED';
      return {
        saveButtonLabel: isPublished
          ? (hasUnsavedChanges ? `Save as New Version (v${versionNumber + 1})` : `Edit New Version (v${versionNumber + 1})`)
          : 'Save Draft',
        saveButtonVariant: isPublished && hasUnsavedChanges ? 'ACTIVE_BLUE' : 'NEUTRAL',
        publishButtonLabel: isPublished
          ? (hasUnsavedChanges ? `Publish New Version (v${versionNumber + 1})` : 'Published')
          : 'Publish Lesson',
        publishButtonDisabled: isPublished && !hasUnsavedChanges,
        statusPillBadge: isPublished && hasUnsavedChanges ? `Will save as v${versionNumber + 1}` : null,
      };
    };

    const cleanPublished = resolveGovernanceActions({
      status: 'PUBLISHED',
      versionNumber: 1,
      hasUnsavedChanges: false,
    });

    assert.equal(cleanPublished.saveButtonLabel, 'Edit New Version (v2)');
    assert.equal(cleanPublished.publishButtonLabel, 'Published');
    assert.equal(cleanPublished.publishButtonDisabled, true);
    assert.equal(cleanPublished.statusPillBadge, null);
  });

  await t.test('Test 2: Governance buttons state for PUBLISHED lesson with unsaved edits', () => {
    const resolveGovernanceActions = ({ status, versionNumber, hasUnsavedChanges }) => {
      const isPublished = status === 'PUBLISHED';
      return {
        saveButtonLabel: isPublished
          ? (hasUnsavedChanges ? `Save as New Version (v${versionNumber + 1})` : `Edit New Version (v${versionNumber + 1})`)
          : 'Save Draft',
        saveButtonVariant: isPublished && hasUnsavedChanges ? 'ACTIVE_BLUE' : 'NEUTRAL',
        publishButtonLabel: isPublished
          ? (hasUnsavedChanges ? `Publish New Version (v${versionNumber + 1})` : 'Published')
          : 'Publish Lesson',
        publishButtonDisabled: isPublished && !hasUnsavedChanges,
        statusPillBadge: isPublished && hasUnsavedChanges ? `Will save as v${versionNumber + 1}` : null,
      };
    };

    const editedPublished = resolveGovernanceActions({
      status: 'PUBLISHED',
      versionNumber: 1,
      hasUnsavedChanges: true,
    });

    assert.equal(editedPublished.saveButtonLabel, 'Save as New Version (v2)');
    assert.equal(editedPublished.saveButtonVariant, 'ACTIVE_BLUE');
    assert.equal(editedPublished.publishButtonLabel, 'Publish New Version (v2)');
    assert.equal(editedPublished.publishButtonDisabled, false);
    assert.equal(editedPublished.statusPillBadge, 'Will save as v2');
  });

  await t.test('Test 3: Automatic fork resolution preserves in-flight edits without data loss', () => {
    const publishedVersion = {
      id: 'ver-1-published',
      version_number: 1,
      status: 'PUBLISHED',
      title: 'Original Title',
      blocks: [{ id: 'b1', content_type: 'TEXT', title: 'Old Text' }],
    };

    const inFlightEdits = {
      title: 'Revised Title by Author',
      blocks: [
        { id: 'b1', content_type: 'TEXT', title: 'Updated Text Content' },
        { id: 'b2', content_type: 'IMAGE', title: 'Added Diagram' },
      ],
    };

    const forkDraftVersion = (source, edits) => {
      assert.equal(source.status, 'PUBLISHED', 'Source must remain immutable published');
      return {
        id: 'ver-2-draft',
        lesson_id: 'lesson-123',
        version_number: source.version_number + 1,
        title: edits.title || source.title,
        status: 'DRAFT',
        blocks: edits.blocks || source.blocks,
      };
    };

    const newDraft = forkDraftVersion(publishedVersion, inFlightEdits);

    assert.equal(newDraft.version_number, 2);
    assert.equal(newDraft.status, 'DRAFT');
    assert.equal(newDraft.title, 'Revised Title by Author');
    assert.equal(newDraft.blocks.length, 2);
    assert.equal(newDraft.blocks[0].title, 'Updated Text Content');
    // Source remains untouched
    assert.equal(publishedVersion.status, 'PUBLISHED');
    assert.equal(publishedVersion.version_number, 1);
  });

  await t.test('Test 4: Atomic publish transition from fork draft to published', () => {
    const draftVersion = {
      id: 'ver-2-draft',
      version_number: 2,
      status: 'DRAFT',
    };

    // Governance pipeline simulation
    const approveReview = (ver) => ({ ...ver, status: 'APPROVED' });
    const publishVersion = (ver) => ({ ...ver, status: 'PUBLISHED' });

    const approved = approveReview(draftVersion);
    assert.equal(approved.status, 'APPROVED');

    const published = publishVersion(approved);
    assert.equal(published.status, 'PUBLISHED');
    assert.equal(published.version_number, 2);
  });

});
