import React, { useState, useRef, useEffect } from 'react';
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
  ChevronRight,
} from 'lucide-react';
import { MediaLibraryModal } from './MediaLibraryModal';
import { useMediaAsset, cacheMediaAsset } from '../utils/mediaResolver';
import { resolveEndpointUrl } from '../../../services/apiClient';
import {
  BLOCK_CAPABILITIES,
  CONTENT_BLOCK_TYPES,
  INTERACTIVE_BLOCK_TYPES,
  generateUUID,
  groupBlocksIntoPages,
  generatePageId,
  createEmptyStep,
  reorderSteps,
  deleteStep,
  duplicateStep,
  moveBlockToStep,
  createBlock,
} from '../utils/blockRegistry';

/**
 * Renders derived media display image dynamically from canonical media_asset_id.
 * URLs are strictly derived and NEVER read from or persisted into blocks_json.
 */
function MediaImagePreview({ mediaAssetId, imageUrl = '', alt = '', className = '', fallbackText = 'No image selected' }) {
  const { url: derivedUrl, isLoading } = useMediaAsset(mediaAssetId);
  const rawUrl = derivedUrl || imageUrl;
  const effectiveUrl = rawUrl ? resolveEndpointUrl(rawUrl) : null;
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [mediaAssetId, imageUrl, effectiveUrl]);

  if (!mediaAssetId && !imageUrl) {
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

  if (!effectiveUrl || hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-amber-50/80 border border-amber-200 text-amber-700 p-3.5 rounded-lg ${className}`}>
        <AlertTriangle className="w-5 h-5 text-amber-500 mb-1" />
        <span className="text-xs font-bold text-amber-800">Image file unavailable</span>
        <span className="text-[10px] text-amber-600 text-center max-w-xs mt-0.5">
          {mediaAssetId ? `Asset ID: ${String(mediaAssetId).slice(0, 8)}...` : 'Image URL not reachable'}
        </span>
        <span className="text-[10px] text-slate-400 mt-1">Use "Change Image" below to select or upload a new image</span>
      </div>
    );
  }

  return (
    <img
      src={effectiveUrl}
      alt={alt || 'Lesson media'}
      className={className}
      onError={() => {
        setHasError(true);
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
  const [targetInsertPageId, setTargetInsertPageId] = useState(null);

  // ── Page Grouping Calculation & Lookup ───────────────────────────────────
  const pages = React.useMemo(() => groupBlocksIntoPages(blocks), [blocks]);

  const blockPageInfo = React.useMemo(() => {
    const infoMap = new Map();
    pages.forEach((page) => {
      page.blockIndices.forEach((bIdx, positionInPage) => {
        infoMap.set(bIdx, {
          page,
          pageNumber: page.pageNumber,
          pageId: page.pageId,
          isFirstInPage: positionInPage === 0,
          isLastInPage: positionInPage === page.blockIndices.length - 1,
          positionInPage,
          totalInPage: page.blocks.length,
          isMultiBlock: page.blocks.length > 1,
        });
      });
    });
    return infoMap;
  }, [pages]);

  // ── Step Collapse State ──────────────────────────────────────────────────
  const [collapsedSteps, setCollapsedSteps] = useState(new Set());
  const toggleCollapseStep = (stepKey) => {
    setCollapsedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepKey)) {
        next.delete(stepKey);
      } else {
        next.add(stepKey);
      }
      return next;
    });
  };

  // ── Step Title Helper & Getter ───────────────────────────────────────────
  const getStepTitle = (page) => {
    const withStepTitle = page.blocks.find((b) => b.step_title);
    if (withStepTitle?.step_title) return withStepTitle.step_title;

    const firstBlock = page.blocks[0];
    if (firstBlock && (firstBlock.content_type || firstBlock.type) === 'HEADING') {
      const headingText = firstBlock.content?.title || firstBlock.content?.text || firstBlock.title;
      if (headingText && headingText !== 'Section Heading') return headingText;
    }

    if (firstBlock?.title && firstBlock.title !== 'Section Heading' && !firstBlock.title.startsWith('New ')) {
      return firstBlock.title;
    }

    return '';
  };

  const handleUpdateStepTitle = (pIdx, newTitle) => {
    const page = pages[pIdx];
    if (!page || page.blockIndices.length === 0) return;

    const nextBlocks = blocks.map((b, idx) => {
      if (page.blockIndices.includes(idx)) {
        const isFirst = idx === page.blockIndices[0];
        const isHeading = (b.content_type || b.type) === 'HEADING';
        return {
          ...b,
          step_title: newTitle,
          ...(isFirst && isHeading ? {
            title: newTitle,
            content: { ...(b.content || {}), title: newTitle, text: newTitle },
          } : {}),
        };
      }
      return b;
    });

    if (onReorderBlocks) {
      onReorderBlocks(nextBlocks);
    }
  };

  // ── Step-Level Operations ────────────────────────────────────────────────
  const handleAddStep = (preferredType = 'TEXT') => {
    const defaultTitle = `Step ${pages.length + 1}: Concept`;
    const { nextBlocks } = createEmptyStep(blocks, preferredType, {
      title: defaultTitle,
      step_title: defaultTitle,
    });
    if (onReorderBlocks) {
      onReorderBlocks(nextBlocks);
    }
    onSelectBlock(nextBlocks.length - 1);
  };

  const handleDeleteStep = (pIdx) => {
    const page = pages[pIdx];
    const blockCount = page ? page.blocks.length : 0;
    if (blockCount > 1) {
      if (!window.confirm(`Delete Step ${pIdx + 1} and its ${blockCount} blocks?`)) {
        return;
      }
    }
    const nextBlocks = deleteStep(blocks, pIdx);
    if (onReorderBlocks) {
      onReorderBlocks(nextBlocks);
    }
    onSelectBlock(Math.max(0, Math.min(activeBlockIndex, nextBlocks.length - 1)));
  };

  const handleMoveStep = (pIdx, direction) => {
    const targetIdx = direction === 'UP' ? pIdx - 1 : pIdx + 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return;
    const nextBlocks = reorderSteps(blocks, pIdx, targetIdx);
    if (onReorderBlocks) {
      onReorderBlocks(nextBlocks);
    }
  };

  const handleDuplicateStep = (pIdx) => {
    const nextBlocks = duplicateStep(blocks, pIdx);
    if (onReorderBlocks) {
      onReorderBlocks(nextBlocks);
    }
  };

  const handleMoveBlockToStep = (globalIdx, targetPageId) => {
    const nextBlocks = moveBlockToStep(blocks, globalIdx, targetPageId);
    if (onReorderBlocks) {
      onReorderBlocks(nextBlocks);
    }
  };

  const handleAddBlockToStep = (targetPageId, blockType = 'TEXT', customInsertAt = null) => {
    const page = pages.find((p) => (p.pageId || p.pageKey) === targetPageId);
    if (!page) {
      if (onAddBlock) onAddBlock(blockType, customInsertAt);
      return;
    }

    const effectivePid = (page && page.pageId) ? page.pageId : generatePageId();
    const lastGlobalIdx = page.blockIndices.length > 0
      ? page.blockIndices[page.blockIndices.length - 1]
      : blocks.length - 1;

    const insertAt = (customInsertAt !== null && customInsertAt !== undefined && customInsertAt >= 0)
      ? customInsertAt
      : lastGlobalIdx + 1;

    const stepTitle = getStepTitle(page);

    // Stamp ALL existing blocks in this step with effectivePid so they share the exact same page_id
    const currentBlocks = blocks.map((b, i) => {
      if (page.blockIndices.includes(i)) {
        return {
          ...b,
          page_id: effectivePid,
          section_id: effectivePid,
          ...(stepTitle && !b.step_title ? { step_title: stepTitle } : {}),
        };
      }
      return b;
    });

    const newBlock = createBlock(blockType, insertAt, {
      page_id: effectivePid,
      section_id: effectivePid,
      ...(stepTitle ? { step_title: stepTitle } : {}),
    });

    const nextBlocks = [
      ...currentBlocks.slice(0, insertAt),
      newBlock,
      ...currentBlocks.slice(insertAt),
    ];
    nextBlocks.forEach((b, i) => { b.order_index = i; });

    if (onReorderBlocks) {
      onReorderBlocks(nextBlocks);
    }
    onSelectBlock(insertAt);
  };

  const openPickerForStep = (pageIdOrKey) => {
    const page = pages.find((p) => (p.pageId || p.pageKey) === pageIdOrKey);
    const lastGlobalIdx = page && page.blockIndices.length > 0
      ? page.blockIndices[page.blockIndices.length - 1]
      : blocks.length - 1;
    openPickerAt(lastGlobalIdx + 1, pageIdOrKey);
  };

  const handleMergeWithPrev = (idx) => {
    if (idx <= 0 || !blocks[idx] || !blocks[idx - 1]) return;
    const prevBlock = blocks[idx - 1];
    const currBlock = blocks[idx];
    const targetPageId = prevBlock.page_id || prevBlock.section_id || generatePageId();

    const nextBlocks = blocks.map((b, i) => {
      if (i === idx - 1 && (!b.page_id && !b.section_id)) {
        return { ...b, page_id: targetPageId, section_id: targetPageId };
      }
      if (i === idx) {
        return { ...b, page_id: targetPageId, section_id: targetPageId };
      }
      return b;
    });

    if (onReorderBlocks) {
      onReorderBlocks(nextBlocks);
    } else {
      onUpdateBlock(idx - 1, { ...prevBlock, page_id: targetPageId, section_id: targetPageId });
      onUpdateBlock(idx, { ...currBlock, page_id: targetPageId, section_id: targetPageId });
    }
  };

  const handleSplitNewPage = (idx) => {
    if (!blocks[idx]) return;
    const newPageId = generatePageId();
    const currBlock = blocks[idx];
    const oldPid = currBlock.page_id || currBlock.section_id;

    const nextBlocks = blocks.map((b, i) => {
      if (i >= idx && oldPid && (b.page_id === oldPid || b.section_id === oldPid)) {
        return { ...b, page_id: newPageId, section_id: newPageId };
      }
      if (i === idx) {
        return { ...b, page_id: newPageId, section_id: newPageId };
      }
      return b;
    });

    if (onReorderBlocks) {
      onReorderBlocks(nextBlocks);
    } else {
      onUpdateBlock(idx, { ...currBlock, page_id: newPageId, section_id: newPageId });
    }
  };

  const handleUngroupPage = (page) => {
    if (!page || !page.blockIndices) return;
    const nextBlocks = blocks.map((b, i) => {
      if (page.blockIndices.includes(i)) {
        return { ...b, page_id: null, section_id: null };
      }
      return b;
    });
    if (onReorderBlocks) onReorderBlocks(nextBlocks);
  };

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
  const openPickerAt = (insertIdx, targetPageId = null) => {
    setInsertAtIdx(insertIdx);
    setTargetInsertPageId(targetPageId);
    setShowBlockPicker(true);
  };

  const handlePickBlock = (blockType) => {
    setShowBlockPicker(false);
    if (targetInsertPageId) {
      handleAddBlockToStep(targetInsertPageId, blockType, insertAtIdx);
    } else if (onAddBlock) {
      onAddBlock(blockType, insertAtIdx);
    }
    setInsertAtIdx(null);
    setTargetInsertPageId(null);
  };

  useEffect(() => {
    if (activeBlockIndex !== null && activeBlockIndex !== undefined) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`block-card-${activeBlockIndex}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeBlockIndex]);

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
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-800 font-extrabold uppercase tracking-wide">
                Learner Journey: {pages.length} Step{pages.length === 1 ? '' : 's'}
              </span>
              <span className="text-slate-400 font-normal">
                ({blocks.length} total block{blocks.length === 1 ? '' : 's'})
              </span>
            </span>
            <span className="text-slate-400 hidden sm:inline">Click any block to jump & configure</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {pages.map((page, pIdx) => {
              const isPageActive = page.blockIndices.includes(activeBlockIndex);
              return (
                <React.Fragment key={page.pageKey || pIdx}>
                  <div
                    className={`flex items-center gap-1.5 p-1 rounded-xl border transition-all ${
                      isPageActive
                        ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0">
                      Step {page.pageNumber}
                    </span>
                    <div className="flex items-center gap-1">
                      {page.blocks.map((b, bInPageIdx) => {
                        const globalIdx = page.blockIndices[bInPageIdx];
                        const cType = b.content_type || b.type || 'TEXT';
                        const cfg = contentTypeConfig[cType] || contentTypeConfig.TEXT;
                        const StepIcon = cfg.icon;
                        const isActive = globalIdx === activeBlockIndex;
                        return (
                          <button
                            key={b.id || globalIdx}
                            type="button"
                            onClick={() => onSelectBlock(globalIdx)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold shrink-0 transition-all border ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title={b.title || cfg.label}
                          >
                            <StepIcon className="w-3 h-3" />
                            <span className="max-w-[70px] truncate text-[11px]">
                              {b.title ? b.title : cfg.label}
                            </span>
                            {b.evidence_role === 'MASTERY_EVIDENCE' && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive ? 'bg-amber-300' : 'bg-emerald-500'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {pIdx < pages.length - 1 && (
                    <span className="text-slate-300 text-xs font-mono shrink-0">➔</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Steps-First Content Canvas ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-black tracking-wider uppercase text-slate-800">
              Learner Steps
            </span>
            <span className="text-xs font-bold text-slate-400">
              ({pages.length} step{pages.length === 1 ? '' : 's'} · {blocks.length} block{blocks.length === 1 ? '' : 's'})
            </span>
          </div>
          <div className="text-xs text-slate-400">
            Each step = one learner screen
          </div>
        </div>

        {/* Empty state */}
        {blocks.length === 0 && (
          <div className="p-10 text-center bg-white rounded-xl border-2 border-dashed border-slate-300 space-y-4">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No steps yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first step to start building the lesson. Each step becomes one screen the learner sees.
            </p>
            <button
              type="button"
              onClick={() => handleAddStep('HEADING')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Step
            </button>
          </div>
        )}

        {/* ── Steps Container ── */}
        <div className="space-y-3">
          {pages.map((page, pIdx) => {
            const stepKey = page.pageKey || page.pageId || `step_${pIdx}`;
            const isCollapsed = collapsedSteps.has(stepKey);
            const stepTitle = getStepTitle(page);
            const hasActiveBlock = page.blockIndices.includes(activeBlockIndex);

            return (
              <div
                key={stepKey}
                className={`rounded-xl border-2 transition-all duration-200 ${
                  hasActiveBlock
                    ? 'border-blue-400 ring-2 ring-blue-500/15 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                {/* ── Step Header ── */}
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${
                    hasActiveBlock
                      ? 'bg-gradient-to-r from-blue-50 via-indigo-50/40 to-white'
                      : 'bg-gradient-to-r from-slate-50 via-white to-white hover:from-slate-100'
                  }`}
                  onClick={() => {
                    if (page.blockIndices.length > 0) {
                      onSelectBlock(page.blockIndices[0]);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleCollapseStep(stepKey); }}
                    className="p-1 rounded-lg hover:bg-white/80 text-slate-400 hover:text-slate-700 transition-colors"
                    title={isCollapsed ? 'Expand step' : 'Collapse step'}
                  >
                    <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`} />
                  </button>

                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black tracking-wide shadow-xs shrink-0 ${
                    hasActiveBlock ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
                  }`}>
                    <Layers className="w-3.5 h-3.5" />
                    <span>STEP {pIdx + 1}</span>
                  </div>

                  <input
                    type="text"
                    value={stepTitle}
                    onChange={(e) => handleUpdateStepTitle(pIdx, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={`Step ${pIdx + 1} title...`}
                    className="flex-1 text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none placeholder:text-slate-300 min-w-0"
                  />

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">
                      {page.blocks.length} block{page.blocks.length === 1 ? '' : 's'}
                    </span>
                    {page.isInteractive && (
                      <span className="text-[10px] font-bold text-emerald-700 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        Interactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0 ml-1">
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveStep(pIdx, 'UP'); }} disabled={pIdx === 0} title="Move Step Up" className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveStep(pIdx, 'DOWN'); }} disabled={pIdx === pages.length - 1} title="Move Step Down" className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDuplicateStep(pIdx); }} title="Duplicate Step" className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                    {onPreviewStep && (<button type="button" onClick={(e) => { e.stopPropagation(); onPreviewStep(page.blockIndices[0] ?? 0); }} title="Preview this step" className="p-1 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"><Play className="w-3.5 h-3.5" /></button>)}
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteStep(pIdx); }} title="Delete Step" className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* ── Collapsible Step Body ── */}
                {!isCollapsed && (
                  <div className="border-t border-slate-100 bg-white/50 rounded-b-xl">
                    <div className="p-3 space-y-0">
                      {page.blocks.map((b, bInPageIdx) => {
                        const globalIdx = page.blockIndices[bInPageIdx];
                        const isSelected = globalIdx === activeBlockIndex;
                        const cType = b.content_type || b.type || 'TEXT';
                        const isInteractiveType = Boolean(b.response_type && b.response_type !== 'NONE');
                        const isPureContent = !isInteractiveType && ['HEADING', 'CALLOUT', 'ANALOGY', 'TABLE', 'CANDLESTICK'].includes(cType);
                        const rType = b.response_type || 'NONE';
                        const config = contentTypeConfig[cType] || contentTypeConfig.TEXT;
                        const content = b.content || {};
                        const isDragTarget = dropTargetIdx === globalIdx && draggingIdx !== globalIdx;
                        const isDragging = draggingIdx === globalIdx;

                        return (
                          <React.Fragment key={b.id || globalIdx}>
                            {bInPageIdx > 0 && (
                              <div className="group/insert relative h-4 flex items-center justify-center -mx-1">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-transparent group-hover/insert:border-blue-300 transition-colors" /></div>
                                <button type="button" onClick={(e) => { e.stopPropagation(); openPickerAt(globalIdx, page.pageId || page.pageKey); }} className="relative z-10 opacity-0 group-hover/insert:opacity-100 transition-all flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-full shadow-md"><Plus className="w-2.5 h-2.5" />Insert</button>
                              </div>
                            )}
                            <div
                              id={`block-card-${globalIdx}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, globalIdx)}
                              onDragEnter={(e) => handleDragEnter(e, globalIdx)}
                              onDragLeave={handleDragLeave}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, globalIdx)}
                              onDragEnd={handleDragEnd}
                              onClick={() => onSelectBlock(globalIdx)}
                              className={`relative rounded-xl border transition-all duration-150 ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'} ${isDragTarget ? 'border-dashed border-blue-400 bg-blue-50/20' : ''} ${isDragging ? 'opacity-40' : ''}`}
                            >
                              <div className="p-4 sm:p-5 flex items-start gap-3">
                                <div className="flex flex-col items-center gap-1 pt-1 select-none text-slate-300">
                                  <span className="cursor-grab active:cursor-grabbing p-1 hover:text-slate-500" title="Drag to reorder block"><GripVertical className="w-4 h-4" /></span>
                                  <span className="text-[9px] text-slate-300 font-mono">#{b.order_index ?? globalIdx}</span>
                                </div>
                                <div className="space-y-3 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <select
                                      value={rType === 'IMAGE_SELECTION' ? 'IMAGE_SELECTION' : cType}
                                      onChange={(e) => {
                                        const nextType = e.target.value;
                                        if (nextType === 'IMAGE_SELECTION') {
                                          const opt1 = generateUUID();
                                          const opt2 = generateUUID();
                                          const opt3 = generateUUID();
                                          const opt4 = generateUUID();
                                          onUpdateBlock(globalIdx, {
                                            ...b,
                                            content_type: 'IMAGE',
                                            type: 'IMAGE',
                                            response_type: 'IMAGE_SELECTION',
                                            activity_type: b.activity_type === 'OBSERVE' ? 'PRACTICE' : (b.activity_type || 'PRACTICE'),
                                            evidence_role: b.evidence_role === 'NONE' ? 'FORMATIVE' : (b.evidence_role || 'FORMATIVE'),
                                            prompt: b.prompt || content.prompt || 'Select the correct image from below of the topic:',
                                            content: { ...content, prompt: content.prompt || b.prompt || 'Select the correct image from below of the topic:' },
                                            options: [
                                              { id: opt1, label: 'Option A', text: 'Option A', media_asset_id: null, is_correct: true },
                                              { id: opt2, label: 'Option B', text: 'Option B', media_asset_id: null, is_correct: false },
                                              { id: opt3, label: 'Option C', text: 'Option C', media_asset_id: null, is_correct: false },
                                              { id: opt4, label: 'Option D', text: 'Option D', media_asset_id: null, is_correct: false },
                                            ],
                                            evaluation: { correct_option_id: opt1, explanation: 'Explanation shown after learner answers.' },
                                            correct_option_id: opt1,
                                          });
                                          return;
                                        }
                                        const isNextPure = ['HEADING', 'CALLOUT', 'ANALOGY', 'TABLE', 'CANDLESTICK'].includes(nextType);
                                        onUpdateBlock(globalIdx, {
                                          ...b,
                                          content_type: nextType,
                                          type: nextType,
                                          ...(isNextPure ? { response_type: 'NONE', evidence_role: 'NONE', options: undefined, evaluation: undefined, correct_option_id: undefined } : {})
                                        });
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className={`text-[11px] font-bold rounded px-2 py-0.5 border bg-white focus:outline-none focus:border-blue-500 ${config.color}`}
                                    >
                                      <option value="HEADING">HEADING</option>
                                      <option value="TEXT">TEXT</option>
                                      <option value="IMAGE">IMAGE (Pure Illustration)</option>
                                      <option value="IMAGE_SELECTION">IMAGE MCQ (Select Image)</option>
                                      <option value="CALLOUT">CALLOUT</option>
                                      <option value="ANALOGY">ANALOGY</option>
                                      <option value="CANDLESTICK">CANDLESTICK</option>
                                      <option value="TABLE">TABLE</option>
                                      <option value="SCENARIO">SCENARIO</option>
                                    </select>
                                    {isPureContent ? (<span className="text-[11px] font-bold rounded px-2 py-0.5 border bg-slate-100 text-slate-600 border-slate-200">PURE CONTENT</span>) : (
                                      <select value={rType} onChange={(e) => {
                                        const nextRType = e.target.value;
                                        const isInteractive = nextRType !== 'NONE';
                                        const opt1 = generateUUID();
                                        const opt2 = generateUUID();
                                        const opt3 = generateUUID();
                                        const opt4 = generateUUID();
                                        let defaultOptions = b.options;
                                        if (nextRType === 'IMAGE_SELECTION') {
                                          if (!b.options || b.options.length < 2 || !b.options.some((o) => 'media_asset_id' in o)) {
                                            defaultOptions = [
                                              { id: opt1, label: 'Pattern A', text: 'Pattern A', media_asset_id: null, is_correct: true },
                                              { id: opt2, label: 'Pattern B', text: 'Pattern B', media_asset_id: null, is_correct: false },
                                              { id: opt3, label: 'Pattern C', text: 'Pattern C', media_asset_id: null, is_correct: false },
                                              { id: opt4, media_asset_id: null, label: 'Pattern D', text: 'Pattern D', is_correct: false },
                                            ];
                                          } else {
                                            defaultOptions = b.options.map((o, idx) => ({
                                              ...o,
                                              media_asset_id: o.media_asset_id !== undefined ? o.media_asset_id : null,
                                              label: o.label || o.text || `Pattern ${String.fromCharCode(65 + idx)}`,
                                              text: o.text || o.label || `Pattern ${String.fromCharCode(65 + idx)}`,
                                            }));
                                          }
                                        } else if (isInteractive && (!b.options || b.options.length === 0)) {
                                          defaultOptions = [
                                            { id: opt1, text: 'Option A', label: 'Option A', is_correct: true },
                                            { id: opt2, text: 'Option B', label: 'Option B', is_correct: false },
                                          ];
                                        }
                                        const correctOptId = nextRType === 'IMAGE_SELECTION'
                                          ? (defaultOptions?.find((o) => o.is_correct)?.id || defaultOptions?.[0]?.id || opt1)
                                          : (b.correct_option_id || opt1);
                                        onUpdateBlock(globalIdx, {
                                          ...b,
                                          content_type: nextRType === 'IMAGE_SELECTION' ? 'IMAGE' : b.content_type,
                                          response_type: nextRType,
                                          evidence_role: isInteractive && b.evidence_role === 'NONE' ? 'FORMATIVE' : b.evidence_role,
                                          options: defaultOptions,
                                          prompt: nextRType === 'IMAGE_SELECTION' && !b.prompt && !content.prompt
                                            ? 'Select the correct image from below of the topic:'
                                            : b.prompt,
                                          content: nextRType === 'IMAGE_SELECTION' && !content.prompt && !b.prompt
                                            ? { ...content, prompt: 'Select the correct image from below of the topic:' }
                                            : content,
                                          evaluation: isInteractive && !b.evaluation
                                            ? { correct_option_id: correctOptId, explanation: 'Explanation for learner feedback.' }
                                            : (isInteractive && b.evaluation ? { ...b.evaluation, correct_option_id: correctOptId } : b.evaluation),
                                          correct_option_id: isInteractive ? correctOptId : undefined,
                                        });
                                      }} onClick={(e) => e.stopPropagation()} className={`text-[11px] font-bold rounded px-2 py-0.5 border focus:outline-none focus:border-blue-500 ${rType === 'NONE' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>
                                        <option value="NONE">PURE CONTENT (No Evaluation)</option><option value="SINGLE_CHOICE">SINGLE CHOICE MCQ</option><option value="MULTIPLE_CHOICE">MULTIPLE CHOICE</option><option value="IMAGE_SELECTION">IMAGE SELECTION MCQ</option><option value="TRUE_FALSE">TRUE / FALSE</option>
                                      </select>
                                    )}
                                    <select value={b.activity_type || 'EXPERIENCE'} onChange={(e) => onUpdateBlock(globalIdx, { ...b, activity_type: e.target.value })} onClick={(e) => e.stopPropagation()} className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 rounded px-1.5 py-0.5 focus:outline-none">
                                      <option value="OBSERVE">Observe</option><option value="PREDICT">Predict</option><option value="EXPLAIN">Explain</option><option value="PRACTICE">Practice</option><option value="APPLICATION">Application</option><option value="EXPERIENCE">Experience</option><option value="RETRIEVE">Retrieve</option><option value="REFLECT">Reflect</option>
                                    </select>
                                    {rType !== 'NONE' && (<select value={b.evidence_role || 'FORMATIVE'} onChange={(e) => onUpdateBlock(globalIdx, { ...b, evidence_role: e.target.value })} onClick={(e) => e.stopPropagation()} className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 focus:outline-none"><option value="NONE">Formative Only</option><option value="FORMATIVE">Formative Evidence</option><option value="DIAGNOSTIC">Diagnostic</option><option value="MASTERY_EVIDENCE">Mastery Evidence</option></select>)}
                                    {pages.length > 1 && (<select value="" onChange={(e) => { if (e.target.value) handleMoveBlockToStep(globalIdx, e.target.value); }} onClick={(e) => e.stopPropagation()} className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-500 rounded px-1.5 py-0.5 focus:outline-none"><option value="">Move to step…</option>{pages.map((p, pi) => { if (pi === pIdx) return null; const pid = p.pageId || p.pageKey; return (<option key={pid} value={pid}>Step {pi + 1}{getStepTitle(p) ? `: ${getStepTitle(p)}` : ''}</option>); })}</select>)}
                                  </div>
                                  <input type="text" value={b.title || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, title: e.target.value })} placeholder="Block Title (e.g. Overnight Repo Rate Mechanics)" className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none" />

                                  {cType === 'HEADING' && (<div className="space-y-2 p-3 bg-purple-50/50 rounded-lg border border-purple-100"><div className="flex items-center gap-3"><label className="text-[10px] font-bold text-purple-900 uppercase">Level:</label><select value={content.level || 'H2'} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, level: e.target.value } })} className="text-xs font-bold border border-purple-200 rounded px-2 py-1 bg-white"><option value="H1">H1 — Main Section Header</option><option value="H2">H2 — Sub-concept Header</option><option value="H3">H3 — Deep-dive Sub-point</option></select></div><input type="text" value={content.title || content.text || b.title || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, title: e.target.value, content: { ...content, title: e.target.value, text: e.target.value } })} placeholder="Section Heading Text..." className="w-full text-base font-bold bg-white border border-purple-200 rounded p-2 focus:outline-none focus:border-purple-500" /></div>)}

                                  {cType === 'TEXT' && (<div className="space-y-1.5"><textarea value={content.text || content.body || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, text: e.target.value } })} placeholder="Write financial concept text here (Markdown supported)..." rows={4} className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg p-3 focus:outline-none focus:border-blue-500 resize-y font-mono leading-relaxed" /></div>)}

                                  {cType === 'IMAGE' && rType !== 'IMAGE_SELECTION' && (() => {
                                    const assetId = b.media_asset_id || content.media_asset_id;
                                    return (
                                      <div className="space-y-3 p-3 bg-blue-50/30 rounded-lg border border-blue-100">
                                        <div className="flex items-center justify-between p-2 bg-blue-100/70 rounded-lg border border-blue-200">
                                          <div className="flex items-center gap-1.5 text-xs text-blue-900 font-semibold">
                                            <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                            <span>Creating an Image MCQ where learners pick an image?</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const opt1 = generateUUID();
                                              const opt2 = generateUUID();
                                              const opt3 = generateUUID();
                                              const opt4 = generateUUID();
                                              onUpdateBlock(globalIdx, {
                                                ...b,
                                                content_type: 'IMAGE',
                                                response_type: 'IMAGE_SELECTION',
                                                activity_type: b.activity_type === 'OBSERVE' ? 'PRACTICE' : (b.activity_type || 'PRACTICE'),
                                                evidence_role: b.evidence_role === 'NONE' ? 'FORMATIVE' : (b.evidence_role || 'FORMATIVE'),
                                                prompt: b.prompt || content.prompt || 'Select the correct image from below of the topic:',
                                                content: { ...content, prompt: content.prompt || b.prompt || 'Select the correct image from below of the topic:' },
                                                options: [
                                                  { id: opt1, label: 'Option A', text: 'Option A', media_asset_id: null, is_correct: true },
                                                  { id: opt2, label: 'Option B', text: 'Option B', media_asset_id: null, is_correct: false },
                                                  { id: opt3, label: 'Option C', text: 'Option C', media_asset_id: null, is_correct: false },
                                                  { id: opt4, label: 'Option D', text: 'Option D', media_asset_id: null, is_correct: false },
                                                ],
                                                evaluation: { correct_option_id: opt1, explanation: 'Explanation shown after learner answers.' },
                                                correct_option_id: opt1,
                                              });
                                            }}
                                            className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md transition-colors shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
                                          >
                                            <Zap className="w-3.5 h-3.5" /> Turn into Image MCQ
                                          </button>
                                        </div>
                                        <MediaImagePreview mediaAssetId={assetId} imageUrl={b.image_url || content.image_url || content.url} alt={content.alt_text || 'Image'} className="max-h-36 max-w-full rounded-lg border border-slate-200 object-contain bg-white mx-auto block" fallbackText="No image selected" />
                                        <button type="button" onClick={(e) => { e.stopPropagation(); openMediaForBlock(globalIdx); }} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"><Upload className="w-3 h-3" />{assetId ? 'Change Image' : 'Select from Media Library'}</button>
                                        <input type="text" value={content.alt_text || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, alt_text: e.target.value } })} placeholder="Alt text" className="w-full text-xs border border-blue-100 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400" />
                                        <input type="text" value={content.caption || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, caption: e.target.value } })} placeholder="Caption (optional)" className="w-full text-xs border border-blue-100 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400" />
                                      </div>
                                    );
                                  })()}

                                  {cType === 'CALLOUT' && (<div className="space-y-2 p-3 bg-amber-50/50 rounded-lg border border-amber-100"><select value={content.callout_type || content.variant || 'TIP'} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, callout_type: e.target.value, variant: e.target.value } })} className="text-xs font-bold border border-amber-200 rounded px-2 py-1 bg-white"><option value="TIP">💡 Tip</option><option value="RULE">📏 Rule</option><option value="WARNING">⚠️ Warning</option><option value="KEY_TAKEAWAY">🔑 Key Takeaway</option></select><textarea value={content.text || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, text: e.target.value } })} placeholder="Callout text..." rows={2} className="w-full text-sm border border-amber-200 rounded p-2 bg-white focus:outline-none focus:border-amber-500" /></div>)}

                                  {cType === 'ANALOGY' && (<div className="space-y-2 p-3 bg-emerald-50/50 rounded-lg border border-emerald-100"><input type="text" value={content.everyday_concept || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, everyday_concept: e.target.value } })} placeholder="Everyday concept (e.g. 'Thermostat')" className="w-full text-sm font-bold border border-emerald-200 rounded p-2 bg-white focus:outline-none focus:border-emerald-500" /><input type="text" value={content.financial_concept || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, financial_concept: e.target.value } })} placeholder="Financial concept (e.g. 'Federal Funds Rate')" className="w-full text-sm font-bold border border-emerald-200 rounded p-2 bg-white focus:outline-none focus:border-emerald-500" /><textarea value={content.mapping || content.text || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, mapping: e.target.value, text: e.target.value } })} placeholder="Explain the analogy..." rows={3} className="w-full text-sm border border-emerald-200 rounded p-2 bg-white focus:outline-none focus:border-emerald-500" /></div>)}

                                  {cType === 'TABLE' && (<div className="space-y-2 p-3 bg-teal-50/50 rounded-lg border border-teal-100"><textarea value={typeof content.data === 'string' ? content.data : JSON.stringify(content.data || content.rows || [], null, 2)} onChange={(e) => { try { const parsed = JSON.parse(e.target.value); onUpdateBlock(globalIdx, { ...b, content: { ...content, data: parsed, rows: parsed } }); } catch { onUpdateBlock(globalIdx, { ...b, content: { ...content, data: e.target.value } }); } }} placeholder='Table data JSON' rows={5} className="w-full text-xs font-mono border border-teal-200 rounded p-2 bg-white focus:outline-none focus:border-teal-500" /></div>)}

                                  {cType === 'CANDLESTICK' && (<div className="space-y-2 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100"><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{['open', 'high', 'low', 'close'].map((field) => (<div key={field}><label className="text-[10px] font-black uppercase text-indigo-700">{field}</label><input type="number" value={content[field] ?? ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, [field]: parseFloat(e.target.value) || 0 } })} className="w-full text-sm font-mono border border-indigo-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-indigo-500" /></div>))}</div><input type="text" value={content.instrument || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, instrument: e.target.value } })} placeholder="Instrument" className="w-full text-xs border border-indigo-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-indigo-500" /></div>)}

                                  {cType === 'SCENARIO' && (
                                    <div className="space-y-3 p-3 bg-rose-50/40 rounded-lg border border-rose-100">
                                      <span className="text-[10px] font-bold text-rose-900 uppercase tracking-wider block">Market Dilemma / Challenge Scenario</span>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-700 uppercase block">Question / Challenge Prompt:</label>
                                        <textarea rows={2} value={b.prompt ?? content.prompt ?? content.dilemma ?? content.context ?? ''} onChange={(e) => { const val = e.target.value; onUpdateBlock(globalIdx, { ...b, prompt: val, title: b.title && !b.title.startsWith('Block ') ? b.title : val, content: { ...content, prompt: val, dilemma: val } }); }} placeholder="Enter the main question for the learner..." className="w-full text-xs font-semibold bg-white border border-rose-200 rounded p-2 resize-none focus:border-rose-400 focus:outline-none" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Market Scenario / Context Details (Optional):</label>
                                        <textarea rows={2} value={content.context || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, content: { ...content, context: e.target.value } })} placeholder="Describe market situation or price action..." className="w-full text-xs bg-white border border-rose-200 rounded p-1.5 resize-none focus:outline-none" />
                                      </div>
                                      {b.media_asset_id && (
                                        <div className="flex items-center gap-2 pt-1">
                                          <span className="text-[10px] text-slate-500 font-mono truncate">Image Asset: {b.media_asset_id}</span>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); openMediaForBlock(globalIdx); }} className="text-xs font-bold text-blue-600 hover:text-blue-800">Change Image</button>
                                        </div>
                                      )}
                                      {!b.media_asset_id && (
                                        <button type="button" onClick={(e) => { e.stopPropagation(); openMediaForBlock(globalIdx); }} className="text-[11px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1"><Upload className="w-3 h-3" /> Attach Question Image</button>
                                      )}
                                    </div>
                                  )}

                                  {/* ── Visual Discrimination Question Prompt (for IMAGE_SELECTION) ── */}
                                  {rType === 'IMAGE_SELECTION' && (
                                    <div className="space-y-3 p-3 bg-sky-50/40 rounded-lg border border-sky-200">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                                          <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
                                          Visual Discrimination Question (Image MCQ)
                                        </span>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-700 uppercase block">
                                          Question / Challenge Prompt:
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={b.prompt ?? content.prompt ?? ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            onUpdateBlock(globalIdx, {
                                              ...b,
                                              prompt: val,
                                              title: b.title && !b.title.startsWith('Block ') ? b.title : val,
                                              content: { ...content, prompt: val },
                                            });
                                          }}
                                          placeholder="e.g. Select the correct image from below of the candlestick topic..."
                                          className="w-full text-xs font-semibold bg-white border border-sky-200 rounded p-2 resize-none focus:border-sky-400 focus:outline-none"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                          Market Context / Instructions (Optional):
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={content.context || content.text || ''}
                                          onChange={(e) =>
                                            onUpdateBlock(globalIdx, {
                                              ...b,
                                              content: { ...content, context: e.target.value, text: e.target.value },
                                            })
                                          }
                                          placeholder="Provide market situation or visual inspection guidance..."
                                          className="w-full text-xs bg-white border border-sky-200 rounded p-1.5 resize-none focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {rType !== 'NONE' && rType !== 'TRUE_FALSE' && rType !== 'IMAGE_SELECTION' && (<div className="space-y-2 p-3 bg-green-50/30 rounded-lg border border-green-100"><div className="text-[10px] font-black uppercase text-green-800 flex items-center gap-1.5"><Zap className="w-3 h-3" /> Answer Options</div>{(b.options || []).map((opt, oIdx) => { const isCorrect = opt.is_correct || (b.evaluation?.correct_option_id === opt.id) || (b.correct_option_id === opt.id); return (<div key={opt.id || oIdx} className="flex items-center gap-2"><button type="button" onClick={(e) => { e.stopPropagation(); const updatedOpts = b.options.map((o) => ({ ...o, is_correct: o.id === opt.id })); onUpdateBlock(globalIdx, { ...b, options: updatedOpts, evaluation: { ...(b.evaluation || {}), correct_option_id: opt.id }, correct_option_id: opt.id }); }} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isCorrect ? 'border-green-500 bg-green-500' : 'border-slate-300 bg-white hover:border-green-400'}`}>{isCorrect && <CheckCircle2 className="w-3 h-3 text-white" />}</button><input type="text" value={opt.text ?? opt.label ?? ''} onChange={(e) => { const updatedOpts = b.options.map((o, i2) => i2 === oIdx ? { ...o, text: e.target.value, label: e.target.value } : o); onUpdateBlock(globalIdx, { ...b, options: updatedOpts }); }} onClick={(e) => e.stopPropagation()} placeholder={`Option ${oIdx + 1}`} className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-500" /><button type="button" onClick={(e) => { e.stopPropagation(); const filteredOpts = b.options.filter((_, i2) => i2 !== oIdx); onUpdateBlock(globalIdx, { ...b, options: filteredOpts }); }} className="p-0.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500"><XCircle className="w-3.5 h-3.5" /></button></div>); })}<button type="button" onClick={(e) => { e.stopPropagation(); const newOpt = { id: generateUUID(), text: '', label: '', is_correct: false }; onUpdateBlock(globalIdx, { ...b, options: [...(b.options || []), newOpt] }); }} className="text-[11px] font-bold text-green-700 hover:text-green-900 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Option</button><textarea value={b.evaluation?.explanation || ''} onChange={(e) => onUpdateBlock(globalIdx, { ...b, evaluation: { ...(b.evaluation || {}), explanation: e.target.value } })} onClick={(e) => e.stopPropagation()} placeholder="Explanation shown after learner answers..." rows={2} className="w-full text-xs border border-green-200 rounded p-2 bg-white focus:outline-none focus:border-green-500" /></div>)}

                                  {/* ── Dedicated IMAGE_SELECTION Visual Pattern Choices Editor (Mirrors Normal MCQ with Image Slots) ── */}
                                  {rType === 'IMAGE_SELECTION' && (
                                    <div className="mt-3 p-3.5 rounded-lg bg-sky-50/50 border border-sky-200 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-sky-900 uppercase tracking-wider">
                                          <Zap className="w-3.5 h-3.5 text-sky-600" />
                                          <span>Answer Options (Image Choices)</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const existing = b.options || [];
                                            const newOptId = generateUUID();
                                            const newIdx = existing.length + 1;
                                            onUpdateBlock(globalIdx, {
                                              ...b,
                                              options: [
                                                ...existing,
                                                {
                                                  id: newOptId,
                                                  label: `Option ${String.fromCharCode(64 + newIdx)}`,
                                                  text: `Option ${String.fromCharCode(64 + newIdx)}`,
                                                  media_asset_id: null,
                                                  is_correct: false,
                                                },
                                              ],
                                            });
                                          }}
                                          className="text-[11px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 bg-white border border-sky-200 px-2.5 py-1 rounded shadow-sm hover:bg-sky-50 transition-colors cursor-pointer"
                                        >
                                          <Plus className="w-3 h-3" /> Add Option
                                        </button>
                                      </div>

                                      {/* Options List (Clean, identical to normal MCQ + Image Box) */}
                                      <div className="space-y-2.5">
                                        {(b.options || []).map((opt, optIdx) => {
                                          const isCorrect =
                                            b.evaluation?.correct_option_id === opt.id ||
                                            opt.is_correct ||
                                            b.correct_option_id === opt.id;
                                          return (
                                            <div
                                              key={opt.id || optIdx}
                                              className={`p-2.5 rounded-xl border bg-white flex flex-col sm:flex-row items-start sm:items-center gap-3 transition-all ${
                                                isCorrect
                                                  ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
                                                  : 'border-slate-200 hover:border-slate-300'
                                              }`}
                                            >
                                              {/* Radio selector for correct answer */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const updatedOpts = (b.options || []).map((o) => ({
                                                    ...o,
                                                    is_correct: o.id === opt.id,
                                                  }));
                                                  onUpdateBlock(globalIdx, {
                                                    ...b,
                                                    options: updatedOpts,
                                                    evaluation: {
                                                      ...(b.evaluation || {}),
                                                      correct_option_id: opt.id,
                                                    },
                                                    correct_option_id: opt.id,
                                                  });
                                                }}
                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                                                  isCorrect
                                                    ? 'border-sky-600 bg-sky-600 text-white'
                                                    : 'border-slate-300 bg-white hover:border-sky-400'
                                                }`}
                                                title={isCorrect ? 'Correct Option' : 'Mark as Correct'}
                                              >
                                                {isCorrect && <CheckCircle2 className="w-4 h-4 text-white" />}
                                              </button>

                                              {/* Image Slot for this option */}
                                              <div className="shrink-0">
                                                {opt.media_asset_id ? (
                                                  <div className="flex items-center gap-1.5">
                                                    <div
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openMediaForOption(globalIdx, optIdx);
                                                      }}
                                                      className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 p-0.5 cursor-pointer hover:border-sky-400 transition-colors overflow-hidden flex items-center justify-center relative group"
                                                      title="Click to change image"
                                                    >
                                                      <MediaImagePreview
                                                        mediaAssetId={opt.media_asset_id}
                                                        alt={opt.label || opt.text || 'Choice'}
                                                        className="w-full h-full object-contain"
                                                      />
                                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-bold rounded-lg">
                                                        Change
                                                      </div>
                                                    </div>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const nextOptions = [...(b.options || [])];
                                                        nextOptions[optIdx] = { ...nextOptions[optIdx], media_asset_id: null };
                                                        onUpdateBlock(globalIdx, { ...b, options: nextOptions });
                                                      }}
                                                      className="text-[10px] text-rose-500 hover:text-rose-700 font-medium p-1"
                                                      title="Remove image from option"
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      openMediaForOption(globalIdx, optIdx);
                                                    }}
                                                    className="h-16 px-3 border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-lg text-[11px] font-bold text-sky-700 bg-sky-50/50 hover:bg-sky-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                                                  >
                                                    <Upload className="w-3.5 h-3.5 text-sky-600" />
                                                    <span>+ Choose Image</span>
                                                  </button>
                                                )}
                                              </div>

                                              {/* Option Label / Text Input */}
                                              <input
                                                type="text"
                                                value={opt.label || opt.text || ''}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  const updatedOpts = (b.options || []).map((o, i) =>
                                                    i === optIdx
                                                      ? { ...o, label: val, text: val }
                                                      : o
                                                  );
                                                  onUpdateBlock(globalIdx, { ...b, options: updatedOpts });
                                                }}
                                                placeholder={`Option ${String.fromCharCode(65 + optIdx)} (e.g. Pattern name or description)`}
                                                className="flex-1 w-full text-xs p-2 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none bg-slate-50/50 focus:bg-white"
                                              />

                                              {/* Correct badge */}
                                              {isCorrect && (
                                                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full shrink-0">
                                                  ✓ Correct Answer
                                                </span>
                                              )}

                                              {/* Delete Option button */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const updatedOpts = (b.options || []).filter(
                                                    (_, i) => i !== optIdx
                                                  );
                                                  const wasCorrect =
                                                    b.evaluation?.correct_option_id === opt.id ||
                                                    b.correct_option_id === opt.id ||
                                                    opt.is_correct;
                                                  const nextCorrectId = wasCorrect
                                                    ? updatedOpts[0]?.id || null
                                                    : b.evaluation?.correct_option_id || b.correct_option_id;
                                                  const finalOpts = wasCorrect
                                                    ? updatedOpts.map((o, idx) => ({ ...o, is_correct: idx === 0 }))
                                                    : updatedOpts;
                                                  onUpdateBlock(globalIdx, {
                                                    ...b,
                                                    options: finalOpts,
                                                    evaluation: {
                                                      ...(b.evaluation || {}),
                                                      correct_option_id: nextCorrectId,
                                                    },
                                                    correct_option_id: nextCorrectId,
                                                  });
                                                }}
                                                className="p-1 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500 shrink-0"
                                                title="Remove option"
                                              >
                                                <XCircle className="w-4 h-4" />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Explanation for remediation */}
                                      <div className="pt-2 border-t border-sky-100 space-y-1">
                                        <label className="text-[10px] font-bold text-sky-800 uppercase block">
                                          Explanation shown after learner answers:
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={b.evaluation?.explanation || ''}
                                          onChange={(e) =>
                                            onUpdateBlock(globalIdx, {
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
                                          placeholder="Explain why the correct pattern holds and how to distinguish it..."
                                          className="w-full text-xs p-2 bg-white border border-sky-200 rounded focus:outline-none focus:border-sky-500 resize-none"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {rType === 'TRUE_FALSE' && (<div className="space-y-2 p-3 bg-green-50/30 rounded-lg border border-green-100"><div className="text-[10px] font-black uppercase text-green-800">True / False</div><div className="flex gap-4">{['True', 'False'].map((tfVal, tfIdx) => { const tfOpts = b.options?.length >= 2 ? b.options : [{ id: generateUUID(), text: 'True', is_correct: true }, { id: generateUUID(), text: 'False', is_correct: false }]; const optId = tfOpts[tfIdx]?.id; const isSelected = (b.evaluation?.correct_option_id === optId) || (b.correct_option_id === optId) || tfOpts[tfIdx]?.is_correct; return (<label key={tfVal} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer ${isSelected ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-white'}`}><input type="radio" name={`tf_${b.id}`} checked={isSelected} onChange={() => { onUpdateBlock(globalIdx, { ...b, options: tfOpts, evaluation: { ...(b.evaluation || {}), correct_option_id: optId }, correct_option_id: optId }); }} /><span>{tfVal}</span></label>); })}</div></div>)}
                                </div>

                                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); onMoveBlock(globalIdx, 'UP'); }} disabled={globalIdx === 0} title="Move Up" className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); onMoveBlock(globalIdx, 'DOWN'); }} disabled={globalIdx === blocks.length - 1} title="Move Down" className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicateBlock(globalIdx); }} title="Duplicate Block" className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"><Copy className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteBlock(globalIdx); }} title="Delete Block" className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    <div className="px-3 pb-3">
                      <button type="button" onClick={() => openPickerForStep(page.pageId || page.pageKey)} className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-lg text-[11px] font-bold text-slate-400 hover:text-blue-600 bg-white/60 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-1.5">
                        <Plus className="w-3 h-3" />
                        Add Block to Step {pIdx + 1}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-2">
          <button type="button" onClick={() => handleAddStep('TEXT')} className="w-full py-5 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-xl text-sm font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50/30 hover:bg-indigo-50/60 transition-all flex items-center justify-center gap-2.5 group">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600 transition-colors"><Plus className="w-4 h-4" /></span>
            <span>Add New Step</span>
            <span className="text-indigo-300 font-normal text-[11px] group-hover:text-indigo-400">— creates a new learner screen</span>
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