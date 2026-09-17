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
});
