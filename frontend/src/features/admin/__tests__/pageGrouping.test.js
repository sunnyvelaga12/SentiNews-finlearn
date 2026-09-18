import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlock,
  groupBlocksIntoPages,
  generatePageId,
} from '../utils/blockRegistry.js';

test('Page-Grouping & Multi-Block Step Execution Suite', async (t) => {

  await t.test('Test 1: Backward compatibility — blocks with null page_id form individual solo steps', () => {
    const blocks = [
      createBlock('HEADING', 0),
      createBlock('TEXT', 1),
      createBlock('IMAGE', 2),
    ];

    const pages = groupBlocksIntoPages(blocks);
    assert.equal(pages.length, 3, '3 blocks with null page_id should produce 3 distinct steps');
    assert.equal(pages[0].pageNumber, 1);
    assert.equal(pages[1].pageNumber, 2);
    assert.equal(pages[2].pageNumber, 3);
    assert.equal(pages[0].blocks.length, 1);
    assert.equal(pages[1].blocks.length, 1);
    assert.equal(pages[2].blocks.length, 1);
  });

  await t.test('Test 2: Multi-block grouping — blocks sharing page_id merge into a single step', () => {
    const pageId1 = 'page_intro';
    const pageId2 = 'page_practice';

    const b0 = { ...createBlock('HEADING', 0), page_id: pageId1 };
    const b1 = { ...createBlock('TEXT', 1), page_id: pageId1 };
    const b2 = { ...createBlock('IMAGE', 2), page_id: pageId1 };
    const b3 = { ...createBlock('MCQ', 3), page_id: pageId2 };

    const pages = groupBlocksIntoPages([b0, b1, b2, b3]);
    assert.equal(pages.length, 2, '4 blocks across 2 pages should produce 2 steps');
    
    // Step 1
    assert.equal(pages[0].pageNumber, 1);
    assert.equal(pages[0].pageId, pageId1);
    assert.equal(pages[0].blocks.length, 3);
    assert.deepEqual(pages[0].blockIndices, [0, 1, 2]);
    assert.equal(pages[0].isInteractive, false);

    // Step 2
    assert.equal(pages[1].pageNumber, 2);
    assert.equal(pages[1].pageId, pageId2);
    assert.equal(pages[1].blocks.length, 1);
    assert.deepEqual(pages[1].blockIndices, [3]);
    assert.equal(pages[1].isInteractive, true);
  });

  await t.test('Test 3: Interactive primary block resolution in mixed content + question page', () => {
    const pageId = 'page_context_and_question';
    const headingBlock = { ...createBlock('HEADING', 0), page_id: pageId };
    const textBlock = { ...createBlock('TEXT', 1), page_id: pageId };
    const mcqBlock = { ...createBlock('MCQ', 2), page_id: pageId };

    const pages = groupBlocksIntoPages([headingBlock, textBlock, mcqBlock]);
    assert.equal(pages.length, 1);
    const page = pages[0];
    assert.equal(page.blocks.length, 3);
    assert.equal(page.isInteractive, true);
    assert.equal(page.primaryBlock.content_type, 'SCENARIO', 'Primary block should be the interactive MCQ');
  });

  await t.test('Test 4: Legacy section_id fallback maps to page grouping seamlessly', () => {
    const b0 = { ...createBlock('TEXT', 0), section_id: 'legacy_sec_1' };
    const b1 = { ...createBlock('CALLOUT', 1), section_id: 'legacy_sec_1' };
    const b2 = { ...createBlock('TABLE', 2), section_id: 'legacy_sec_2' };

    const pages = groupBlocksIntoPages([b0, b1, b2]);
    assert.equal(pages.length, 2);
    assert.equal(pages[0].blocks.length, 2);
    assert.equal(pages[1].blocks.length, 1);
  });

  await t.test('Test 5: generatePageId produces clean unique identifiers', () => {
    const id1 = generatePageId();
    const id2 = generatePageId();

    assert.ok(id1.startsWith('page_'));
    assert.ok(id2.startsWith('page_'));
    assert.notEqual(id1, id2);
  });

  await t.test('Test 6: Split & merge workflow simulation', () => {
    // Initial: 3 solo blocks
    const initialBlocks = [
      createBlock('HEADING', 0),
      createBlock('TEXT', 1),
      createBlock('IMAGE', 2),
    ];

    let pages = groupBlocksIntoPages(initialBlocks);
    assert.equal(pages.length, 3);

    // Merge block 1 into block 0
    const targetPageId = generatePageId();
    const mergedBlocks = [
      { ...initialBlocks[0], page_id: targetPageId, section_id: targetPageId },
      { ...initialBlocks[1], page_id: targetPageId, section_id: targetPageId },
      initialBlocks[2], // solo
    ];

    pages = groupBlocksIntoPages(mergedBlocks);
    assert.equal(pages.length, 2, 'After merge, 3 blocks become 2 steps');
    assert.equal(pages[0].blocks.length, 2);
    assert.equal(pages[1].blocks.length, 1);

    // Split block 1 back into its own page
    const splitPageId = generatePageId();
    const splitBlocks = [
      mergedBlocks[0],
      { ...mergedBlocks[1], page_id: splitPageId, section_id: splitPageId },
      mergedBlocks[2],
    ];

    pages = groupBlocksIntoPages(splitBlocks);
    assert.equal(pages.length, 3, 'After split, each is a separate step');
  });

  await t.test('Test 7: Step-first helpers — createEmptyStep, reorderSteps, deleteStep, duplicateStep, moveBlockToStep', async () => {
    const { createEmptyStep, reorderSteps, deleteStep, duplicateStep, moveBlockToStep } = await import('../utils/blockRegistry.js');

    // 1. createEmptyStep
    const { newPageId: step1Id, nextBlocks: s1Blocks } = createEmptyStep([], 'HEADING', { title: 'Step 1 Heading' });
    assert.equal(s1Blocks.length, 1);
    assert.equal(s1Blocks[0].page_id, step1Id);

    const { newPageId: step2Id, nextBlocks: s2Blocks } = createEmptyStep(s1Blocks, 'TEXT', { title: 'Step 2 Text' });
    assert.equal(s2Blocks.length, 2);
    assert.equal(s2Blocks[1].page_id, step2Id);

    // 2. Add block into step 1
    const { createBlock } = await import('../utils/blockRegistry.js');
    const extraBlockStep1 = {
      ...createBlock('IMAGE', 2),
      page_id: step1Id,
      section_id: step1Id,
    };
    const threeBlocks = [s2Blocks[0], extraBlockStep1, s2Blocks[1]];
    threeBlocks.forEach((b, i) => { b.order_index = i; });

    let pages = groupBlocksIntoPages(threeBlocks);
    assert.equal(pages.length, 2);
    assert.equal(pages[0].blocks.length, 2, 'Step 1 should have 2 blocks');
    assert.equal(pages[1].blocks.length, 1, 'Step 2 should have 1 block');

    // 3. reorderSteps (swap Step 1 and Step 2)
    const reordered = reorderSteps(threeBlocks, 0, 1);
    const pagesReordered = groupBlocksIntoPages(reordered);
    assert.equal(pagesReordered.length, 2);
    assert.equal(pagesReordered[0].pageId, step2Id, 'Step 2 should now be first');
    assert.equal(pagesReordered[1].pageId, step1Id, 'Step 1 should now be second');
    assert.equal(reordered[0].order_index, 0);
    assert.equal(reordered[1].order_index, 1);
    assert.equal(reordered[2].order_index, 2);

    // 4. duplicateStep (duplicate Step 1)
    const duplicated = duplicateStep(threeBlocks, 0);
    const pagesDuplicated = groupBlocksIntoPages(duplicated);
    assert.equal(pagesDuplicated.length, 3, 'Duplicating step 1 creates a 3rd step');
    assert.equal(pagesDuplicated[1].blocks.length, 2, 'Cloned step should have 2 blocks');
    assert.notEqual(pagesDuplicated[1].pageId, step1Id, 'Cloned step should have a fresh pageId');

    // 5. moveBlockToStep (move extraBlockStep1 from Step 1 to Step 2)
    const moved = moveBlockToStep(threeBlocks, 1, step2Id);
    const pagesMoved = groupBlocksIntoPages(moved);
    assert.equal(pagesMoved.length, 2);
    assert.equal(pagesMoved[0].blocks.length, 1, 'Step 1 now has 1 block');
    assert.equal(pagesMoved[1].blocks.length, 2, 'Step 2 now has 2 blocks');

    // 6. deleteStep (delete Step 1)
    const deleted = deleteStep(threeBlocks, 0);
    const pagesDeleted = groupBlocksIntoPages(deleted);
    assert.equal(pagesDeleted.length, 1);
    assert.equal(pagesDeleted[0].pageId, step2Id);
  });

  await t.test('Test 8: Custom step_title propagation and learner session normalization', () => {
    const pId = 'pid-step-inflation';
    const rawItems = [
      {
        session_item_id: 'item-1',
        title: 'Block 1',
        step_title: 'Step 1: Inflation Fundamentals',
        content_type: 'TEXT',
        page_id: pId,
        is_interactive: false,
        payload: { text: 'Inflation is the rate at which prices rise.' },
      },
      {
        session_item_id: 'item-2',
        title: 'Block 2',
        step_title: 'Step 1: Inflation Fundamentals',
        content_type: 'SCENARIO',
        page_id: pId,
        is_interactive: true,
        payload: { prompt: 'What happens to purchasing power?' },
      },
    ];

    // Verify multi-block merge retains custom step_title as page title
    const primary = rawItems.find((it) => it.is_interactive) || rawItems[0];
    const pageTitle = rawItems.find((it) => it.step_title || it.payload?.step_title)?.step_title || primary.title;
    assert.equal(pageTitle, 'Step 1: Inflation Fundamentals');

    // Solo step title propagation
    const soloItem = {
      session_item_id: 'item-solo',
      title: 'Block 3',
      step_title: 'Step 2: Practical Takeaway',
      content_type: 'CALLOUT',
      page_id: 'pid-step-takeaway',
      is_interactive: false,
      payload: {},
    };
    const soloTitle = soloItem.step_title || soloItem.payload?.step_title || soloItem.title;
    assert.equal(soloTitle, 'Step 2: Practical Takeaway');
  });
});

