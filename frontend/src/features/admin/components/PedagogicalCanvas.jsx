import React, { useState, useRef } from 'react';
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
  Layers,
  GripVertical,
  X,
  Zap,
  PenLine,
  Compass,
  LayoutList,
} from 'lucide-react';
import { MediaLibraryModal } from './MediaLibraryModal';
import { useMediaAsset, cacheMediaAsset } from '../utils/mediaResolver';
import {
  BLOCK_CAPABILITIES,
  CONTENT_BLOCK_TYPES,
  INTERACTIVE_BLOCK_TYPES,
  generateUUID,
} from '../utils/blockRegistry';

/**
 * Renders derived media display image dynamically from canonical media_asset_id.
 * URLs are strictly derived and NEVER read from or persisted into blocks_json.
 */
function MediaImagePreview({ mediaAssetId, alt = '', className = '', fallbackText = 'No image selected' }) {
  const { url, isLoading } = useMediaAsset(mediaAssetId);

  if (!mediaAssetId) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-50 border border-dashed border-slate-300 text-slate-400 p-4 rounded-lg ${className}`}>
        <ImageIcon className="w-6 h-6 text-slate-300 mb-1" />
        <span className="text-[11px] font-medium">{fallbackText}</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 p-4 rounded-lg animate-pulse ${className}`}>
        <span className="text-[11px]">Loading media...</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`flex flex-col items-center justify-center bg-rose-50 border border-rose-200 text-rose-500 p-3 rounded-lg ${className}`}>
        <AlertCircle className="w-4 h-4 mb-1" />
        <span className="text-[10px] font-mono">Asset: {String(mediaAssetId).slice(0, 8)}...</span>
        <span className="text-[10px] text-rose-400">Unresolved asset</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt || 'Lesson media'}
      className={className}
      onError={(e) => {
        e.target.onerror = null;
        e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f1f5f9" width="100" height="100"/><text fill="%2394a3b8" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">Image</text></svg>';
      }}
    />
  );
}

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
  onReorderBlocks,
  onPreviewStep,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newObjective, setNewObjective] = useState('');
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTargetBlockIdx, setMediaTargetBlockIdx] = useState(null);
  const [mediaTargetOptionIdx, setMediaTargetOptionIdx] = useState(null);

  // ── Drag-to-Reorder State ──────────────────────────────────────────────────
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dropTargetIdx, setDropTargetIdx] = useState(null);
  const dragCounter = useRef(0);

  // ── Insert-at-Position State (Google Forms style) ─────────────────────────
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [insertAtIdx, setInsertAtIdx] = useState(null); // null = append

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

  const isFallbackObjective = (text) => {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return lower.includes('fallback') || lower.includes('temporary') || text.includes('⚠');
  };

  const hasFallbackObjectives = learningObjectives.some(isFallbackObjective);

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

    cacheMediaAsset(asset);
    const assetId = asset.id || asset.media_asset_id;

    if (mediaTargetOptionIdx !== null) {
      // Image selected for a specific question option
      const nextOptions = [...(block.options || [])];
      const targetOpt = { ...(nextOptions[mediaTargetOptionIdx] || {}) };
      targetOpt.media_asset_id = assetId;
      // STRICT REQUIREMENT: NEVER persist image_url or url into blocks_json!
      delete targetOpt.image_url;
      delete targetOpt.url;
      nextOptions[mediaTargetOptionIdx] = targetOpt;
      onUpdateBlock(mediaTargetBlockIdx, { ...block, options: nextOptions });
    } else {
      // Image selected for the main block
      const nextContent = { ...(block.content || {}) };
      // STRICT REQUIREMENT: NEVER persist image_url or url into blocks_json!
      delete nextContent.url;
      delete nextContent.image_url;
      if (asset.alt_text) nextContent.alt_text = asset.alt_text;
      if (asset.alt_text && !nextContent.caption) nextContent.caption = asset.alt_text;

      onUpdateBlock(mediaTargetBlockIdx, {
        ...block,
        media_asset_id: assetId,
        content: nextContent,
      });
    }
  };

  // ── Drag Handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e, idx) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleDragEnter = (e, idx) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (idx !== draggingIdx) setDropTargetIdx(idx);
  };

  const handleDragLeave = () => {
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDropTargetIdx(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    dragCounter.current = 0;
    if (draggingIdx === null || draggingIdx === dropIdx) {
      setDraggingIdx(null);
      setDropTargetIdx(null);
      return;
    }
    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(draggingIdx, 1);
    nextBlocks.splice(dropIdx, 0, moved);
    nextBlocks.forEach((b, i) => { b.order_index = i; });
    if (onReorderBlocks) onReorderBlocks(nextBlocks);
    setDraggingIdx(null);
    setDropTargetIdx(null);
  };

  const handleDragEnd = () => {
    dragCounter.current = 0;
    setDraggingIdx(null);
    setDropTargetIdx(null);
  };

  // ── Insert-at-Position Handler ─────────────────────────────────────────────
  const openPickerAt = (insertIdx) => {
    setInsertAtIdx(insertIdx);
    setShowBlockPicker(true);
  };

  const handlePickBlock = (blockType) => {
    setShowBlockPicker(false);
    if (onAddBlock) onAddBlock(blockType, insertAtIdx);
    setInsertAtIdx(null);
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

          {/* Development Fallback Warning Banner */}
          {hasFallbackObjectives && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold">⚠ Development Fallback Objective Detected (Temporary)</div>
                <p className="text-amber-800 leading-tight">
                  This objective was auto-provisioned during development. A development-generated fallback objective must never be promoted to production content and will block publication. Replace it with an authoritative objective.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {learningObjectives.map((obj, idx) => {
              const isFallback = isFallbackObjective(obj);
              return (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                    isFallback
                      ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-400/30'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                  title={
                    isFallback
                      ? '⚠ Development fallback objective (temporary). Must be replaced before publication.'
                      : ''
                  }
                >
                  <span>{isFallback && !obj.includes('⚠') ? `⚠ ${obj} (temporary)` : obj}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveObjective(idx)}
                    className="hover:text-rose-600 rounded-full p-0.5 text-slate-400"
                  >
                    ×
                  </button>
                </span>
              );
            })}

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
            Strict ordering by order_index · Media URLs derived dynamically
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
        <div className="space-y-0">
          {blocks.map((b, idx) => {
            const isSelected = idx === activeBlockIndex;
            const cType = b.content_type || b.type || 'TEXT';
            const rType = b.response_type || 'NONE';
            const config = contentTypeConfig[cType] || contentTypeConfig.TEXT;
            const content = b.content || {};
            const isDragTarget = dropTargetIdx === idx && draggingIdx !== idx;
            const isDragging = draggingIdx === idx;

            return (
              <React.Fragment key={b.id || idx}>
                {/* ── Insert Zone ── */}
                <div className="group/insert relative h-5 flex items-center justify-center my-0.5 -mx-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-transparent group-hover/insert:border-blue-300 transition-colors" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openPickerAt(idx); }}
                    className="relative z-10 opacity-0 group-hover/insert:opacity-100 transition-all flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-full shadow-md"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    Insert block here
                  </button>
                </div>

                {/* ── Block Card ── */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnter={(e) => handleDragEnter(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`relative flex items-stretch gap-0 mb-3 rounded-xl transition-all ${
                    isDragTarget ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : ''
                  } ${isDragging ? 'opacity-40 scale-[0.99]' : ''}`}
                >
                  {/* Drag Handle */}
                  <div
                    className="flex items-center px-1.5 cursor-grab active:cursor-grabbing bg-slate-50 hover:bg-slate-100 rounded-l-xl border border-r-0 border-slate-200 transition-colors group/handle"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover/handle:text-slate-500 transition-colors" />
                  </div>

                  {/* Block content */}
                  <div
                    onClick={() => onSelectBlock(idx)}
                    className={`flex-1 group relative p-5 rounded-r-xl border transition-all cursor-pointer bg-white ${
                      isSelected
                        ? 'border-blue-500 shadow-md ring-2 ring-blue-500/10'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                <div className="flex items-start justify-between gap-4">
                  {/* Step Index & Badge */}
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className="text-center pt-1 shrink-0">
                      <span className="text-xs font-black text-slate-400 font-mono block">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[9px] text-slate-300 font-mono">
                        #{b.order_index ?? idx}
                      </span>
                    </div>

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
                            const opt1 = generateUUID();
                            const opt2 = generateUUID();
                            onUpdateBlock(idx, {
                              ...b,
                              response_type: nextRType,
                              evidence_role:
                                isInteractive && b.evidence_role === 'NONE'
                                  ? 'FORMATIVE'
                                  : b.evidence_role,
                              options:
                                isInteractive && (!b.options || b.options.length === 0)
                                  ? [
                                      { id: opt1, text: 'Option A', is_correct: true },
                                      { id: opt2, text: 'Option B', is_correct: false },
                                    ]
                                  : b.options,
                              evaluation:
                                isInteractive && !b.evaluation
                                  ? {
                                      correct_option_id: opt1,
                                      explanation: 'Explanation for learner feedback.',
                                    }
                                  : b.evaluation,
                              correct_option_id: isInteractive ? opt1 : undefined,
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

                        {/* Section Identifier / Tag */}
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 border border-dashed border-slate-200 rounded px-1.5 py-0.5">
                          <Layers className="w-3 h-3" />
                          <input
                            type="text"
                            placeholder="Section (optional)"
                            value={b.section_id || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, { ...b, section_id: e.target.value || null })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent border-none focus:outline-none text-slate-600 font-medium w-24 text-[10px]"
                          />
                        </div>
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
                              value={content.level || 'H2'}
                              onChange={(e) =>
                                onUpdateBlock(idx, {
                                  ...b,
                                  content: { ...content, level: e.target.value },
                                })
                              }
                              className="text-xs font-bold border border-purple-200 rounded px-2 py-1 bg-white"
                            >
                              <option value="H1">H1 — Main Section Header</option>
                              <option value="H2">H2 — Sub-concept Header</option>
                              <option value="H3">H3 — Deep-dive Sub-point</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            value={content.title || content.text || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: {
                                  ...content,
                                  title: e.target.value,
                                  text: e.target.value,
                                },
                              })
                            }
                            placeholder="Section Heading Text..."
                            className="w-full text-base font-bold bg-white border border-purple-200 rounded p-2 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      )}

                      {/* ── 2. TEXT Content Editor (Canonical content.text) ── */}
                      {cType === 'TEXT' && (
                        <div className="space-y-1">
                          <textarea
                            rows={3}
                            value={content.text ?? content.body ?? b.prompt ?? ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: { ...content, text: e.target.value },
                                prompt: e.target.value,
                              })
                            }
                            placeholder="Provide clear pedagogical explanation, market dynamics, and core conceptual rationale (markdown supported)..."
                            className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                          />
                          <div className="text-[10px] text-slate-400 flex items-center justify-between">
                            <span>Markdown supported · Canonical representation in content.text</span>
                            <span>{((content.text ?? content.body ?? '').length)} characters</span>
                          </div>
                        </div>
                      )}

                      {/* ── 3. IMAGE Content Editor (Canonical media_asset_id only, derived URL) ── */}
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
                              <span>{b.media_asset_id ? 'Replace Image' : 'Select / Upload Image'}</span>
                            </button>
                          </div>

                          {b.media_asset_id ? (
                            <div className="flex items-start gap-4">
                              <div className="w-36 h-24 rounded border border-slate-200 bg-white p-1 overflow-hidden shrink-0">
                                <MediaImagePreview
                                  mediaAssetId={b.media_asset_id}
                                  alt={content.alt_text || 'Block image'}
                                  className="w-full h-full object-contain"
                                />
                              </div>
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
                                <input
                                  type="text"
                                  value={content.alt_text || ''}
                                  onChange={(e) =>
                                    onUpdateBlock(idx, {
                                      ...b,
                                      content: { ...content, alt_text: e.target.value },
                                    })
                                  }
                                  placeholder="Accessibility alt text..."
                                  className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white"
                                />
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  Canonical Asset ID: {b.media_asset_id}
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
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Only canonical media_asset_id will be stored; display URLs are strictly derived
                              </div>
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
                              value={content.tone || 'NOTE'}
                              onChange={(e) =>
                                onUpdateBlock(idx, {
                                  ...b,
                                  content: { ...content, tone: e.target.value },
                                })
                              }
                              className="text-xs font-bold border border-amber-200 rounded px-2 py-0.5 bg-white"
                            >
                              <option value="NOTE">Information / Note</option>
                              <option value="TIP">Pro Tip</option>
                              <option value="IMPORTANT">Important Rule</option>
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
                            value={content.body || content.text || content.takeaway || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: {
                                  ...content,
                                  body: e.target.value,
                                  text: e.target.value,
                                },
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
                                    content: {
                                      ...content,
                                      source_domain: e.target.value,
                                      metaphor: e.target.value,
                                    },
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
                                    content: {
                                      ...content,
                                      target_domain: e.target.value,
                                      concept: e.target.value,
                                    },
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
                                content: {
                                  ...content,
                                  mapping_text: e.target.value,
                                  explanation: e.target.value,
                                },
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
                            {/* Dynamic SVG Candle */}
                            {(() => {
                              const open = Number(content.open ?? 100);
                              const high = Number(content.high ?? 125);
                              const low = Number(content.low ?? 95);
                              const close = Number(content.close ?? 120);
                              const isBullish = close >= open;
                              const strokeColor = isBullish ? '#10B981' : '#EF4444';
                              const span = Math.max(1, high - low);
                              const scale = (val) => 110 - ((val - low) / span) * 100;
                              const yHigh = scale(high);
                              const yLow = scale(low);
                              const yOpen = scale(open);
                              const yClose = scale(close);
                              const bodyTop = Math.min(yOpen, yClose);
                              const bodyHeight = Math.max(3, Math.abs(yClose - yOpen));

                              return (
                                <div className="w-20 h-28 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center shrink-0 shadow-inner">
                                  <svg viewBox="0 0 100 120" className="w-full h-full">
                                    {/* Wick */}
                                    <line
                                      x1="50"
                                      y1={yHigh}
                                      x2="50"
                                      y2={yLow}
                                      stroke={strokeColor}
                                      strokeWidth="3"
                                    />
                                    {/* Real Body */}
                                    <rect
                                      x="30"
                                      y={bodyTop}
                                      width="40"
                                      height={bodyHeight}
                                      fill={strokeColor}
                                      rx="2"
                                    />
                                  </svg>
                                </div>
                              );
                            })()}

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                              {['open', 'high', 'low', 'close'].map((key) => (
                                <div key={key}>
                                  <label className="text-[10px] font-bold text-slate-500 block uppercase">
                                    {key}
                                  </label>
                                  <input
                                    type="number"
                                    value={
                                      content[key] ??
                                      (key === 'high'
                                        ? 125
                                        : key === 'low'
                                        ? 95
                                        : key === 'close'
                                        ? 120
                                        : 100)
                                    }
                                    onChange={(e) =>
                                      onUpdateBlock(idx, {
                                        ...b,
                                        content: { ...content, [key]: Number(e.target.value) },
                                      })
                                    }
                                    className="w-full p-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Coordinates Validation Hint */}
                          {(() => {
                            const open = Number(content.open ?? 100);
                            const high = Number(content.high ?? 125);
                            const low = Number(content.low ?? 95);
                            const close = Number(content.close ?? 120);
                            const highInvalid = high < Math.max(open, close);
                            const lowInvalid = low > Math.min(open, close);
                            if (highInvalid || lowInvalid) {
                              return (
                                <div className="text-[10px] text-rose-600 flex items-center gap-1 font-bold">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>
                                    {highInvalid && 'High must be >= max(open, close). '}
                                    {lowInvalid && 'Low must be <= min(open, close).'}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      {/* ── 7. TABLE Content Editor ── */}
                      {cType === 'TABLE' && (
                        <div className="space-y-3 p-3 bg-teal-50/40 rounded-lg border border-teal-100">
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
                          <div className="text-[10px] text-teal-700">
                            Headers: {(content.headers || ['Category', 'Value']).join(' | ')}
                          </div>
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
                          <input
                            type="text"
                            value={content.dilemma || b.prompt || ''}
                            onChange={(e) =>
                              onUpdateBlock(idx, {
                                ...b,
                                content: { ...content, dilemma: e.target.value },
                                prompt: e.target.value,
                              })
                            }
                            placeholder="Key dilemma or question for learner decision..."
                            className="w-full text-xs p-1.5 bg-white border border-rose-200 rounded"
                          />
                        </div>
                      )}

                      {/* ── Interactive Response Options & Answer Key (MCQ / Single Choice) ── */}
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
                                const newOptId = generateUUID();
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
                                b.evaluation?.correct_option_id === opt.id ||
                                opt.is_correct ||
                                b.correct_option_id === opt.id;
                              return (
                                <div key={opt.id || optIdx} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct_opt_${b.id || idx}`}
                                    checked={Boolean(isCorrect)}
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

                      {/* ── IMAGE_SELECTION Response Editor (Canonical media_asset_id per option) ── */}
                      {rType === 'IMAGE_SELECTION' && (
                        <div className="mt-3 p-3.5 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                              Visual Pattern Choices (Image Selection)
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const existing = b.options || [];
                                const newOptId = generateUUID();
                                onUpdateBlock(idx, {
                                  ...b,
                                  options: [
                                    ...existing,
                                    {
                                      id: newOptId,
                                      label: `Choice ${existing.length + 1}`,
                                      media_asset_id: null,
                                      is_correct: false,
                                    },
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
                                b.evaluation?.correct_option_id === opt.id ||
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
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`img_correct_${b.id || idx}`}
                                        checked={Boolean(isCorrect)}
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

                                  {/* Dynamic Media Image Preview */}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openMediaForOption(idx, optIdx);
                                    }}
                                    className="cursor-pointer hover:opacity-90"
                                  >
                                    {opt.media_asset_id ? (
                                      <div className="w-full h-24 rounded border border-slate-100 bg-slate-50 p-1 flex items-center justify-center">
                                        <MediaImagePreview
                                          mediaAssetId={opt.media_asset_id}
                                          alt={opt.label || 'Choice image'}
                                          className="w-full h-full object-contain"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-full py-5 text-center border border-dashed border-indigo-200 hover:border-indigo-400 rounded text-xs text-indigo-600 bg-indigo-50/20">
                                        + Choose Image
                                      </div>
                                    )}
                                  </div>

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
                                    placeholder="Label (e.g. Bullish Engulfing)"
                                    className="w-full text-xs p-1 border border-slate-200 rounded"
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation for remediation */}
                          <div className="pt-2 border-t border-indigo-100">
                            <label className="text-[10px] font-bold text-indigo-800 uppercase block mb-1">
                              Explanation for visual pattern recognition:
                            </label>
                            <textarea
                              rows={2}
                              value={b.evaluation?.explanation || ''}
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
                                })
                              }
                              placeholder="Explain visual pattern indicators and key confirmation signals..."
                              className="w-full text-xs p-2 bg-white border border-indigo-200 rounded focus:outline-none resize-none"
                            />
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
                      title="Duplicate Block (New UUID)"
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
              </div>
            </React.Fragment>
            );
          })}

          {/* Final insert zone after last block */}
          <div className="group/insert relative h-5 flex items-center justify-center my-0.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-transparent group-hover/insert:border-blue-300 transition-colors" />
            </div>
            <button
              type="button"
              onClick={() => openPickerAt(blocks.length)}
              className="relative z-10 opacity-0 group-hover/insert:opacity-100 transition-all flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-full shadow-md"
            >
              <Plus className="w-2.5 h-2.5" />
              Insert block here
            </button>
          </div>
        </div>

        {/* ── Append Block Button ── */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => openPickerAt(blocks.length)}
            className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-xs font-bold text-slate-500 hover:text-blue-600 bg-white/60 hover:bg-blue-50/40 transition-all flex items-center justify-center gap-2 group"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </span>
            <span>Add Content or Question Block</span>
            <span className="text-slate-300 font-normal text-[10px] group-hover:text-blue-400">— pick from 10 block types</span>
          </button>
        </div>
      </div>

      {/* ── Block Type Picker Modal (Google Forms-style) ── */}
      {showBlockPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowBlockPicker(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/40">
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight">Add a Block</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {insertAtIdx !== null && insertAtIdx < blocks.length
                    ? `Inserting at position ${insertAtIdx + 1} of ${blocks.length}`
                    : 'Appending to end of lesson'}
                </p>
              </div>
              <button
                onClick={() => setShowBlockPicker(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-7">

              {/* ── Section 1: Content Blocks ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <LayoutList className="w-4 h-4 text-slate-500" />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Content Blocks</span>
                  <span className="text-[10px] text-slate-400 ml-1">Pure presentational — no learner response</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { type: 'HEADING', icon: Heading, label: 'Heading', desc: 'Section or concept header (H1–H3)', color: 'bg-purple-50 border-purple-200 hover:border-purple-400 hover:bg-purple-50' },
                    { type: 'TEXT', icon: PenLine, label: 'Text / Explanation', desc: 'Rich markdown explanation, market context', color: 'bg-slate-50 border-slate-200 hover:border-slate-400 hover:bg-slate-100' },
                    { type: 'IMAGE', icon: ImageIcon, label: 'Image / Diagram', desc: 'Chart, model or illustration from media library', color: 'bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-50' },
                    { type: 'CALLOUT', icon: MessageSquare, label: 'Callout Box', desc: 'Key takeaway, tip, warning or important rule', color: 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:bg-amber-50' },
                    { type: 'ANALOGY', icon: Lightbulb, label: 'Analogy', desc: 'Everyday parallel bridging to financial concept', color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50' },
                    { type: 'TABLE', icon: TableIcon, label: 'Data Table', desc: 'Structured comparison or financial statement data', color: 'bg-teal-50 border-teal-200 hover:border-teal-400 hover:bg-teal-50' },
                    { type: 'CANDLESTICK', icon: BarChart2, label: 'Candlestick OHLC', desc: 'Interactive Open/High/Low/Close price candle chart', color: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50' },
                  ].map(({ type, icon: Icon, label, desc, color }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handlePickBlock(type)}
                      className={`text-left p-3.5 rounded-xl border-2 transition-all group flex flex-col gap-2 ${color}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/70 rounded-lg shadow-sm">
                          <Icon className="w-4 h-4 text-slate-700 group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 leading-snug">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Section 2: Interactive / Assessment Blocks ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600">Interactive / Assessment</span>
                  <span className="text-[10px] text-slate-400 ml-1">Learner responds — formative or mastery evidence</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { type: 'MCQ', icon: CheckSquare, label: 'Multiple Choice (MCQ)', desc: 'Single correct answer from 2–4 options. Formative or diagnostic.', color: 'bg-green-50 border-green-200 hover:border-green-500 hover:bg-green-50' },
                    { type: 'IMAGE_SELECTION', icon: ImageIcon, label: 'Image Selection MCQ', desc: 'Visual discrimination — learner picks the correct chart or pattern.', color: 'bg-sky-50 border-sky-200 hover:border-sky-500 hover:bg-sky-50' },
                    { type: 'SCENARIO', icon: Compass, label: 'Market Scenario', desc: 'Contextual application dilemma with professional judgment choices.', color: 'bg-rose-50 border-rose-200 hover:border-rose-500 hover:bg-rose-50' },
                  ].map(({ type, icon: Icon, label, desc, color }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handlePickBlock(type)}
                      className={`text-left p-4 rounded-xl border-2 transition-all group flex flex-col gap-2 ${color}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/70 rounded-lg shadow-sm">
                          <Icon className="w-4 h-4 text-slate-700 group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 leading-snug">{desc}</span>
                      <span className="mt-auto text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Interactive
                      </span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Media Asset Library Modal ── */}
      <MediaLibraryModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleSelectMedia}
      />
    </div>
  );
};