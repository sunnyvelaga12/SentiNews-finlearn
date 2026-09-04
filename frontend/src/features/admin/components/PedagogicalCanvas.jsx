import React, { useState } from 'react';
import {
  Eye,
  HelpCircle,
  Lightbulb,
  Sliders,
  BarChart2,
  AlertTriangle,
  ArrowRight,
  Share2,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Play,
  AlertCircle,
  Tag,
  Clock,
  Type,
  Heading,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  Table as TableIcon,
  CheckSquare,
  CheckCircle2,
  XCircle,
  Upload,
} from 'lucide-react';
import { MediaLibraryModal } from './MediaLibraryModal';

export const PedagogicalCanvas = ({
  lessonTitle,
  lessonSlug,
  durationMinutes,
  level,
  learningObjectives = [],
  blocks = [],
  activeBlockIndex = 0,
  pacingIssues = [],
  onUpdateMetadata,
  onSelectBlock,
  onUpdateBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onAddBlock,
  onPreviewStep,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newObjective, setNewObjective] = useState('');
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTargetBlockIdx, setMediaTargetBlockIdx] = useState(null);
  const [mediaTargetOptionIdx, setMediaTargetOptionIdx] = useState(null);

  // Content type visual config
  const contentTypeConfig = {
    HEADING: { label: 'Heading', icon: Heading, color: 'bg-purple-50 text-purple-700 border-purple-200' },
    TEXT: { label: 'Text / Explanation', icon: Type, color: 'bg-slate-50 text-slate-700 border-slate-200' },
    IMAGE: { label: 'Image Asset', icon: ImageIcon, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    CALLOUT: { label: 'Key Callout', icon: MessageSquare, color: 'bg-amber-50 text-amber-700 border-amber-200' },
    ANALOGY: { label: 'Real-World Analogy', icon: Sparkles, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CANDLESTICK: { label: 'Candlestick Chart', icon: BarChart2, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    TABLE: { label: 'Data Table', icon: TableIcon, color: 'bg-teal-50 text-teal-700 border-teal-200' },
    SCENARIO: { label: 'Market Scenario', icon: ArrowRight, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  const handleAddObjective = () => {
    if (!newObjective.trim()) return;
    onUpdateMetadata({
      learningObjectives: [...learningObjectives, newObjective.trim()],
    });
    setNewObjective('');
  };

  const handleRemoveObjective = (idx) => {
    onUpdateMetadata({
      learningObjectives: learningObjectives.filter((_, i) => i !== idx),
    });
  };

  const openMediaForBlock = (blockIdx) => {
    setMediaTargetBlockIdx(blockIdx);
    setMediaTargetOptionIdx(null);
    setMediaModalOpen(true);
  };

  const openMediaForOption = (blockIdx, optionIdx) => {
    setMediaTargetBlockIdx(blockIdx);
    setMediaTargetOptionIdx(optionIdx);
    setMediaModalOpen(true);
  };

  const handleSelectMedia = (asset) => {
    if (mediaTargetBlockIdx === null) return;
    const block = blocks[mediaTargetBlockIdx];
    if (!block) return;

    if (mediaTargetOptionIdx !== null) {
      // Image selected for a specific question option
      const nextOptions = [...(block.options || [])];
      nextOptions[mediaTargetOptionIdx] = {
        ...nextOptions[mediaTargetOptionIdx],
        media_asset_id: asset.id,
        image_url: asset.url || asset.asset_url,
      };
      onUpdateBlock(mediaTargetBlockIdx, { ...block, options: nextOptions });
    } else {
      // Image selected for the main block
      onUpdateBlock(mediaTargetBlockIdx, {
        ...block,
        media_asset_id: asset.id,
        content: {
          ...(block.content || {}),
          url: asset.url || asset.asset_url,
          image_url: asset.url || asset.asset_url,
          caption: block.content?.caption || asset.alt_text || '',
          alt: asset.alt_text || '',
        },
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBFBFA] p-8 max-w-4xl mx-auto w-full space-y-8">
      {/* ── Lesson Header (Metadata & Objectives) ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Lesson Title
            </label>
            <input
              type="text"
              value={lessonTitle || ''}
              onChange={(e) => onUpdateMetadata({ title: e.target.value })}
              placeholder="e.g. Understanding Overnight Lending & Repo Rates"
              className="w-full text-2xl font-black text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors"
            />
            <div className="text-xs text-slate-400 font-mono">slug: {lessonSlug || 'draft-slug'}</div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Level Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Level
              </label>
              <select
                value={level || 'BEGINNER'}
                onChange={(e) => onUpdateMetadata({ level: e.target.value })}
                className="text-xs font-bold border border-slate-200 rounded px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>

            {/* Duration Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Duration (min)
              </label>
              <div className="flex items-center gap-1 border border-slate-200 rounded px-2 py-1 bg-slate-50">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={durationMinutes || 5}
                  onChange={(e) =>
                    onUpdateMetadata({ durationMinutes: parseInt(e.target.value) || 5 })
                  }
                  className="w-12 text-xs font-bold bg-transparent text-slate-700 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Learning Objectives Tag List */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-500" />
              Learning Objectives ({learningObjectives.length})
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {learningObjectives.map((obj, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200"
              >
                <span>{obj}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveObjective(idx)}
                  className="hover:text-rose-600 rounded-full p-0.5 text-slate-400"
                >
                  ×
                </button>
              </span>
            ))}

            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="+ Add objective..."
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddObjective()}
                className="text-xs px-2.5 py-1 border border-dashed border-slate-300 rounded-full bg-slate-50 focus:outline-none focus:border-blue-500 text-slate-700"
              />
              {newObjective.trim() && (
                <button
                  type="button"
                  onClick={handleAddObjective}
                  className="text-xs px-2 py-1 rounded bg-blue-600 text-white font-bold"
                >
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sequence Pacing Advisory Banner ── */}
      {pacingIssues.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-900">Sequence Pacing Advisory</div>
            <p className="text-amber-700 leading-relaxed">{pacingIssues[0].description}</p>
          </div>
        </div>
      )}

      {/* ── Visual Flow Navigation Journey Ribbon ── */}
      {blocks.length > 0 && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>CURRICULUM FLOW SEQUENCE</span>
            <span className="text-slate-400">Click any block to jump & configure</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {blocks.map((b, i) => {
              const cType = b.content_type || b.type || 'TEXT';
              const cfg = contentTypeConfig[cType] || contentTypeConfig.TEXT;
              const StepIcon = cfg.icon;
              const isActive = i === activeBlockIndex;
              return (
                <React.Fragment key={b.id || i}>
                  <button
                    type="button"
                    onClick={() => onSelectBlock(i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all border ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="opacity-70 font-mono text-[10px]">{i + 1}.</span>
                    <StepIcon className="w-3.5 h-3.5" />
                    <span>
                      {b.title
                        ? b.title.length > 18
                          ? b.title.slice(0, 18) + '...'
                          : b.title
                        : cfg.label}
                    </span>
                    {b.evidence_role === 'MASTERY_EVIDENCE' && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isActive ? 'bg-amber-300' : 'bg-emerald-500'
                        }`}
                        title="Mastery Evidence Assessment"
                      />
                    )}
                  </button>
                  {i < blocks.length - 1 && (
                    <span className="text-slate-300 text-xs font-mono shrink-0">➔</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Content Blocks Timeline ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wider uppercase text-slate-500">
              Content & Interactive Blocks
            </span>
            <span className="text-xs font-bold text-slate-400">({blocks.length} blocks)</span>
          </div>
          <div className="text-xs text-slate-400">
            Supports arbitrary ordering across all financial concepts
          </div>
        </div>

        {/* Empty state when no blocks */}
        {blocks.length === 0 && (
          <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 space-y-3">
            <Type className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No content blocks yet</div>
            <p className="text-xs text-slate-500">
              Add headings, explanatory text, diagrams, or interactive questions below.
            </p>
          </div>
        )}

        {/* Blocks List */}
        <div className="space-y-4">
          {blocks.map((b, idx) => {
            const isSelected = idx === activeBlockIndex;
            const cType = b.content_type || b.type || 'TEXT';
            const rType = b.response_type || 'NONE';
            const config = contentTypeConfig[cType] || contentTypeConfig.TEXT;
            const Icon = config.icon;
            const content = b.content || {};

            return (
              <div
                key={b.id || idx}
                onClick={() => onSelectBlock(idx)}
                className={`group relative p-5 rounded-xl border transition-all cursor-pointer bg-white ${
                  isSelected
                    ? 'border-blue-500 shadow-md ring-2 ring-blue-500/10'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Step Index & Badge */}
                  <div className="flex items-start gap-3.5 flex-1">
                    <span className="text-xs font-black text-slate-400 pt-1 shrink-0 font-mono">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="space-y-3 flex-1">
                      {/* Top Meta Badges & Discriminators */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Content Type Selector */}
                        <select
                          value={cType}
                          onChange={(e) =>
                            onUpdateBlock(idx, {
                              ...b,
                              content_type: e.target.value,
                              type: e.target.value,
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
                          className={`text-[11px] font-bold rounded px-2 py-0.5 border bg-white focus:outline-none focus:border-blue-500 ${config.color}`}
                        >
                          <option value="HEADING">HEADING</option>
                          <option value="TEXT">TEXT</option>
                          <option value="IMAGE">IMAGE</option>
                          <option value="CALLOUT">CALLOUT</option>
                          <option value="ANALOGY">ANALOGY</option>
                          <option value="CANDLESTICK">CANDLESTICK</option>
                          <option value="TABLE">TABLE</option>
                          <option value="SCENARIO">SCENARIO</option>
                        </select>

                        {/* Response Type Selector */}
                        <select
                          value={rType}
                          onChange={(e) => {
                            const nextRType = e.target.value;
                            const isInteractive = nextRType !== 'NONE';
                            onUpdateBlock(idx, {
                              ...b,
                              response_type: nextRType,
                              evidence_role: isInteractive && b.evidence_role === 'NONE' ? 'FORMATIVE' : b.evidence_role,
                              options: isInteractive && (!b.options || b.options.length === 0) ? [
                                { id: `opt_${Date.now()}_1`, text: 'Option A', is_correct: true },
                                { id: `opt_${Date.now()}_2`, text: 'Option B', is_correct: false },
                              ] : b.options,
                              evaluation: isInteractive && !b.evaluation ? {
                                correct_option_id: `opt_${Date.now()}_1`,
                                explanation: 'Explanation for learner feedback.',
                              } : b.evaluation,
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-[11px] font-bold rounded px-2 py-0.5 border focus:outline-none focus:border-blue-500 ${
                            rType === 'NONE'
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          }`}
                        >
                          <option value="NONE">PURE CONTENT (No Evaluation)</option>
                          <option value="SINGLE_CHOICE">SINGLE CHOICE MCQ</option>
                          <option value="IMAGE_SELECTION">IMAGE SELECTION MCQ</option>
                          <option value="TRUE_FALSE">TRUE / FALSE</option>
                        </select>

                        {/* Activity Type Metadata */}
                        <select
                          value={b.activity_type || 'EXPERIENCE'}
                          onChange={(e) =>
                            onUpdateBlock(idx, { ...b, activity_type: e.target.value })
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 rounded px-1.5 py-0.5 focus:outline-none"
                        >
                          <option value="OBSERVE">Observe</option>
                          <option value="PREDICT">Predict</option>
                          <option value="EXPLAIN">Explain</option>
                          <option value="PRACTICE">Practice</option>
                          <option value="APPLICATION">Application</option>
                          <option value="EXPERIENCE">Experience</option>
                          <option value="RETRIEVE">Retrieve</option>
                          <option value="REFLECT">Reflect</option>
                        </select>

                        {/* Evidence Role */}
                        {rType !== 'NONE' && (
                          <select
                            value={b.evidence_role || 'FORMATIVE'}
                            onChange={(e) =>
                              onUpdateBlock(idx, { ...b, evidence_role: e.target.value })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 focus:outline-none"
                          >
                            <option value="NONE">Formative Only</option>
                            <option value="FORMATIVE">Formative Evidence</option>
                            <option value="DIAGNOSTIC">Diagnostic</option>
                            <option value="MASTERY_EVIDENCE">Mastery Evidence</option>
                          </select>
                        )}
                      </div>

                      {/* Block Title */}
                      <input
                        type="text"
                        value={b.title || ''}
                        onChange={(e) => onUpdateBlock(idx, { ...b, title: e.target.value })}
                        placeholder="Block Title (e.g. Overnight Repo Rate Mechanics)"
                        className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none"
                      />

                      {/* ── 1. HEADING Content Editor ── */}
                      {cType === 'HEADING' && (
                        <div className="space-y-2 p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                          <div className="flex items-center gap-3">
                            <label className="text-[10px] font-bold text-purple-900 uppercase">
                              Level:
                            </label>
                            <select
                              value={content.level || 1}
                              onChange={(e) =>
                                onUpdateBlock(idx, {
                                  ...b,
                                  content: { ...content, level: parseInt(e.target.value) || 1 },
                                })
                              }
                              className="text-xs font-bold border border-purple-200 rounded px-2 py-1 bg-white"
                            >
                              <option value="1">H1 — Main Section</option>
                              <option value="2">H2 — Key Sub-concept</option>
                              <option value="3">H3 — Deep-dive Point</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            value={content.title || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: { ...content, title: e.target.value },
                              })
                            }
                            placeholder="Section Heading Text..."
                            className="w-full text-base font-bold bg-white border border-purple-200 rounded p-2 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      )}

                      {/* ── 2. TEXT Content Editor ── */}
                      {cType === 'TEXT' && (
                        <textarea
                          rows={3}
                          value={content.body || b.prompt || ''}
                          onChange={(e) =>
                            onUpdateBlock(idx, {
                              ...b,
                              content: { ...content, body: e.target.value },
                              prompt: e.target.value,
                            })
                          }
                          placeholder="Provide clear pedagogical explanation, market dynamics, and core conceptual rationale..."
                          className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                        />
                      )}

                      {/* ── 3. IMAGE Content Editor (Integrated with MediaLibraryModal) ── */}
                      {cType === 'IMAGE' && (
                        <div className="space-y-3 p-3.5 bg-blue-50/40 rounded-lg border border-blue-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                              Image Asset & Diagram
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openMediaForBlock(idx);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Select / Upload Image</span>
                            </button>
                          </div>

                          {content.url || content.image_url ? (
                            <div className="flex items-start gap-4">
                              <img
                                src={content.url || content.image_url}
                                alt={content.alt || 'Asset diagram'}
                                className="w-32 h-24 object-contain rounded border border-slate-200 bg-white p-1"
                              />
                              <div className="flex-1 space-y-2">
                                <input
                                  type="text"
                                  value={content.caption || ''}
                                  onChange={(e) =>
                                    onUpdateBlock(idx, {
                                      ...b,
                                      content: { ...content, caption: e.target.value },
                                    })
                                  }
                                  placeholder="Image caption / explanation..."
                                  className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white"
                                />
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  Asset ID: {b.media_asset_id || 'Embedded URL'}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                openMediaForBlock(idx);
                              }}
                              className="p-6 text-center border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-lg cursor-pointer bg-white transition-colors"
                            >
                              <ImageIcon className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                              <span className="text-xs font-semibold text-blue-600">
                                Click to choose an image from Media Library or upload a new asset
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── 4. CALLOUT Content Editor ── */}
                      {cType === 'CALLOUT' && (
                        <div className="space-y-2 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-900 uppercase">
                              Tone:
                            </span>
                            <select
                              value={content.tone || 'INFO'}
                              onChange={(e) =>
                                onUpdateBlock(idx, {
                                  ...b,
                                  content: { ...content, tone: e.target.value },
                                })
                              }
                              className="text-xs font-bold border border-amber-200 rounded px-2 py-0.5 bg-white"
                            >
                              <option value="INFO">Information</option>
                              <option value="TIP">Pro Tip</option>
                              <option value="WARNING">Risk / Warning</option>
                              <option value="KEY_TAKEAWAY">Key Takeaway</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            value={content.title || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: { ...content, title: e.target.value },
                              })
                            }
                            placeholder="Callout Title (e.g. Critical Principle)..."
                            className="w-full text-xs font-bold bg-white border border-amber-200 rounded p-1.5 focus:outline-none"
                          />
                          <textarea
                            rows={2}
                            value={content.body || content.takeaway || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: { ...content, body: e.target.value, takeaway: e.target.value },
                              })
                            }
                            placeholder="Callout message or core takeaway..."
                            className="w-full text-xs bg-white border border-amber-200 rounded p-1.5 focus:outline-none resize-none"
                          />
                        </div>
                      )}

                      {/* ── 5. ANALOGY Content Editor ── */}
                      {cType === 'ANALOGY' && (
                        <div className="space-y-2.5 p-3 bg-emerald-50/40 rounded-lg border border-emerald-100">
                          <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                            Everyday Intuition Analogy
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-emerald-800">
                                Everyday Metaphor:
                              </label>
                              <input
                                type="text"
                                value={content.source_domain || content.metaphor || ''}
                                onChange={(e) =>
                                  onUpdateBlock(idx, {
                                    ...b,
                                    content: { ...content, source_domain: e.target.value, metaphor: e.target.value },
                                  })
                                }
                                placeholder="e.g. A water reservoir valve"
                                className="w-full text-xs p-1.5 bg-white border border-emerald-200 rounded"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-emerald-800">
                                Financial Concept:
                              </label>
                              <input
                                type="text"
                                value={content.target_domain || content.concept || ''}
                                onChange={(e) =>
                                  onUpdateBlock(idx, {
                                    ...b,
                                    content: { ...content, target_domain: e.target.value, concept: e.target.value },
                                  })
                                }
                                placeholder="e.g. Central Bank Repo Rate"
                                className="w-full text-xs p-1.5 bg-white border border-emerald-200 rounded"
                              />
                            </div>
                          </div>
                          <textarea
                            rows={2}
                            value={content.mapping_text || content.explanation || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: { ...content, mapping_text: e.target.value, explanation: e.target.value },
                              })
                            }
                            placeholder="Explain how the metaphor directly maps to the market mechanics..."
                            className="w-full text-xs bg-white border border-emerald-200 rounded p-1.5 resize-none"
                          />
                        </div>
                      )}

                      {/* ── 6. CANDLESTICK Content Editor (Flexible OHLC) ── */}
                      {cType === 'CANDLESTICK' && (
                        <div className="space-y-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Interactive Candlestick Coordinates
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                                (content.close ?? 120) >= (content.open ?? 100)
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {(content.close ?? 120) >= (content.open ?? 100)
                                ? 'Bullish (Green)'
                                : 'Bearish (Red)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="w-20 h-24 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center shrink-0 shadow-inner">
                              <svg viewBox="0 0 100 120" className="w-full h-full">
                                <line
                                  x1="50"
                                  y1="10"
                                  x2="50"
                                  y2="110"
                                  stroke={
                                    (content.close ?? 120) >= (content.open ?? 100)
                                      ? '#10B981'
                                      : '#EF4444'
                                  }
                                  strokeWidth="3"
                                />
                                <rect
                                  x="30"
                                  y="35"
                                  width="40"
                                  height="50"
                                  fill={
                                    (content.close ?? 120) >= (content.open ?? 100)
                                      ? '#10B981'
                                      : '#EF4444'
                                  }
                                  rx="2"
                                />
                              </svg>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                              {['open', 'high', 'low', 'close'].map((key) => (
                                <div key={key}>
                                  <label className="text-[10px] font-bold text-slate-500 block uppercase">
                                    {key}
                                  </label>
                                  <input
                                    type="number"
                                    value={content[key] ?? (key === 'high' ? 125 : key === 'low' ? 95 : key === 'close' ? 120 : 100)}
                                    onChange={(e) =>
                                      onUpdateBlock(idx, {
                                        ...b,
                                        content: { ...content, [key]: Number(e.target.value) },
                                        payload: { ...(b.payload || {}), [key]: Number(e.target.value) },
                                      })
                                    }
                                    className="w-full p-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── 7. TABLE Content Editor ── */}
                      {cType === 'TABLE' && (
                        <div className="space-y-2 p-3 bg-teal-50/40 rounded-lg border border-teal-100">
                          <span className="text-[10px] font-bold text-teal-900 uppercase tracking-wider block">
                            Financial Data Table
                          </span>
                          <input
                            type="text"
                            value={content.caption || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: { ...content, caption: e.target.value },
                              })
                            }
                            placeholder="Table caption / title..."
                            className="w-full text-xs p-1.5 bg-white border border-teal-200 rounded"
                          />
                        </div>
                      )}

                      {/* ── 8. SCENARIO Content Editor ── */}
                      {cType === 'SCENARIO' && (
                        <div className="space-y-2 p-3 bg-rose-50/40 rounded-lg border border-rose-100">
                          <span className="text-[10px] font-bold text-rose-900 uppercase tracking-wider block">
                            Market Dilemma Scenario
                          </span>
                          <textarea
                            rows={2}
                            value={content.context || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: { ...content, context: e.target.value },
                              })
                            }
                            placeholder="Describe market situation, asset state, and environment..."
                            className="w-full text-xs bg-white border border-rose-200 rounded p-1.5 resize-none"
                          />
                        </div>
                      )}

                      {/* ── Interactive Response Options & Answer Key (MCQ / Image Selection / True-False) ── */}
                      {rType === 'SINGLE_CHOICE' && (
                        <div className="mt-3 p-3.5 rounded-lg bg-blue-50/50 border border-blue-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                              Multiple Choice Options & Answer Key
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const existing = b.options || [];
                                const newOptId = `opt_${Date.now()}_${existing.length + 1}`;
                                const newOpt = {
                                  id: newOptId,
                                  text: `Option ${existing.length + 1}`,
                                  is_correct: false,
                                };
                                onUpdateBlock(idx, {
                                  ...b,
                                  options: [...existing, newOpt],
                                });
                              }}
                              className="text-[11px] font-bold text-blue-700 hover:text-blue-800"
                            >
                              + Add Option
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(b.options || []).map((opt, optIdx) => {
                              const isCorrect =
                                (b.evaluation?.correct_option_id === opt.id) ||
                                opt.is_correct ||
                                b.correct_option_id === opt.id;
                              return (
                                <div key={opt.id || optIdx} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct_opt_${b.id || idx}`}
                                    checked={isCorrect}
                                    onChange={() => {
                                      const updatedOpts = (b.options || []).map((o) => ({
                                        ...o,
                                        is_correct: o.id === opt.id,
                                      }));
                                      onUpdateBlock(idx, {
                                        ...b,
                                        options: updatedOpts,
                                        evaluation: {
                                          ...(b.evaluation || {}),
                                          correct_option_id: opt.id,
                                        },
                                        correct_option_id: opt.id,
                                      });
                                    }}
                                    className="text-blue-600 focus:ring-blue-500"
                                    title="Mark as correct answer"
                                  />
                                  <input
                                    type="text"
                                    value={opt.text || ''}
                                    onChange={(e) => {
                                      const updatedOpts = (b.options || []).map((o, i) =>
                                        i === optIdx ? { ...o, text: e.target.value } : o
                                      );
                                      onUpdateBlock(idx, { ...b, options: updatedOpts });
                                    }}
                                    placeholder={`Option ${optIdx + 1}`}
                                    className="flex-1 p-1.5 text-xs bg-white border border-slate-200 rounded focus:border-blue-500 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedOpts = (b.options || []).filter(
                                        (_, i) => i !== optIdx
                                      );
                                      onUpdateBlock(idx, { ...b, options: updatedOpts });
                                    }}
                                    className="text-slate-400 hover:text-rose-600 text-xs px-1"
                                    title="Delete option"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation for remediation */}
                          <div className="pt-2 border-t border-blue-100">
                            <label className="text-[10px] font-bold text-blue-800 uppercase block mb-1">
                              Explanation / Pedagogical Feedback:
                            </label>
                            <textarea
                              rows={2}
                              value={b.evaluation?.explanation || b.feedback?.explanation || ''}
                              onChange={(e) =>
                                onUpdateBlock(idx, {
                                  ...b,
                                  evaluation: {
                                    ...(b.evaluation || {}),
                                    explanation: e.target.value,
                                    correct_option_id:
                                      b.evaluation?.correct_option_id ||
                                      b.options?.find((o) => o.is_correct)?.id ||
                                      b.options?.[0]?.id,
                                  },
                                  feedback: { explanation: e.target.value },
                                })
                              }
                              placeholder="Explain why the correct answer holds and common beginner traps..."
                              className="w-full text-xs p-2 bg-white border border-blue-200 rounded focus:outline-none resize-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* ── IMAGE_SELECTION Response Editor ── */}
                      {rType === 'IMAGE_SELECTION' && (
                        <div className="mt-3 p-3.5 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                              Image Selection Cards (Select the Visual Pattern)
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const existing = b.options || [];
                                const newOptId = `opt_${Date.now()}_${existing.length + 1}`;
                                onUpdateBlock(idx, {
                                  ...b,
                                  options: [
                                    ...existing,
                                    { id: newOptId, label: `Choice ${existing.length + 1}`, is_correct: false },
                                  ],
                                });
                              }}
                              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800"
                            >
                              + Add Visual Choice
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {(b.options || []).map((opt, optIdx) => {
                              const isCorrect =
                                (b.evaluation?.correct_option_id === opt.id) ||
                                opt.is_correct ||
                                b.correct_option_id === opt.id;
                              return (
                                <div
                                  key={opt.id || optIdx}
                                  className={`p-2.5 rounded-lg border bg-white space-y-2 ${
                                    isCorrect
                                      ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                                      : 'border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                      <input
                                        type="radio"
                                        name={`img_correct_${b.id || idx}`}
                                        checked={isCorrect}
                                        onChange={() => {
                                          const updatedOpts = (b.options || []).map((o) => ({
                                            ...o,
                                            is_correct: o.id === opt.id,
                                          }));
                                          onUpdateBlock(idx, {
                                            ...b,
                                            options: updatedOpts,
                                            evaluation: {
                                              ...(b.evaluation || {}),
                                              correct_option_id: opt.id,
                                            },
                                            correct_option_id: opt.id,
                                          });
                                        }}
                                      />
                                      <span>Correct</span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedOpts = (b.options || []).filter(
                                          (_, i) => i !== optIdx
                                        );
                                        onUpdateBlock(idx, { ...b, options: updatedOpts });
                                      }}
                                      className="text-slate-400 hover:text-rose-600 text-xs"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  {opt.image_url ? (
                                    <img
                                      src={opt.image_url}
                                      alt="Choice visual"
                                      className="w-full h-20 object-contain rounded border border-slate-100 bg-slate-50"
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openMediaForOption(idx, optIdx);
                                      }}
                                      className="w-full py-4 text-center border border-dashed border-slate-300 rounded text-xs text-indigo-600 hover:bg-indigo-50/50"
                                    >
                                      + Choose Image
                                    </button>
                                  )}

                                  <input
                                    type="text"
                                    value={opt.label || opt.text || ''}
                                    onChange={(e) => {
                                      const updatedOpts = (b.options || []).map((o, i) =>
                                        i === optIdx
                                          ? { ...o, label: e.target.value, text: e.target.value }
                                          : o
                                      );
                                      onUpdateBlock(idx, { ...b, options: updatedOpts });
                                    }}
                                    placeholder="Label (e.g. Doji / Dragonfly)"
                                    className="w-full text-xs p-1 border border-slate-200 rounded"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── TRUE_FALSE Response Editor ── */}
                      {rType === 'TRUE_FALSE' && (
                        <div className="mt-3 p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-100 space-y-2.5">
                          <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                            True / False Answer Key
                          </span>
                          <div className="flex items-center gap-6">
                            {['True', 'False'].map((tfVal) => {
                              const optId = `opt_${tfVal.toLowerCase()}`;
                              const isCorrect =
                                b.evaluation?.correct_option_id === optId ||
                                b.options?.find((o) => o.id === optId)?.is_correct;
                              return (
                                <label
                                  key={tfVal}
                                  className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer"
                                >
                                  <input
                                    type="radio"
                                    name={`tf_correct_${b.id || idx}`}
                                    checked={Boolean(isCorrect)}
                                    onChange={() => {
                                      const tfOpts = [
                                        { id: 'opt_true', text: 'True', is_correct: tfVal === 'True' },
                                        { id: 'opt_false', text: 'False', is_correct: tfVal === 'False' },
                                      ];
                                      onUpdateBlock(idx, {
                                        ...b,
                                        options: tfOpts,
                                        evaluation: {
                                          ...(b.evaluation || {}),
                                          correct_option_id: optId,
                                        },
                                        correct_option_id: optId,
                                      });
                                    }}
                                  />
                                  <span>{tfVal}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                    {onPreviewStep && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewStep(idx);
                        }}
                        title="Preview this step"
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveBlock(idx, 'UP');
                      }}
                      disabled={idx === 0}
                      title="Move Up"
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-20"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveBlock(idx, 'DOWN');
                      }}
                      disabled={idx === blocks.length - 1}
                      title="Move Down"
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-20"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateBlock(idx);
                      }}
                      title="Duplicate Block"
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBlock(idx);
                      }}
                      title="Delete Block"
                      className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── + Add Learning Block Menu (Modular Registry) ── */}
        <div className="pt-3">
          {!showAddMenu ? (
            <button
              type="button"
              onClick={() => setShowAddMenu(true)}
              className="w-full py-3.5 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-600 bg-white/60 hover:bg-blue-50/40 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Content or Question Block</span>
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Select Content / Question Type
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddMenu(false)}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              {/* Section 1: Pure Content Blocks */}
              <div className="space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Pure Content Blocks (response_type = NONE)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'HEADING', label: 'Heading', icon: Heading, desc: 'H1/H2/H3 Section dividers' },
                    { type: 'TEXT', label: 'Text Explainer', icon: Type, desc: 'Authoritative financial copy' },
                    { type: 'IMAGE', label: 'Media / Diagram', icon: ImageIcon, desc: 'Chart or technical illustration' },
                    { type: 'CALLOUT', label: 'Key Callout', icon: MessageSquare, desc: 'High-signal highlight / tip' },
                    { type: 'ANALOGY', label: 'Real Analogy', icon: Sparkles, desc: 'Intuitive mental metaphor' },
                    { type: 'CANDLESTICK', label: 'Candlestick', icon: BarChart2, desc: 'Interactive OHLC diagram' },
                    { type: 'TABLE', label: 'Data Table', icon: TableIcon, desc: 'Structured numerical metrics' },
                    { type: 'SCENARIO', label: 'Market Context', icon: ArrowRight, desc: 'Real-world trading setup' },
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => {
                          onAddBlock({
                            content_type: item.type,
                            response_type: 'NONE',
                            activity_type: 'EXPERIENCE',
                            evidence_role: 'NONE',
                            title: `New ${item.label}`,
                          });
                          setShowAddMenu(false);
                        }}
                        className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all flex flex-col gap-1 group"
                      >
                        <div className="flex items-center gap-1.5">
                          <ItemIcon className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600" />
                          <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 leading-tight">
                          {item.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Interactive Assessment Blocks */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                  Interactive Evaluation Questions (response_type != NONE)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      content_type: 'TEXT',
                      response_type: 'SINGLE_CHOICE',
                      activity_type: 'PRACTICE',
                      evidence_role: 'MASTERY_EVIDENCE',
                      label: 'Multiple Choice MCQ',
                      desc: 'Standard multiple choice question with feedback',
                      icon: CheckSquare,
                    },
                    {
                      content_type: 'IMAGE',
                      response_type: 'IMAGE_SELECTION',
                      activity_type: 'PRACTICE',
                      evidence_role: 'MASTERY_EVIDENCE',
                      label: 'Visual Image Selection',
                      desc: 'Select the matching chart pattern among choices',
                      icon: ImageIcon,
                    },
                    {
                      content_type: 'TEXT',
                      response_type: 'TRUE_FALSE',
                      activity_type: 'PRACTICE',
                      evidence_role: 'FORMATIVE',
                      label: 'True / False Check',
                      desc: 'Rapid misconception check with binary choice',
                      icon: HelpCircle,
                    },
                  ].map((item, qIdx) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={qIdx}
                        type="button"
                        onClick={() => {
                          onAddBlock({
                            content_type: item.content_type,
                            response_type: item.response_type,
                            activity_type: item.activity_type,
                            evidence_role: item.evidence_role,
                            title: `Question: ${item.label}`,
                          });
                          setShowAddMenu(false);
                        }}
                        className="text-left p-3 rounded-lg border border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex items-start gap-2.5 group"
                      >
                        <ItemIcon className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight">
                            {item.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Media Asset Library Modal ── */}
      <MediaLibraryModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleSelectMedia}
      />
    </div>
  );
};
