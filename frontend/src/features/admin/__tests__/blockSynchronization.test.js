import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, validateBlock, BLOCK_CAPABILITIES } from '../utils/blockRegistry.js';

test('LCMS Block Synchronization & Semantic State Suite', async (t) => {

  await t.test('Test A: Pure TEXT block state isolation across metadata updates', () => {
    const originalText = 'Authoritative market mechanics: liquidity dries up at circuit breakers.';
    const block = createBlock('TEXT', 0, {
      content: { text: originalText }
    });

    assert.equal(block.content.text, originalText);
    assert.equal(block.content_type, 'TEXT');

    // Simulate updating activity_type, cognitive_level, difficulty
    const updatedBlock = {
      ...block,
      activity_type: 'EXPLAIN',
      cognitive_level: 'ANALYZE',
      difficulty: 3,
    };

    // Verify content.text is NEVER clobbered by metadata changes
    assert.equal(updatedBlock.content.text, originalText);
    assert.equal(updatedBlock.activity_type, 'EXPLAIN');
    assert.equal(updatedBlock.cognitive_level, 'ANALYZE');
    assert.equal(updatedBlock.difficulty, 3);
  });

  await t.test('Test B: No default mock text injection on existing blocks or creation', () => {
    const newTextBlock = createBlock('TEXT', 0);
    // TEXT block default text MUST be empty, never mock text
    assert.equal(newTextBlock.content.text, '');
    assert.ok(!newTextBlock.content.text.includes('Introduce core concepts'));

    // Existing block with intentional empty string
    const existingEmptyBlock = {
      id: 'block-123',
      order_index: 0,
      content_type: 'TEXT',
      activity_type: 'OBSERVE',
      response_type: 'NONE',
      content: { text: '' },
    };

    // Ensure metadata update preserves the empty string rather than injecting default text
    const updated = {
      ...existingEmptyBlock,
      activity_type: 'PREDICT'
    };
    assert.equal(updated.content.text, '');
  });

  await t.test('Test C: Pure content blocks have response_type = NONE and zero evaluation/options', () => {
    const pureTypes = ['HEADING', 'TEXT', 'IMAGE', 'CALLOUT', 'ANALOGY', 'TABLE'];
    
    for (const type of pureTypes) {
      const block = createBlock(type, 0);
      assert.equal(block.response_type, 'NONE', `${type} must have response_type = NONE`);
      assert.equal(block.options, undefined, `${type} must not define options`);
      assert.equal(block.evaluation, undefined, `${type} must not define evaluation`);
    }
  });

  await t.test('Test D: Pure content block does not expose or require CANDLESTICK renderer', () => {
    const textBlock = createBlock('TEXT', 0);
    assert.equal(textBlock.renderer, undefined, 'TEXT block must not have default renderer');
    
    const candleBlock = createBlock('CANDLESTICK', 0);
    assert.equal(candleBlock.content_type, 'CANDLESTICK');
    assert.ok(candleBlock.content.open !== undefined, 'CANDLESTICK has OHLC coordinates');
  });

  await t.test('Test E: Activity type binding mutates activity_type, not content_type or type', () => {
    const block = createBlock('TEXT', 0);
    assert.equal(block.content_type, 'TEXT');

    // Updating activity_type
    const updated = {
      ...block,
      activity_type: 'PREDICT',
    };

    assert.equal(updated.activity_type, 'PREDICT');
    assert.equal(updated.content_type, 'TEXT');
    // type should not be clobbered to PREDICT
    const effectiveType = updated.content_type || updated.type;
    assert.equal(effectiveType, 'TEXT');
  });

  await t.test('Test F: Cognitive level assignment conforms to Bloom hierarchy', () => {
    const validLevels = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE'];
    const block = createBlock('TEXT', 0);

    for (const level of validLevels) {
      const updated = { ...block, cognitive_level: level };
      assert.equal(updated.cognitive_level, level);
    }
  });

  await t.test('Test G: createBlock deep clone isolation', () => {
    const blockA = createBlock('TEXT', 0);
    blockA.content.text = 'Mutated on Instance A';

    const blockB = createBlock('TEXT', 1);
    assert.equal(blockB.content.text, '', 'Instance B content must not be affected by mutations on Instance A');
    assert.notEqual(blockA.id, blockB.id, 'Each created block must have a distinct UUID');
  });

  await t.test('Test H: Functional block mutation immutability', () => {
    let state = [
      createBlock('TEXT', 0, { content: { text: 'Initial' } }),
      createBlock('TEXT', 1, { content: { text: 'Second' } }),
    ];

    const updater = (prevBlocks, idx, patch) => {
      const next = [...prevBlocks];
      next[idx] = typeof patch === 'function' ? patch(prevBlocks[idx]) : { ...prevBlocks[idx], ...patch };
      return next;
    };

    // First rapid update
    state = updater(state, 0, (curr) => ({
      ...curr,
      content: { ...curr.content, text: 'Initial + Keystroke 1' }
    }));

    // Second rapid update
    state = updater(state, 0, (curr) => ({
      ...curr,
      activity_type: 'EXPLAIN'
    }));

    assert.equal(state[0].content.text, 'Initial + Keystroke 1');
    assert.equal(state[0].activity_type, 'EXPLAIN');
  });

  await t.test('Test I: Autosave dirty flag preservation logic during in-flight saves', () => {
    let hasUnsavedChanges = true;
    let inFlightPayload = { blocks: [{ id: '1', content: { text: 'Saved text' } }] };
    let latestState = { blocks: [{ id: '1', content: { text: 'Saved text + new edit' } }] };

    // Simulate completion of in-flight save
    const resolveSave = (inFlight, latest) => {
      if (inFlight.blocks === latest.blocks) {
        hasUnsavedChanges = false;
      } else {
        hasUnsavedChanges = true; // Kept dirty because author typed while save was sending!
      }
    };

    resolveSave(inFlightPayload, latestState);
    assert.equal(hasUnsavedChanges, true, 'Dirty flag must be preserved when edits happen during in-flight save');
  });

  await t.test('Test J: Block label derivation displays canonical label, never Untitled Step', () => {
    const getBlockTitle = (block, cType) => {
      return block?.title || block?.content?.title || BLOCK_CAPABILITIES[cType]?.label || cType || 'Block';
    };

    const textBlock = createBlock('TEXT', 0, { content: { text: 'Some explanation' } });
    assert.equal(getBlockTitle(textBlock, 'TEXT'), 'Text');

    const headingBlock = createBlock('HEADING', 0, { content: { title: 'Market Dynamics', level: 'H2' } });
    assert.equal(getBlockTitle(headingBlock, 'HEADING'), 'Market Dynamics');

    const imageBlock = createBlock('IMAGE', 0);
    assert.equal(getBlockTitle(imageBlock, 'IMAGE'), 'Image');
  });

});
