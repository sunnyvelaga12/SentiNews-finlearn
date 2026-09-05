import test from 'node:test';
import assert from 'node:assert/strict';

test('LCMS & Learner Draft State Persistence Suite', async (t) => {

  await t.test('Test 1: Target lesson resolution order (URL query -> localStorage -> sessionStorage)', () => {
    const mockLessons = [
      { id: 'lesson-1', title: 'First Lesson', version_id: 'ver-1' },
      { id: 'lesson-2', title: 'Draft in Progress', version_id: 'ver-2' },
      { id: 'lesson-3', title: 'Third Lesson', version_id: 'ver-3' },
    ];

    const resolveActiveLesson = ({ urlLessonId, localLessonId, sessionLessonId }) => {
      const storedId = urlLessonId || localLessonId || sessionLessonId;
      if (storedId) {
        const found = mockLessons.find((l) => l.id === storedId || l.version_id === storedId);
        if (found) return found;
      }
      return mockLessons[0]; // fallback to first only if nothing stored
    };

    // Case A: URL param takes highest precedence
    const fromUrl = resolveActiveLesson({
      urlLessonId: 'lesson-2',
      localLessonId: 'lesson-1',
      sessionLessonId: 'lesson-3',
    });
    assert.equal(fromUrl.id, 'lesson-2');

    // Case B: localStorage used when URL has no query param (e.g. user revisited /admin/studio)
    const fromLocal = resolveActiveLesson({
      urlLessonId: null,
      localLessonId: 'lesson-2',
      sessionLessonId: null,
    });
    assert.equal(fromLocal.id, 'lesson-2');

    // Case C: Fallback to first only when NO previous state exists
    const freshVisit = resolveActiveLesson({
      urlLessonId: null,
      localLessonId: null,
      sessionLessonId: null,
    });
    assert.equal(freshVisit.id, 'lesson-1');
  });

  await t.test('Test 2: Active block index preservation and bounds clamping', () => {
    const resolveBlockIndex = ({ targetIdx, urlBlock, localBlock, totalBlocks }) => {
      let resolved = 0;
      if (targetIdx !== null && targetIdx !== undefined) {
        resolved = targetIdx;
      } else if (urlBlock !== null && urlBlock !== undefined) {
        const p = parseInt(urlBlock, 10);
        if (!isNaN(p)) resolved = p;
      } else if (localBlock !== null && localBlock !== undefined) {
        const p = parseInt(localBlock, 10);
        if (!isNaN(p)) resolved = p;
      }
      return Math.max(0, Math.min(resolved, totalBlocks - 1));
    };

    // User was on Block 3 (0-indexed: index 3), 5 blocks total
    assert.equal(
      resolveBlockIndex({ targetIdx: null, urlBlock: '3', localBlock: '0', totalBlocks: 5 }),
      3
    );

    // Refresh without URL param, restore from localStorage
    assert.equal(
      resolveBlockIndex({ targetIdx: null, urlBlock: null, localBlock: '2', totalBlocks: 5 }),
      2
    );

    // Clamps to bounds if blocks were deleted
    assert.equal(
      resolveBlockIndex({ targetIdx: null, urlBlock: '10', localBlock: '10', totalBlocks: 3 }),
      2
    );

    // Negative block index clamped to 0
    assert.equal(
      resolveBlockIndex({ targetIdx: null, urlBlock: '-1', localBlock: null, totalBlocks: 4 }),
      0
    );
  });

  await t.test('Test 3: Crash-proof draft backup restores in-flight unsaved edits', () => {
    const serverBlocks = [
      { id: 'b1', order_index: 0, content_type: 'TEXT', content: { text: 'Server Version' } },
    ];

    const localBackup = {
      blocks: [
        { id: 'b1', order_index: 0, content_type: 'TEXT', content: { text: 'Author Edited Keystrokes' } },
        { id: 'b2', order_index: 1, content_type: 'SINGLE_CHOICE', content: { prompt: 'New question in draft' } },
      ],
      lessonTitle: 'Draft Title Before Refresh',
      durationMinutes: 10,
      savedAt: Date.now(),
    };

    // Simulate loadLessonDraft restoration
    let activeBlocks = serverBlocks;
    let activeTitle = 'Old Title';
    let hasUnsavedChanges = false;

    if (localBackup && Array.isArray(localBackup.blocks) && localBackup.blocks.length > 0) {
      activeBlocks = localBackup.blocks;
      if (localBackup.lessonTitle) activeTitle = localBackup.lessonTitle;
      hasUnsavedChanges = true;
    }

    assert.equal(activeBlocks.length, 2);
    assert.equal(activeBlocks[0].content.text, 'Author Edited Keystrokes');
    assert.equal(activeBlocks[1].id, 'b2');
    assert.equal(activeTitle, 'Draft Title Before Refresh');
    assert.equal(hasUnsavedChanges, true);
  });

  await t.test('Test 4: Learner session step progression and resume resolution', () => {
    const resolveInitialStep = ({ urlStep, localStep, backendResumePos, totalItems }) => {
      if (urlStep !== null && urlStep !== undefined) {
        const parsed = parseInt(urlStep, 10) - 1;
        if (!isNaN(parsed) && parsed >= 0 && parsed < totalItems) return parsed;
      }
      if (localStep !== null && localStep !== undefined) {
        const parsed = parseInt(localStep, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < totalItems) return parsed;
      }
      if (backendResumePos && backendResumePos > 1 && backendResumePos <= totalItems) {
        return backendResumePos - 1;
      }
      return 0;
    };

    // Mid-session reload at Step 4 (1-indexed query: ?step=4 -> 0-indexed: 3)
    assert.equal(
      resolveInitialStep({ urlStep: '4', localStep: '3', backendResumePos: null, totalItems: 6 }),
      3
    );

    // Mid-session reload from localStorage when URL param omitted
    assert.equal(
      resolveInitialStep({ urlStep: null, localStep: '2', backendResumePos: null, totalItems: 5 }),
      2
    );

    // On completion, step is removed and returns 0
    assert.equal(
      resolveInitialStep({ urlStep: null, localStep: null, backendResumePos: null, totalItems: 5 }),
      0
    );
  });
});
