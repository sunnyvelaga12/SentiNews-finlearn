/**
 * SentiNews Pedagogical Quality Engine & Semantic Rule Validator (V0.5.2)
 *
 * Implements the Senior Architecture Review rule taxonomy:
 * - BLOCKER: Structural, semantic, or compliance errors that strictly prevent review submission or publishing.
 * - WARNING: Sequence pacing, missing retrieval opportunities, or ungrounded financial claims.
 * - SUGGESTION: Pedagogical enhancements (misconception check, transfer activities).
 *
 * Provides actionable "Why this matters" reasoning and direct fix shortcuts.
 */
export function evaluatePedagogicalQuality(lesson, blocks) {
    const blockers = [];
    const warnings = [];
    const suggestions = [];
    const pacingStreaks = [];
    // ── 1. UNIVERSAL STRUCTURAL VALIDATION (BLOCKERS) ──────────────────────────
    if (!lesson.title || lesson.title.trim().length < 3) {
        blockers.push({
            id: 'err-title-length',
            severity: 'BLOCKER',
            ruleId: 'REQ_TITLE',
            scope: 'UNIVERSAL',
            title: 'Missing Lesson Title',
            message: 'Lesson title must be at least 3 characters long.',
            reason: 'Learners need a clear, professional topic name on curriculum roadmaps and progress certificates.'
        });
    }
    if (!lesson.learning_objectives || lesson.learning_objectives.length === 0) {
        blockers.push({
            id: 'err-no-objectives',
            severity: 'BLOCKER',
            ruleId: 'REQ_OBJECTIVE',
            scope: 'UNIVERSAL',
            title: 'Missing Learning Objectives',
            message: 'At least one learning objective is required.',
            reason: 'Clear objectives focus learner attention and define the boundary of what is assessed.'
        });
    }
    if (!blocks || blocks.length === 0) {
        blockers.push({
            id: 'err-no-blocks',
            severity: 'BLOCKER',
            ruleId: 'REQ_BLOCKS',
            scope: 'UNIVERSAL',
            title: 'No Learning Activities',
            message: 'A lesson must contain at least one pedagogical activity step.',
            reason: 'Empty lessons cannot be reviewed or delivered to learners.'
        });
    }
    // ── 2. ACTIVITY-SPECIFIC VALIDATION ────────────────────────────────────────
    let interactiveCount = 0;
    let recallCount = 0;
    let applicationCount = 0;
    let masteryCount = 0;
    let hasMisconceptionCheck = false;
    let hasTransfer = false;
    blocks.forEach((b, idx) => {
        const stepNum = idx + 1;
        const type = (b.type || 'OBSERVE').toUpperCase();
        const respType = (b.response_type || 'NONE').toUpperCase();
        const role = (b.evidence_role || 'NONE').toUpperCase();
        // Metrics counting
        if (respType !== 'NONE')
            interactiveCount++;
        if (['PRACTICE', 'PREDICT'].includes(type))
            recallCount++;
        if (['APPLICATION', 'MARKET_EXAMPLE'].includes(type))
            applicationCount++;
        if (role === 'MASTERY_EVIDENCE')
            masteryCount++;
        if (type === 'MISCONCEPTION_CHECK')
            hasMisconceptionCheck = true;
        if (type === 'TRANSFER')
            hasTransfer = true;
        // Check Prompt / Title
        if (!b.prompt && !b.title) {
            blockers.push({
                id: `err-b-${idx}-prompt`,
                severity: 'BLOCKER',
                ruleId: 'REQ_BLOCK_PROMPT',
                scope: 'ACTIVITY',
                blockIndex: idx,
                blockId: b.id,
                title: `Step ${stepNum} Missing Prompt`,
                message: `Step ${stepNum} (${type}) has no title or question prompt.`,
                reason: 'Learners cannot interact with or understand an empty card.'
            });
        }
        // Hard Semantic Guardrail: MASTERY_EVIDENCE constraint
        if (role === 'MASTERY_EVIDENCE') {
            if (respType === 'NONE') {
                blockers.push({
                    id: `err-b-${idx}-mastery-no-resp`,
                    severity: 'BLOCKER',
                    ruleId: 'MASTERY_REQUIRES_EVALUATABLE_RESPONSE',
                    scope: 'ACTIVITY',
                    blockIndex: idx,
                    blockId: b.id,
                    title: `Step ${stepNum}: Invalid Evidence Configuration`,
                    message: `Step ${stepNum} is marked as MASTERY_EVIDENCE but has Response Type 'NONE'.`,
                    reason: 'Mastery evidence must capture an evaluatable learner response (Single Choice or Numeric) to generate verifiable Bayesian competence.',
                    suggestedAction: {
                        label: 'Change Response Type to Single Choice',
                        actionType: 'EDIT_BLOCK',
                        payload: { response_type: 'SINGLE_CHOICE' }
                    }
                });
            }
            // Check Options validity for Multiple Choice
            if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(respType)) {
                const options = b.options || [];
                if (options.length < 2) {
                    blockers.push({
                        id: `err-b-${idx}-options-few`,
                        severity: 'BLOCKER',
                        ruleId: 'MASTERY_MIN_OPTIONS',
                        scope: 'ACTIVITY',
                        blockIndex: idx,
                        blockId: b.id,
                        title: `Step ${stepNum}: Incomplete Options`,
                        message: `Step ${stepNum} requires at least 2 multiple choice options.`,
                        reason: 'Assessment activities require plausible distractors to measure true concept competence.'
                    });
                }
                else {
                    const hasCorrect = options.some((o) => o.is_correct === true || o.id === b.correct_option_id);
                    if (!hasCorrect) {
                        blockers.push({
                            id: `err-b-${idx}-no-correct-option`,
                            severity: 'BLOCKER',
                            ruleId: 'MASTERY_NO_CORRECT_KEY',
                            scope: 'ACTIVITY',
                            blockIndex: idx,
                            blockId: b.id,
                            title: `Step ${stepNum}: No Correct Answer Designated`,
                            message: `Step ${stepNum} has no correct option selected.`,
                            reason: 'System cannot deterministically evaluate learner accuracy without an authoritative answer key.',
                            suggestedAction: {
                                label: 'Mark First Option as Correct',
                                actionType: 'SET_CORRECT_OPTION',
                                payload: { blockIndex: idx, optionIndex: 0 }
                            }
                        });
                    }
                }
            }
        }
        // Source Citation check for real market examples
        if (type === 'MARKET_EXAMPLE' && !b.source_citation?.provider && !b.source_citation?.instrument) {
            warnings.push({
                id: `warn-b-${idx}-source`,
                severity: 'WARNING',
                ruleId: 'MARKET_EXAMPLE_SOURCE_MISSING',
                scope: 'ACTIVITY',
                blockIndex: idx,
                blockId: b.id,
                title: `Step ${stepNum}: Missing Source Provenance`,
                message: `Real-world market example lacks verified exchange or regulatory citation.`,
                reason: 'Financial accuracy standards require real market examples to reference verified exchange data (NSE/BSE/SEBI).',
                suggestedAction: {
                    label: 'Add NSE Citation',
                    actionType: 'ADD_SOURCE',
                    payload: { blockIndex: idx }
                }
            });
        }
    });
    // ── 3. SEQUENCE PACING ANALYSIS (WARNINGS) ──────────────────────────────────
    let consecutiveExplanations = 0;
    let streakStart = -1;
    blocks.forEach((b, idx) => {
        const type = (b.type || '').toUpperCase();
        if (type === 'EXPLAIN' || type === 'OBSERVE') {
            if (consecutiveExplanations === 0)
                streakStart = idx;
            consecutiveExplanations++;
            if (consecutiveExplanations >= 3) {
                pacingStreaks.push({
                    start: streakStart,
                    end: idx,
                    description: `${consecutiveExplanations} consecutive passive explanation steps (Steps ${streakStart + 1}–${idx + 1}) without retrieval.`
                });
            }
        }
        else {
            consecutiveExplanations = 0;
            streakStart = -1;
        }
    });
    if (pacingStreaks.length > 0) {
        warnings.push({
            id: 'warn-pacing-consecutive-explain',
            severity: 'WARNING',
            ruleId: 'SEQUENCE_PACING_PASSIVE_STREAK',
            scope: 'SEQUENCE',
            title: 'Pacing Issue: Excessive Passive Content',
            message: pacingStreaks[0].description,
            reason: 'Learners experience cognitive fatigue when reading 3+ consecutive explanation cards without active retrieval or prediction.',
            suggestedAction: {
                label: 'Insert Practice Check between Steps',
                actionType: 'ADD_STEP',
                payload: { type: 'PREDICT', insertAfter: pacingStreaks[0].start }
            }
        });
    }
    if (blocks.length >= 4 && interactiveCount === 0) {
        warnings.push({
            id: 'warn-no-interaction',
            severity: 'WARNING',
            ruleId: 'NO_INTERACTIVITY_IN_LESSON',
            scope: 'SEQUENCE',
            title: 'No Interactive Activities',
            message: 'This 4+ step lesson contains zero interactive responses.',
            reason: 'Active engagement and micro-predictions double learner concept retention over passive reading.'
        });
    }
    // ── 4. HEURISTIC SUGGESTIONS ────────────────────────────────────────────────
    if (!hasMisconceptionCheck && blocks.length >= 4) {
        suggestions.push({
            id: 'sug-misconception',
            severity: 'SUGGESTION',
            ruleId: 'SUGGEST_MISCONCEPTION_CHECK',
            scope: 'HEURISTIC',
            title: 'Consider a Misconception Check',
            message: 'Addressing a common beginner trap helps cement nuanced financial understanding.',
            reason: 'Novices often confuse price movement with trend momentum; explicit traps prevent costly trading mistakes.',
            suggestedAction: {
                label: '+ Add Misconception Check',
                actionType: 'ADD_STEP',
                payload: { type: 'MISCONCEPTION_CHECK' }
            }
        });
    }
    if (!hasTransfer && (lesson.level === 'INTERMEDIATE' || lesson.level === 'ADVANCED')) {
        suggestions.push({
            id: 'sug-transfer',
            severity: 'SUGGESTION',
            ruleId: 'SUGGEST_TRANSFER_STEP',
            scope: 'HEURISTIC',
            title: 'Consider an Application or Transfer Step',
            message: 'Advanced concepts benefit from testing transfer to a different asset or timeframe.',
            reason: 'Testing transfer across equities, indices, and commodities verifies genuine concept mental models.',
            suggestedAction: {
                label: '+ Add Transfer Step',
                actionType: 'ADD_STEP',
                payload: { type: 'TRANSFER' }
            }
        });
    }
    const estimatedMinutes = Math.max(2, Math.round(blocks.length * 0.9 + interactiveCount * 0.5));
    return {
        isPublishable: blockers.length === 0,
        blockers,
        warnings,
        suggestions,
        pacingStreaks,
        metrics: {
            estimatedMinutes,
            totalActivities: blocks.length,
            interactiveCount,
            recallCount,
            applicationCount,
            masteryCount,
            hasMisconceptionCheck,
            hasTransfer
        }
    };
}
