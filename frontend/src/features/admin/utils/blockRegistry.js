/**
 * SentiNews Learn LCMS — Canonical Block Capability Registry
 * 
 * 10 Canonical Capabilities:
 * CONTENT (response_type = NONE):
 *   - HEADING
 *   - TEXT
 *   - IMAGE
 *   - CALLOUT
 *   - ANALOGY
 *   - TABLE
 * 
 * INTERACTIVE (projected to LearningActivity):
 *   - MCQ (SINGLE_CHOICE)
 *   - IMAGE_SELECTION
 *   - SCENARIO
 *   - CANDLESTICK
 * 
 * ARCHITECTURAL CONSTRAINTS:
 * 1. media_asset_id is canonical; display URLs are strictly derived. Never persist URLs in blocks_json.
 * 2. TEXT blocks store canonical content.text (markdown string).
 * 3. Options use stable opaque UUIDs with evaluation.correct_option_id (never array indices).
 * 4. Pure content blocks have response_type = NONE and zero evaluation/options.
 */

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const BLOCK_CAPABILITIES = {
  HEADING: {
    type: 'HEADING',
    group: 'CONTENT',
    label: 'Heading',
    description: 'Structural section header for structuring lesson sections and concepts.',
    icon: 'Heading',
    responseType: 'NONE',
    activityType: 'OBSERVE',
    isInteractive: false,
    createDefault: (orderIndex) => ({
      id: generateUUID(),
      order_index: orderIndex,
      section_id: null,
      content_type: 'HEADING',
      activity_type: 'OBSERVE',
      response_type: 'NONE',
      content: {
        title: 'Section Heading',
        level: 'H2',
      },
      difficulty: 1,
    }),
    validate: (block) => {
      const errors = [];
      if (!block.content?.title || !block.content.title.trim()) {
        errors.push('Heading text is required.');
      }
      return errors;
    },
  },

  TEXT: {
    type: 'TEXT',
    group: 'CONTENT',
    label: 'Text',
    description: 'Canonical rich markdown text for core financial concepts and explanations.',
    icon: 'AlignLeft',
    responseType: 'NONE',
    activityType: 'OBSERVE',
    isInteractive: false,
    createDefault: (orderIndex) => ({
      id: generateUUID(),
      order_index: orderIndex,
      section_id: null,
      content_type: 'TEXT',
      activity_type: 'OBSERVE',
      response_type: 'NONE',
      content: {
        text: '',
      },
      difficulty: 1,
    }),
    validate: (block) => {
      const errors = [];
      const text = block.content?.text || block.content?.body || '';
      if (!text.trim()) {
        errors.push('Text block content is required.');
      }
      return errors;
    },
  },

  IMAGE: {
    type: 'IMAGE',
    group: 'CONTENT',
    label: 'Image',
    description: 'Diagram, chart, or model illustration referencing canonical media asset.',
    icon: 'Image',
    responseType: 'NONE',
    activityType: 'OBSERVE',
    isInteractive: false,
    createDefault: (orderIndex) => ({
      id: generateUUID(),
      order_index: orderIndex,
      section_id: null,
      content_type: 'IMAGE',
      activity_type: 'OBSERVE',
      response_type: 'NONE',
      media_asset_id: null,
      content: {
        alt_text: 'Financial diagram illustration',
        caption: '',
      },
      difficulty: 1,
    }),
    validate: (block) => {
      const errors = [];
      if (!block.media_asset_id && !block.content?.media_asset_id) {
        errors.push('Image block requires a selected media asset.');
      }
      return errors;
    },
  },

  CALLOUT: {
    type: 'CALLOUT',
    group: 'CONTENT',
    label: 'Callout',
    description: 'Highlighted callout box for rules, key takeaways, tips, or warning caveats.',
    icon: 'AlertCircle',
    responseType: 'NONE',
    activityType: 'OBSERVE',
    isInteractive: false,
    createDefault: (orderIndex) => ({
      id: generateUUID(),
      order_index: orderIndex,
      section_id: null,
      content_type: 'CALLOUT',
      activity_type: 'OBSERVE',
      response_type: 'NONE',
      content: {
        tone: 'NOTE', // NOTE, TIP, IMPORTANT, WARNING
        title: 'Key Takeaway',
        body: 'Highlight critical concept rules, edge cases, or regulatory principles.',
      },
      difficulty: 1,
    }),
    validate: (block) => {
      const errors = [];
      if (!block.content?.body?.trim()) {
        errors.push('Callout body text is required.');
      }
      return errors;
    },
  },

  ANALOGY: {
    type: 'ANALOGY',
    group: 'CONTENT',
    label: 'Analogy',
    description: 'Cognitive bridge connecting everyday intuition to market concepts.',
    icon: 'Lightbulb',
    responseType: 'NONE',
    activityType: 'OBSERVE',
    isInteractive: false,
    createDefault: (orderIndex) => ({
      id: generateUUID(),
      order_index: orderIndex,
      section_id: null,
      content_type: 'ANALOGY',
      activity_type: 'OBSERVE',
      response_type: 'NONE',
      content: {
        source_domain: 'Everyday Experience',
        target_domain: 'Financial Market Concept',
        mapping: 'How the intuitive real-world parallel maps to the financial mechanism.',
        explanation: 'Concrete walkthrough of the comparison and where the analogy applies.',
      },
      difficulty: 1,
    }),
    validate: (block) => {
      const errors = [];
      if (!block.content?.mapping?.trim()) {
        errors.push('Analogy mapping description is required.');
      }
      return errors;
    },
  },

  TABLE: {
    type: 'TABLE',
    group: 'CONTENT',
    label: 'Table',
    description: 'Structured comparison, financial statement line items, or parameter data.',
    icon: 'Table',
    responseType: 'NONE',
    activityType: 'OBSERVE',
    isInteractive: false,
    createDefault: (orderIndex) => ({
      id: generateUUID(),
      order_index: orderIndex,
      section_id: null,
      content_type: 'TABLE',
      activity_type: 'OBSERVE',
      response_type: 'NONE',
      content: {
        title: 'Financial Metric Comparison',
        columns: ['Metric', 'Definition', 'Strategic Impact'],
        rows: [
          ['Revenue', 'Top-line gross sales inflow', 'Top-line growth indicator'],
          ['Operating Income', 'Revenue minus operating expenses', 'Core operational efficiency'],
          ['Net Income', 'Bottom-line net profit after taxes', 'Shareholder value creation'],
        ],
        caption: 'Standard income statement metric progression',
      },
      difficulty: 1,
    }),
    validate: (block) => {
      const errors = [];
      if (!block.content?.columns || block.content.columns.length === 0) {
        errors.push('Table must have at least one column header.');
      }
      if (!block.content?.rows || block.content.rows.length === 0) {
        errors.push('Table must have at least one row of data.');
      }
      return errors;
    },
  },

  MCQ: {
    type: 'MCQ',
    group: 'INTERACTIVE',
    label: 'Multiple Choice (MCQ)',
    description: 'Formative or diagnostic assessment question with stable option IDs and feedback.',
    icon: 'CheckSquare',
    responseType: 'SINGLE_CHOICE',
    activityType: 'PRACTICE',
    isInteractive: true,
    createDefault: (orderIndex) => {
      const opt1 = generateUUID();
      const opt2 = generateUUID();
      const opt3 = generateUUID();
      return {
        id: generateUUID(),
        order_index: orderIndex,
        section_id: null,
        content_type: 'SCENARIO',
        activity_type: 'PRACTICE',
        response_type: 'SINGLE_CHOICE',
        cognitive_level: 'APPLY',
        evidence_role: 'FORMATIVE',
        content: {
          prompt: 'Which of the following statements is accurate?',
        },
        options: [
          { id: opt1, text: 'Option A: The correct explanation of the principle.' },
          { id: opt2, text: 'Option B: Common novice misconception.' },
          { id: opt3, text: 'Option C: Alternative plausible distractor.' },
        ],
        evaluation: {
          correct_option_id: opt1,
        },
        feedback: {
          correct: 'Correct! You identified the canonical rule.',
          incorrect: 'Review the definition carefully and consider the operational distinction.',
        },
        difficulty: 2,
      };
    },
    validate: (block) => {
      const errors = [];
      const prompt = block.content?.prompt || block.prompt || '';
      if (!prompt.trim()) {
        errors.push('Question prompt is required.');
      }
      if (!block.options || block.options.length < 2) {
        errors.push('MCQ requires at least 2 options.');
      }
      const optionIds = new Set((block.options || []).map((o) => o.id));
      if (!block.evaluation?.correct_option_id) {
        errors.push('A correct option must be selected.');
      } else if (!optionIds.has(block.evaluation.correct_option_id)) {
        errors.push('Correct option ID must match one of the available options.');
      }
      return errors;
    },
  },

  IMAGE_SELECTION: {
    type: 'IMAGE_SELECTION',
    group: 'INTERACTIVE',
    label: 'Image Selection',
    description: 'Visual discrimination challenge with 4+ image choices and stable option UUIDs.',
    icon: 'Grid',
    responseType: 'IMAGE_SELECTION',
    activityType: 'PRACTICE',
    isInteractive: true,
    createDefault: (orderIndex) => {
      const opt1 = generateUUID();
      const opt2 = generateUUID();
      const opt3 = generateUUID();
      const opt4 = generateUUID();
      return {
        id: generateUUID(),
        order_index: orderIndex,
        section_id: null,
        content_type: 'IMAGE',
        activity_type: 'PRACTICE',
        response_type: 'IMAGE_SELECTION',
        cognitive_level: 'RECOGNIZE',
        evidence_role: 'FORMATIVE',
        content: {
          prompt: 'Select the pattern matching the described formation:',
        },
        options: [
          { id: opt1, media_asset_id: null, label: 'Pattern A' },
          { id: opt2, media_asset_id: null, label: 'Pattern B' },
          { id: opt3, media_asset_id: null, label: 'Pattern C' },
          { id: opt4, media_asset_id: null, label: 'Pattern D' },
        ],
        evaluation: {
          correct_option_id: opt1,
        },
        feedback: {
          correct: 'Accurate visual recognition! The formation characteristics match.',
          incorrect: 'Notice the ratio of the body to the shadows/lines and retry.',
        },
        difficulty: 2,
      };
    },
    validate: (block) => {
      const errors = [];
      const prompt = block.content?.prompt || block.prompt || '';
      if (!prompt.trim()) {
        errors.push('Prompt is required.');
      }
      if (!block.options || block.options.length < 2) {
        errors.push('Image selection requires at least 2 options.');
      }
      const optionIds = new Set((block.options || []).map((o) => o.id));
      if (!block.evaluation?.correct_option_id) {
        errors.push('A correct option must be selected.');
      } else if (!optionIds.has(block.evaluation.correct_option_id)) {
        errors.push('Correct option ID must match one of the available options.');
      }
      // Check each option has media_asset_id
      const missingMedia = (block.options || []).some((o) => !o.media_asset_id && !o.image_url);
      if (missingMedia) {
        errors.push('Every image option must reference a valid uploaded media asset.');
      }
      return errors;
    },
  },

  SCENARIO: {
    type: 'SCENARIO',
    group: 'INTERACTIVE',
    label: 'Scenario',
    description: 'Complex contextual application dilemma evaluating professional financial judgment.',
    icon: 'Compass',
    responseType: 'SINGLE_CHOICE',
    activityType: 'APPLICATION',
    isInteractive: true,
    createDefault: (orderIndex) => {
      const opt1 = generateUUID();
      const opt2 = generateUUID();
      const opt3 = generateUUID();
      return {
        id: generateUUID(),
        order_index: orderIndex,
        section_id: null,
        content_type: 'SCENARIO',
        activity_type: 'APPLICATION',
        cognitive_level: 'ANALYZE',
        evidence_role: 'MASTERY_EVIDENCE',
        content: {
          context: 'A company reports 25% revenue growth, but operating cash flow turned negative.',
          dilemma: 'How should an analyst evaluate the quality of earnings in this situation?',
          prompt: 'Select the most prudent analytical judgment:',
        },
        options: [
          { id: opt1, text: 'Investigate working capital expansion and receivables aging for aggressive revenue timing.' },
          { id: opt2, text: 'Ignore cash flow because revenue growth automatically guarantees valuation expansion.' },
          { id: opt3, text: 'Assume expenses will normalize without reviewing the statement of cash flows.' },
        ],
        evaluation: {
          correct_option_id: opt1,
        },
        feedback: {
          correct: 'Prudent analysis! Divergence between revenue and operating cash flow warrants working capital scrutiny.',
          incorrect: 'Revenue alone without cash realization can indicate aggressive accounting or liquidity stress.',
        },
        difficulty: 3,
      };
    },
    validate: (block) => {
      const errors = [];
      const prompt = block.content?.prompt || block.content?.dilemma || '';
      if (!prompt.trim()) {
        errors.push('Scenario dilemma or prompt is required.');
      }
      if (!block.options || block.options.length < 2) {
        errors.push('Scenario requires at least 2 response options.');
      }
      const optionIds = new Set((block.options || []).map((o) => o.id));
      if (!block.evaluation?.correct_option_id) {
        errors.push('A correct response option must be selected.');
      } else if (!optionIds.has(block.evaluation.correct_option_id)) {
        errors.push('Correct option ID must match one of the available options.');
      }
      return errors;
    },
  },

  CANDLESTICK: {
    type: 'CANDLESTICK',
    group: 'INTERACTIVE',
    label: 'Candlestick OHLC',
    description: 'Generic Open-High-Low-Close price candle representation for market data.',
    icon: 'BarChart2',
    responseType: 'NONE',
    activityType: 'OBSERVE',
    isInteractive: false,
    createDefault: (orderIndex) => ({
      id: generateUUID(),
      order_index: orderIndex,
      section_id: null,
      content_type: 'CANDLESTICK',
      activity_type: 'OBSERVE',
      response_type: 'NONE',
      content: {
        open: 100,
        high: 125,
        low: 95,
        close: 120,
        timeframe: '1D',
        instrument: 'EQUITY_CANDLE',
        title: 'Price Candle Anatomy',
        description: 'Open, High, Low, and Close relationship',
      },
      difficulty: 1,
    }),
    validate: (block) => {
      const errors = [];
      const { open, high, low, close } = block.content || {};
      if (open === undefined || high === undefined || low === undefined || close === undefined) {
        errors.push('OHLC values (open, high, low, close) are required.');
      } else {
        if (high < Math.max(open, close)) errors.push('High must be >= max(open, close).');
        if (low > Math.min(open, close)) errors.push('Low must be <= min(open, close).');
      }
      return errors;
    },
  },
};

/**
 * Creates a validated StoredBlock instance from a registry capability key.
 */
export function createBlock(type, orderIndex, customProps = {}) {
  const capability = BLOCK_CAPABILITIES[type];
  if (!capability) {
    throw new Error(`Unknown block capability type: ${type}`);
  }
  const defaultBlock = capability.createDefault(orderIndex);
  const clonedDefault = JSON.parse(JSON.stringify(defaultBlock));
  return {
    ...clonedDefault,
    ...customProps,
    content: {
      ...(clonedDefault.content || {}),
      ...(customProps.content || {}),
    },
  };
}

/**
 * Validates any block using its registered capability validator.
 */
export function validateBlock(block) {
  const capability = BLOCK_CAPABILITIES[block.content_type || block.type];
  if (!capability) {
    return [`Unknown block type: ${block.content_type || block.type}`];
  }
  return capability.validate(block);
}

export const CONTENT_BLOCK_TYPES = Object.values(BLOCK_CAPABILITIES).filter(
  (b) => b.group === 'CONTENT'
);

export const INTERACTIVE_BLOCK_TYPES = Object.values(BLOCK_CAPABILITIES).filter(
  (b) => b.group === 'INTERACTIVE'
);
