import React, { useState } from 'react';
import { Sliders, ShieldCheck, Building2, AlertOctagon, AlertTriangle, CheckCircle2, Target, Plus, Trash2, Sparkles, } from 'lucide-react';
import { generateUUID, BLOCK_CAPABILITIES } from '../utils/blockRegistry';

export const InspectorAndQualityPanel = ({ selectedBlock, selectedBlockIndex = 0, qualityResult, onUpdateSelectedBlock, onJumpToBlock, onApplyQuickFix, }) => {
    const [activeTab, setActiveTab] = useState('PROPERTIES');
    const cType = selectedBlock ? (selectedBlock.content_type || selectedBlock.type || 'TEXT') : 'TEXT';
    const isPureContent = ['HEADING', 'TEXT', 'IMAGE', 'CALLOUT', 'ANALOGY', 'TABLE'].includes(cType);
    const blockTitle = selectedBlock?.title || selectedBlock?.content?.title || BLOCK_CAPABILITIES[cType]?.label || cType || 'Block';
    // Hard Semantic Guardrail helper: if MASTERY_EVIDENCE chosen, ensure response_type is not NONE
    const handleEvidenceRoleChange = (role) => {
        if (!selectedBlock)
            return;
        const updates = { evidence_role: role };
        if (role === 'MASTERY_EVIDENCE' && selectedBlock.response_type === 'NONE') {
            updates.response_type = 'SINGLE_CHOICE';
            if (!selectedBlock.options || selectedBlock.options.length < 2) {
                const opt1 = generateUUID();
                const opt2 = generateUUID();
                updates.options = [
                    { id: opt1, text: 'Bullish Continuation', is_correct: true },
                    { id: opt2, text: 'Bearish Reversal', is_correct: false },
                ];
                updates.correct_option_id = opt1;
                updates.evaluation = {
                    ...(selectedBlock.evaluation || {}),
                    correct_option_id: opt1,
                    explanation: 'Explanation for correct choice.',
                };
            }
        }
        onUpdateSelectedBlock({ ...selectedBlock, ...updates });
    };
    const handleAddOption = () => {
        if (!selectedBlock)
            return;
        const currentOptions = selectedBlock.options || [];
        const newId = generateUUID();
        const newOption = {
            id: newId,
            text: `Option ${currentOptions.length + 1}`,
            is_correct: currentOptions.length === 0,
        };
        onUpdateSelectedBlock({
            ...selectedBlock,
            options: [...currentOptions, newOption],
        });
    };
    const handleOptionChange = (idx, text) => {
        if (!selectedBlock)
            return;
        const options = [...(selectedBlock.options || [])];
        options[idx] = { ...options[idx], text };
        onUpdateSelectedBlock({ ...selectedBlock, options });
    };
    const handleSetCorrectOption = (idx) => {
        if (!selectedBlock)
            return;
        const options = (selectedBlock.options || []).map((o, i) => ({
            ...o,
            is_correct: i === idx,
        }));
        const correctId = options[idx]?.id;
        onUpdateSelectedBlock({
            ...selectedBlock,
            options,
            correct_option_id: correctId,
            evaluation: {
                ...(selectedBlock.evaluation || {}),
                correct_option_id: correctId,
            },
        });
    };
    const handleRemoveOption = (idx) => {
        if (!selectedBlock)
            return;
        const options = (selectedBlock.options || []).filter((_, i) => i !== idx);
        onUpdateSelectedBlock({ ...selectedBlock, options });
    };
    const handleSourceChange = (field, value) => {
        if (!selectedBlock)
            return;
        const currentSource = selectedBlock.source_citation || {};
        onUpdateSelectedBlock({
            ...selectedBlock,
            source_citation: {
                ...currentSource,
                [field]: value,
            },
        });
    };
    const { blockers, warnings, suggestions, metrics } = qualityResult;
    return (<div className="flex flex-col h-full bg-white border-l border-slate-200 w-80 shrink-0 text-slate-800 select-none">
      {/* ── 3-Tab Header (Properties · Quality · Sources) ── */}
      <div className="flex items-center border-b border-slate-200 bg-slate-50/70 p-1">
        <button onClick={() => setActiveTab('PROPERTIES')} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'PROPERTIES'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-800'}`}>
          <Sliders className="w-3.5 h-3.5"/>
          <span>Properties</span>
        </button>

        <button onClick={() => setActiveTab('QUALITY')} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors relative ${activeTab === 'QUALITY'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-800'}`}>
          <ShieldCheck className="w-3.5 h-3.5"/>
          <span>Quality</span>
          {blockers.length > 0 && (<span className="w-2 h-2 rounded-full bg-rose-500"/>)}
        </button>

        <button onClick={() => setActiveTab('SOURCES')} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'SOURCES'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-800'}`}>
          <Building2 className="w-3.5 h-3.5"/>
          <span>Sources</span>
        </button>
      </div>

      {/* ── TAB 1: PROPERTIES (Technical Configuration) ── */}
      {activeTab === 'PROPERTIES' && (<div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!selectedBlock ? (<div className="text-center py-10 text-xs text-slate-400">
              Select a block in the center canvas to configure properties.
            </div>) : (<>
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Configuring Block {selectedBlockIndex + 1}
                </span>
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {blockTitle}
                </h4>
              </div>

              {/* Activity Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Activity Type</label>
                <select value={selectedBlock.activity_type || 'OBSERVE'} onChange={(e) => onUpdateSelectedBlock({
                    ...selectedBlock,
                    activity_type: e.target.value,
                })} className="w-full p-2 text-xs font-medium border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500">
                  <option value="OBSERVE">OBSERVE (Visual / Conceptual exploration)</option>
                  <option value="PREDICT">PREDICT (Prediction task)</option>
                  <option value="EXPLAIN">EXPLAIN (Core mental model)</option>
                  <option value="PRACTICE">PRACTICE (Active retrieval)</option>
                  <option value="APPLICATION">APPLICATION (Decision scenario)</option>
                  <option value="EXPERIENCE">EXPERIENCE (Market immersion)</option>
                  <option value="RETRIEVE">RETRIEVE (Knowledge retrieval)</option>
                  <option value="REFLECT">REFLECT (Metacognitive synthesis)</option>
                </select>
              </div>

              {/* Cognitive Level */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cognitive Level</label>
                <select value={selectedBlock.cognitive_level || 'UNDERSTAND'} onChange={(e) => onUpdateSelectedBlock({
                    ...selectedBlock,
                    cognitive_level: e.target.value,
                })} className="w-full p-2 text-xs font-medium border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500">
                  <option value="REMEMBER">REMEMBER (Recall facts & basic concepts)</option>
                  <option value="UNDERSTAND">UNDERSTAND (Explain ideas or concepts)</option>
                  <option value="APPLY">APPLY (Use information in new situations)</option>
                  <option value="ANALYZE">ANALYZE (Draw connections among ideas)</option>
                  <option value="EVALUATE">EVALUATE (Justify a stand or decision)</option>
                </select>
              </div>

              {/* Difficulty Level */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Difficulty Level (1 - 5)</label>
                <select value={selectedBlock.difficulty || 1} onChange={(e) => onUpdateSelectedBlock({
                    ...selectedBlock,
                    difficulty: Number(e.target.value),
                })} className="w-full p-2 text-xs font-medium border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500">
                  <option value={1}>1 — Foundational / Introductory</option>
                  <option value={2}>2 — Basic Understanding</option>
                  <option value={3}>3 — Intermediate Application</option>
                  <option value={4}>4 — Advanced Analysis</option>
                  <option value={5}>5 — Expert / Synthesis</option>
                </select>
              </div>

              {/* Visual Renderer Type (Only for CANDLESTICK) */}
              {cType === 'CANDLESTICK' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Visual Renderer</label>
                  <select value={selectedBlock.renderer || 'CANDLESTICK'} onChange={(e) => onUpdateSelectedBlock({
                      ...selectedBlock,
                      renderer: e.target.value,
                  })} className="w-full p-2 text-xs font-medium border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500">
                    <option value="CANDLESTICK">CANDLESTICK (OHLC Interactive Candle)</option>
                    <option value="CHART">CHART (Multi-candle price chart)</option>
                  </select>
                </div>
              )}

              {/* Pure Content Context & Live Content Editor */}
              {isPureContent && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                    <div className="font-bold text-slate-700 flex items-center gap-1.5">
                      <span>Pure Content Block ({cType})</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Direct instructional content. Edits here synchronize live with the canvas and auto-save.
                    </p>
                  </div>

                  {cType === 'TEXT' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Content Text</label>
                      <textarea
                        rows={6}
                        value={selectedBlock.content?.text ?? selectedBlock.content?.body ?? selectedBlock.prompt ?? ''}
                        onChange={(e) =>
                          onUpdateSelectedBlock({
                            ...selectedBlock,
                            content: {
                              ...(selectedBlock.content || {}),
                              text: e.target.value,
                            },
                            prompt: e.target.value,
                          })
                        }
                        placeholder="Provide clear pedagogical explanation, market dynamics, and core conceptual rationale..."
                        className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 focus:bg-white resize-none font-sans"
                      />
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Markdown supported</span>
                        <span>{((selectedBlock.content?.text ?? selectedBlock.prompt ?? '').length)} characters</span>
                      </div>
                    </div>
                  )}

                  {cType === 'HEADING' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Heading Level</label>
                        <select
                          value={selectedBlock.content?.level || 'H1'}
                          onChange={(e) =>
                            onUpdateSelectedBlock({
                              ...selectedBlock,
                              content: {
                                ...(selectedBlock.content || {}),
                                level: e.target.value,
                              },
                            })
                          }
                          className="w-full p-2 text-xs font-medium border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500"
                        >
                          <option value="H1">H1 — Main Section Header</option>
                          <option value="H2">H2 — Sub-concept Header</option>
                          <option value="H3">H3 — Deep-dive Sub-point</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Heading Text</label>
                        <input
                          type="text"
                          value={selectedBlock.content?.title || selectedBlock.title || ''}
                          onChange={(e) =>
                            onUpdateSelectedBlock({
                              ...selectedBlock,
                              title: e.target.value,
                              content: {
                                ...(selectedBlock.content || {}),
                                title: e.target.value,
                                text: e.target.value,
                              },
                            })
                          }
                          placeholder="Section Heading Text..."
                          className="w-full text-xs p-2 border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {cType === 'CALLOUT' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Callout Text</label>
                        <textarea
                          rows={3}
                          value={selectedBlock.content?.text || ''}
                          onChange={(e) =>
                            onUpdateSelectedBlock({
                              ...selectedBlock,
                              content: {
                                ...(selectedBlock.content || {}),
                                text: e.target.value,
                              },
                            })
                          }
                          placeholder="Callout text..."
                          className="w-full text-xs p-2 border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {cType === 'ANALOGY' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Everyday Metaphor</label>
                        <input
                          type="text"
                          value={selectedBlock.content?.source_domain || selectedBlock.content?.metaphor || ''}
                          onChange={(e) =>
                            onUpdateSelectedBlock({
                              ...selectedBlock,
                              content: {
                                ...(selectedBlock.content || {}),
                                source_domain: e.target.value,
                                metaphor: e.target.value,
                              },
                            })
                          }
                          placeholder="e.g. A water reservoir valve"
                          className="w-full text-xs p-2 border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Financial Concept</label>
                        <input
                          type="text"
                          value={selectedBlock.content?.target_domain || selectedBlock.content?.concept || ''}
                          onChange={(e) =>
                            onUpdateSelectedBlock({
                              ...selectedBlock,
                              content: {
                                ...(selectedBlock.content || {}),
                                target_domain: e.target.value,
                                concept: e.target.value,
                              },
                            })
                          }
                          placeholder="e.g. Central bank repo rate"
                          className="w-full text-xs p-2 border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Bridge Explanation</label>
                        <textarea
                          rows={3}
                          value={selectedBlock.content?.explanation || selectedBlock.content?.text || ''}
                          onChange={(e) =>
                            onUpdateSelectedBlock({
                              ...selectedBlock,
                              content: {
                                ...(selectedBlock.content || {}),
                                explanation: e.target.value,
                                text: e.target.value,
                              },
                            })
                          }
                          placeholder="Explain how the everyday metaphor maps to the financial mechanism..."
                          className="w-full text-xs p-2 border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Controls (Only for non-pure-content) */}
              {!isPureContent && (<>
                {/* Response Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Response Type</label>
                  <select value={selectedBlock.response_type || 'SINGLE_CHOICE'} onChange={(e) => onUpdateSelectedBlock({
                      ...selectedBlock,
                      response_type: e.target.value,
                  })} className="w-full p-2 text-xs font-medium border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500">
                    <option value="SINGLE_CHOICE">SINGLE_CHOICE (Single Choice MCQ)</option>
                    <option value="MULTIPLE_CHOICE">MULTIPLE_CHOICE (Multi-Select Checkboxes)</option>
                    <option value="IMAGE_SELECTION">IMAGE_SELECTION (Image Multiple Choice)</option>
                    <option value="TRUE_FALSE">TRUE_FALSE (True / False)</option>
                  </select>
                </div>

                {/* Evidence Role with Plain-English Guidance & Hard Constraints */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-blue-600"/>
                      Evidence Role
                    </label>
                  </div>

                  <select value={selectedBlock.evidence_role || 'FORMATIVE'} onChange={(e) => handleEvidenceRoleChange(e.target.value)} className="w-full p-2 text-xs font-bold border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500 text-slate-800">
                    <option value="NONE">NONE (Practice only)</option>
                    <option value="FORMATIVE">FORMATIVE (Practice, no mastery change)</option>
                    <option value="DIAGNOSTIC">DIAGNOSTIC (Identifies misconceptions)</option>
                    <option value="MASTERY_EVIDENCE">MASTERY_EVIDENCE (Counts toward verified mastery)</option>
                  </select>

                  <p className="text-[11px] text-slate-500 leading-tight">
                    {selectedBlock.evidence_role === 'MASTERY_EVIDENCE'
                      ? '✓ Contributes verified Bayesian competence to concept mastery.'
                      : selectedBlock.evidence_role === 'FORMATIVE'
                          ? 'Formative practice without changing authoritative mastery.'
                          : 'Orientation or practice only.'}
                  </p>
                </div>

                {/* Multiple Choice Options Configuration */}
                {['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'IMAGE_SELECTION'].includes(selectedBlock.response_type || '') && (<div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        {selectedBlock.response_type === 'MULTIPLE_CHOICE'
                          ? 'Answer Options (Select all correct answers)'
                          : 'Answer Options (Select correct answer)'}
                      </label>
                      <button onClick={handleAddOption} className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
                        <Plus className="w-3 h-3"/> Add Option
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(selectedBlock.options || []).map((opt, idx) => {
                        const isMulti = selectedBlock.response_type === 'MULTIPLE_CHOICE';
                        const isCorrect = isMulti
                          ? Boolean(opt.is_correct || (selectedBlock.evaluation?.correct_option_ids || []).includes(opt.id) || (selectedBlock.correct_option_ids || []).includes(opt.id))
                          : Boolean(opt.is_correct === true || opt.id === selectedBlock.correct_option_id || opt.id === selectedBlock.evaluation?.correct_option_id);

                        return (
                          <div key={opt.id || idx} className="flex items-center gap-2">
                            <input
                              type={isMulti ? 'checkbox' : 'radio'}
                              name="correct_option"
                              checked={isCorrect}
                              onChange={() => {
                                if (isMulti) {
                                  const willBeCorrect = !isCorrect;
                                  const options = (selectedBlock.options || []).map((o, i) =>
                                    i === idx ? { ...o, is_correct: willBeCorrect } : o
                                  );
                                  const correctIds = options.filter((o) => o.is_correct).map((o) => o.id);
                                  onUpdateSelectedBlock({
                                    ...selectedBlock,
                                    options,
                                    correct_option_ids: correctIds,
                                    correct_option_id: correctIds[0] || null,
                                    evaluation: {
                                      ...(selectedBlock.evaluation || {}),
                                      correct_option_ids: correctIds,
                                      correct_option_id: correctIds[0] || null,
                                    },
                                  });
                                } else {
                                  handleSetCorrectOption(idx);
                                }
                              }}
                              title="Toggle as correct answer"
                              className="text-blue-600 focus:ring-blue-500 shrink-0 rounded"
                            />
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => handleOptionChange(idx, e.target.value)}
                              placeholder={`Option ${idx + 1}`}
                              className="flex-1 text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                            />
                            <button onClick={() => handleRemoveOption(idx)} className="p-1 text-slate-400 hover:text-rose-600 rounded">
                              <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>)}

                {/* Hint & Explanation Fields */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Learner Hint</label>
                    <input type="text" value={selectedBlock.hint || ''} onChange={(e) => onUpdateSelectedBlock({ ...selectedBlock, hint: e.target.value })} placeholder="e.g. Look at the upper shadow length..." className="w-full text-xs p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Explanation on Submit</label>
                    <textarea rows={2} value={selectedBlock.evaluation?.explanation || selectedBlock.explanation || ''} onChange={(e) => onUpdateSelectedBlock({
                        ...selectedBlock,
                        explanation: e.target.value,
                        evaluation: {
                          ...(selectedBlock.evaluation || {}),
                          explanation: e.target.value,
                        },
                    })} placeholder="Explain why the answer is correct..." className="w-full text-xs p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"/>
                  </div>
                </div>
              </>)}
            </>)}
        </div>)}

      {/* ── TAB 2: PEDAGOGICAL QUALITY (Rule Taxonomy & Insights) ── */}
      {activeTab === 'QUALITY' && (<div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Quality Summary Header */}
          <div className="p-3.5 rounded-xl border bg-slate-50 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Publishability Gate</span>
              {qualityResult.isPublishable ? (<span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4"/> Ready for Review
                </span>) : (<span className="text-rose-600 flex items-center gap-1">
                  <AlertOctagon className="w-4 h-4"/> Blocked
                </span>)}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                {blockers.length} Blockers
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                {warnings.length} Warnings
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                {suggestions.length} Suggestions
              </span>
            </div>
          </div>

          {/* Blockers List */}
          {blockers.length > 0 && (<div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-600">
                Critical Blockers (Must fix to submit)
              </div>
              {blockers.map((b) => (<div key={b.id} className="p-3 rounded-lg border border-rose-200 bg-rose-50/60 space-y-1.5 text-xs text-rose-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0"/>
                    <span>{b.title}</span>
                  </div>
                  <p className="text-rose-700 leading-tight">{b.message}</p>
                  <p className="text-[11px] text-rose-600/90 italic pt-0.5">{b.reason}</p>

                  {b.suggestedAction && onApplyQuickFix && (<button onClick={() => onApplyQuickFix(b)} className="mt-1 px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px]">
                      {b.suggestedAction.label}
                    </button>)}
                </div>))}
            </div>)}

          {/* Warnings List */}
          {warnings.length > 0 && (<div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                Pacing & Sequence Warnings
              </div>
              {warnings.map((w) => (<div key={w.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 space-y-1.5 text-xs text-amber-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0"/>
                    <span>{w.title}</span>
                  </div>
                  <p className="text-amber-800 leading-tight">{w.message}</p>
                  <p className="text-[11px] text-amber-700/90 italic pt-0.5">{w.reason}</p>
                </div>))}
            </div>)}

          {/* Suggestions List */}
          {suggestions.length > 0 && (<div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                Pedagogical Suggestions
              </div>
              {suggestions.map((s) => (<div key={s.id} className="p-3 rounded-lg border border-blue-200 bg-blue-50/60 space-y-1 text-xs text-blue-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0"/>
                    <span>{s.title}</span>
                  </div>
                  <p className="text-blue-800 leading-tight">{s.message}</p>
                </div>))}
            </div>)}

          {/* Lesson Experience Profile Box */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Lesson Experience Profile
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="text-slate-400 text-[10px] font-bold">EST. DURATION</div>
                <div className="text-base font-black text-slate-900">{metrics.estimatedMinutes} min</div>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="text-slate-400 text-[10px] font-bold">TOTAL ACTIVITIES</div>
                <div className="text-base font-black text-slate-900">{metrics.totalActivities}</div>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="text-slate-400 text-[10px] font-bold">INTERACTIVE</div>
                <div className="text-base font-black text-blue-600">{metrics.interactiveCount}</div>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="text-slate-400 text-[10px] font-bold">MASTERY EVIDENCE</div>
                <div className="text-base font-black text-emerald-600">{metrics.masteryCount}</div>
              </div>
            </div>
          </div>
        </div>)}

      {/* ── TAB 3: SOURCES & PROVENANCE (First-Class Citizen) ── */}
      {activeTab === 'SOURCES' && (<div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!selectedBlock ? (<div className="text-center py-10 text-xs text-slate-400">
              Select a block to inspect or attach regulatory and financial source provenance.
            </div>) : (<>
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Block {selectedBlockIndex + 1} Provenance
                </span>
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {blockTitle}
                </h4>
              </div>

              <div className="space-y-3">
                {/* Data Provider / Exchange */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Exchange / Authority</label>
                  <select value={selectedBlock.source_citation?.provider || 'NSE'} onChange={(e) => handleSourceChange('provider', e.target.value)} className="w-full p-2 text-xs border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-blue-500 font-semibold">
                    <option value="NSE">National Stock Exchange of India (NSE)</option>
                    <option value="BSE">Bombay Stock Exchange (BSE)</option>
                    <option value="SEBI">Securities and Exchange Board of India (SEBI)</option>
                    <option value="RBI">Reserve Bank of India (RBI)</option>
                    <option value="SIMULATED">Simulated Pedagogical Model</option>
                  </select>
                </div>

                {/* Instrument */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Financial Instrument</label>
                  <input type="text" value={selectedBlock.source_citation?.instrument || ''} onChange={(e) => handleSourceChange('instrument', e.target.value)} placeholder="e.g. NIFTY 50, RELIANCE, INFOSYS" className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
                </div>

                {/* Date of Observation */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Observation Date</label>
                  <input type="date" value={selectedBlock.source_citation?.date || '2026-08-28'} onChange={(e) => handleSourceChange('date', e.target.value)} className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
                </div>

                {/* Timeframe */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Candle Timeframe</label>
                  <select value={selectedBlock.source_citation?.timeframe || '1D'} onChange={(e) => handleSourceChange('timeframe', e.target.value)} className="w-full p-2 text-xs border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-blue-500">
                    <option value="1m">1 Minute</option>
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="1H">1 Hour</option>
                    <option value="1D">1 Day (Daily)</option>
                    <option value="1W">1 Week</option>
                  </select>
                </div>

                {/* Source Filing URL */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Source URL / Filing Citation</label>
                  <input type="text" value={selectedBlock.source_citation?.source_url || ''} onChange={(e) => handleSourceChange('source_url', e.target.value)} placeholder="https://www.nseindia.com/market-data..." className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
                </div>

                {/* Jurisdiction */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Regulatory Jurisdiction</label>
                  <input type="text" value={selectedBlock.source_citation?.jurisdiction || 'India (SEBI Regulated)'} onChange={(e) => handleSourceChange('jurisdiction', e.target.value)} className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
            </>)}
        </div>)}
    </div>);
};
