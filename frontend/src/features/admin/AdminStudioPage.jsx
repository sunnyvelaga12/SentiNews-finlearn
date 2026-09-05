import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CurriculumNavigator } from './components/CurriculumNavigator';
import { PedagogicalCanvas } from './components/PedagogicalCanvas';
import { InspectorAndQualityPanel } from './components/InspectorAndQualityPanel';
import { GovernanceBar } from './components/GovernanceBar';
import { LiveIsolatedPreview } from './components/LiveIsolatedPreview';
import { ReviewInbox } from './components/ReviewInbox';
import { SourceLibrary } from './components/SourceLibrary';
import { ContentHealthDashboard } from './components/ContentHealthDashboard';
import { evaluatePedagogicalQuality } from './utils/pedagogicalRules';
import { generateUUID, createBlock } from './utils/blockRegistry';
import { apiClient } from '../../services/apiClient';
import { Play, Edit3, AlertOctagon, } from 'lucide-react';
export const AdminStudioPage = () => {
    // Mode: EDIT vs PREVIEW (dedicated mode switch, no visual competition)
    const [mode, setMode] = useState('EDIT');
    // Curriculum Tree State
    const [tree, setTree] = useState([]);
    const [isLoadingTree, setIsLoadingTree] = useState(true);
    // Selected Lesson State
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [selectedModule, setSelectedModule] = useState(null);
    // Active Draft Content State (Center Canvas & Right Inspector)
    const [lessonTitle, setLessonTitle] = useState('');
    const [lessonSlug, setLessonSlug] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(5);
    const [level, setLevel] = useState('BEGINNER');
    const [learningObjectives, setLearningObjectives] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    // Governance & Version State
    const [currentVersionId, setCurrentVersionId] = useState('');
    const [versionNumber, setVersionNumber] = useState(1);
    const [status, setStatus] = useState('DRAFT');
    // Autosave & Dirty Tracking
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState(new Date());
    const [occConflict, setOccConflict] = useState(null);
    // Unsaved changes confirmation dialog
    const [pendingNavigationAction, setPendingNavigationAction] = useState(null);
    // Top Surface Tabs (Studio · Reviews · Sources · Health)
    const [surfaceTab, setSurfaceTab] = useState('STUDIO');
    // Role Simulator
    const [userRole, setUserRole] = useState('SUPER_ADMIN');
    const fetchCurriculumTree = useCallback(async (targetLessonId = null) => {
        try {
            setIsLoadingTree(true);
            const data = await apiClient('/api/v1/curriculum/admin/tree');
            if (data) {
                const rawTree = Array.isArray(data) ? data : (data?.tree || []);
                setTree(rawTree);

                // Flatten units with lessons from full 6-level hierarchy for selection lookups
                const allUnitsWithLessons = [];
                for (const d of rawTree) {
                    for (const w of (d.worlds || [])) {
                        for (const s of (w.series || [])) {
                            for (const m of (s.modules || [])) {
                                for (const u of (m.units || [])) {
                                    allUnitsWithLessons.push({ module: m, unit: u, lessons: u.lessons || [] });
                                }
                            }
                        }
                    }
                }

                // If a target lesson was specified or previously active in sessionStorage, select it
                const targetId = targetLessonId || (typeof window !== 'undefined' ? sessionStorage.getItem('lcms_active_lesson_id') : null);
                if (targetId) {
                    for (const item of allUnitsWithLessons) {
                        const l = item.lessons.find((les) => les.id === targetId || les.version_id === targetId);
                        if (l) {
                            setSelectedModule(item.module);
                            setSelectedUnit(item.unit);
                            setSelectedLesson(l);
                            if (typeof window !== 'undefined' && l.id) {
                                sessionStorage.setItem('lcms_active_lesson_id', l.id);
                            }
                            loadLessonDraft(l);
                            return;
                        }
                    }
                }

                // Auto-select first lesson if none selected
                if (!selectedLesson) {
                    for (const item of allUnitsWithLessons) {
                        if (item.lessons.length > 0) {
                            const firstLesson = item.lessons[0];
                            setSelectedModule(item.module);
                            setSelectedUnit(item.unit);
                            setSelectedLesson(firstLesson);
                            if (typeof window !== 'undefined' && firstLesson.id) {
                                sessionStorage.setItem('lcms_active_lesson_id', firstLesson.id);
                            }
                            loadLessonDraft(firstLesson);
                            return;
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error('Failed to fetch curriculum tree:', err);
        }
        finally {
            setIsLoadingTree(false);
        }
    }, [selectedLesson]);
    useEffect(() => {
        fetchCurriculumTree();
    }, [fetchCurriculumTree]);
    // ── 2. Load Selected Lesson Draft ──────────────────────────────────────────
    const loadLessonDraft = async (lesson) => {
        try {
            if (lesson.id && typeof window !== 'undefined') {
                sessionStorage.setItem('lcms_active_lesson_id', lesson.id);
            }
            if (lesson.version_id) {
                const data = await apiClient(`/api/v1/admin/lessons/draft/${lesson.version_id}`);
                if (data) {
                    setLessonTitle(data.title || lesson.title);
                    setLessonSlug(data.slug || lesson.slug);
                    setDurationMinutes(data.duration_minutes || 5);
                    setLevel(data.level || 'BEGINNER');
                    setLearningObjectives(data.learning_objectives || []);
                    setCurrentVersionId(data.version_id || lesson.version_id);
                    setVersionNumber(data.version_number || lesson.version_number || 1);
                    setStatus(data.status || lesson.status);
                    // Populate blocks sorted strictly by order_index
                    const rawBlocks = data.blocks || [];
                    if (rawBlocks.length > 0) {
                        const sortedBlocks = [...rawBlocks].sort(
                            (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
                        );
                        setBlocks(sortedBlocks);
                    }
                    else {
                        // Provide sensible defaults for empty lessons
                        setBlocks([
                            {
                                id: `block_${Date.now()}`,
                                order_index: 0,
                                content_type: 'HEADING',
                                activity_type: 'EXPERIENCE',
                                response_type: 'NONE',
                                title: data.title || lesson.title || 'Lesson Overview',
                                content: { title: data.title || lesson.title || 'Lesson Overview', level: 1 },
                                evidence_role: 'NONE',
                                difficulty: 1,
                            },
                            {
                                id: `block_${Date.now() + 1}`,
                                order_index: 1,
                                content_type: 'TEXT',
                                activity_type: 'EXPERIENCE',
                                response_type: 'NONE',
                                title: 'Core Principles',
                                content: { body: 'Explore the foundations, mechanics, and core principles of this financial topic.' },
                                evidence_role: 'NONE',
                                difficulty: 1,
                            },
                        ]);
                    }
                    setActiveBlockIndex(0);
                    setHasUnsavedChanges(false);
                    setOccConflict(null);
                    return;
                }
            }
            // Fallback if no version_id exists yet
            setLessonTitle(lesson.title);
            setLessonSlug(lesson.slug);
            setDurationMinutes(5);
            setLevel('BEGINNER');
            setLearningObjectives([`Understand ${lesson.title || 'key concepts'}`]);
            setStatus(lesson.status || 'DRAFT');
            setBlocks([
                {
                    id: `block_${Date.now()}`,
                    order_index: 0,
                    content_type: 'HEADING',
                    activity_type: 'EXPERIENCE',
                    response_type: 'NONE',
                    title: lesson.title || 'Lesson Overview',
                    content: { title: lesson.title || 'Lesson Overview', level: 1 },
                    evidence_role: 'NONE',
                    difficulty: 1,
                },
                {
                    id: `block_${Date.now() + 1}`,
                    order_index: 1,
                    content_type: 'TEXT',
                    activity_type: 'EXPERIENCE',
                    response_type: 'NONE',
                    title: 'Core Principles',
                    content: { body: 'Explore the foundations, mechanics, and core principles of this financial topic.' },
                    evidence_role: 'NONE',
                    difficulty: 1,
                },
            ]);
            setHasUnsavedChanges(false);
        }
        catch (err) {
            console.error('Failed to load lesson draft:', err);
        }
    };
    // ── 3. Real-Time Pedagogical Quality Evaluation ────────────────────────────
    const qualityResult = useMemo(() => {
        return evaluatePedagogicalQuality({
            title: lessonTitle,
            level,
            learning_objectives: learningObjectives,
        }, blocks);
    }, [lessonTitle, level, learningObjectives, blocks]);
    // ── 4. Save Draft with OCC (If-Match) ───────────────────────────────────────
    const handleSaveDraft = async () => {
        if (!currentVersionId)
            return;
        try {
            setIsSaving(true);
            const payload = {
                title: lessonTitle,
                duration_minutes: durationMinutes,
                learning_objectives: learningObjectives,
                blocks_json: blocks,
            };
            const data = await apiClient(`/api/v1/admin/lessons/draft/${currentVersionId}`, {
                method: 'PATCH',
                headers: {
                    'If-Match': `"${versionNumber}"`,
                },
                body: JSON.stringify(payload),
            });
            if (data) {
                setVersionNumber(data.version_number);
                setHasUnsavedChanges(false);
                setLastSavedTime(new Date());
                setOccConflict(null);
            }
        }
        catch (err) {
            if (err?.status === 409 || err?.message?.includes('OCC')) {
                setOccConflict({
                    serverVersion: versionNumber + 1,
                    conflictType: 'CONTENT',
                    diffSummary: err.message || 'The draft was updated on the server by another editor.',
                });
            }
            else {
                console.error('Failed to save draft:', err);
            }
        }
        finally {
            setIsSaving(false);
        }
    };

    // ── 4b. Debounced Autosave (1000ms idle with OCC If-Match) ─────────────────
    useEffect(() => {
        if (!hasUnsavedChanges || !currentVersionId || isSaving || occConflict) {
            return;
        }
        const timer = setTimeout(() => {
            handleSaveDraft();
        }, 1000);
        return () => clearTimeout(timer);
    }, [hasUnsavedChanges, currentVersionId, isSaving, occConflict, lessonTitle, durationMinutes, learningObjectives, blocks, versionNumber]);

    // ── 5. Staged Creation Handlers ────────────────────────────────────────────
    const handleCreateModule = async (moduleData) => {
        try {
            const payload = typeof moduleData === 'string' ? { name: moduleData } : moduleData;
            const data = await apiClient('/api/v1/curriculum/modules', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            await fetchCurriculumTree();
            return data;
        } catch (err) {
            console.error('Failed to create module:', err);
            throw err;
        }
    };

    const handleCreateUnit = async (moduleId, unitName, description) => {
        try {
            const data = await apiClient('/api/v1/curriculum/units', {
                method: 'POST',
                body: JSON.stringify({
                    module_id: moduleId,
                    name: unitName,
                    description: description || `Unit: ${unitName}`,
                }),
            });
            await fetchCurriculumTree();
            return data;
        } catch (err) {
            console.error('Failed to create unit:', err);
            throw err;
        }
    };

    const handleCreateLesson = async (unitId, lessonInput) => {
        const title = typeof lessonInput === 'string' ? lessonInput : lessonInput.title;
        const durationMinutes = lessonInput?.durationMinutes || 5;
        const lessonLevel = lessonInput?.level || 'BEGINNER';
        const objectives = lessonInput?.learningObjectives || [`Understand ${title}`];
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        try {
            const data = await apiClient('/api/v1/admin/lessons/draft', {
                method: 'POST',
                body: JSON.stringify({
                    unit_id: unitId,
                    slug,
                    title,
                    level: lessonLevel,
                    duration_minutes: durationMinutes,
                    learning_objectives: objectives,
                    blocks: [
                        {
                            id: `block_${Date.now()}`,
                            order_index: 0,
                            content_type: 'HEADING',
                            activity_type: 'OBSERVE',
                            response_type: 'NONE',
                            content: { title, level: 'H1' },
                            difficulty: 1,
                        },
                        {
                            id: `block_${Date.now() + 1}`,
                            order_index: 1,
                            content_type: 'TEXT',
                            activity_type: 'OBSERVE',
                            response_type: 'NONE',
                            content: { text: 'Introduce core concepts and key principles here...' },
                            difficulty: 1,
                        },
                    ],
                }),
            });
            await fetchCurriculumTree(data?.lesson_id);
            if (data?.version_id) {
                const newLesson = {
                    id: data.lesson_id,
                    slug,
                    title,
                    version_id: data.version_id,
                    version_number: 1,
                    status: 'DRAFT',
                };
                setSelectedLesson(newLesson);
                loadLessonDraft(newLesson);
            }
            return data;
        } catch (err) {
            console.error('Failed to create lesson draft:', err);
            throw err;
        }
    };
    const handleDeleteLesson = async (deletedLessonId) => {
        // If the deleted lesson is currently selected, reset state
        if (selectedLesson?.id === deletedLessonId) {
            setSelectedLesson(null);
            setSelectedUnit(null);
            setSelectedModule(null);
            setLessonTitle('');
            setLessonSlug('');
            setBlocks([]);
            setHasUnsavedChanges(false);
        }
        await fetchCurriculumTree();
    };
    // ── 6. Governance Actions (Submit, Review, Publish) ────────────────────────
    const handleSubmitForReview = async () => {
        if (!currentVersionId || !qualityResult.isPublishable)
            return;
        try {
            await apiClient(`/api/v1/admin/lessons/${currentVersionId}/transition`, {
                method: 'POST',
                body: JSON.stringify({
                    new_status: 'EDITOR_REVIEW',
                    notes: 'Submitted for editorial and financial review.',
                }),
            });
            setStatus('EDITOR_REVIEW');
            await fetchCurriculumTree();
        }
        catch (err) {
            console.error('Failed to submit for review:', err);
        }
    };
    const handleApproveReview = async (notes) => {
        if (!currentVersionId)
            return;
        try {
            const data = await apiClient(`/api/v1/admin/lessons/${currentVersionId}/review`, {
                method: 'POST',
                body: JSON.stringify({
                    review_role: 'CONTENT_REVIEWER',
                    status: 'APPROVED',
                    notes,
                }),
            });
            if (data?.version_status)
                setStatus(data.version_status);
            await fetchCurriculumTree();
        }
        catch (err) {
            console.error('Failed to approve review:', err);
        }
    };
    const handlePublish = async () => {
        if (!selectedLesson?.id || !currentVersionId)
            return;
        try {
            await apiClient(`/api/v1/lessons/${selectedLesson.id}/publish`, {
                method: 'POST',
                body: JSON.stringify({
                    version_id: currentVersionId,
                    notes: 'Approved publication to PostgreSQL database.',
                }),
            });
            setStatus('PUBLISHED');
            await fetchCurriculumTree();
        }
        catch (err) {
            console.error('Failed to publish lesson:', err);
        }
    };
    // Block mutation helpers
    const handleUpdateBlock = (idx, updated) => {
        const nextBlocks = [...blocks];
        nextBlocks[idx] = updated;
        setBlocks(nextBlocks);
        setHasUnsavedChanges(true);
    };
    const handleMoveBlock = (idx, direction) => {
        const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= blocks.length)
            return;
        const nextBlocks = [...blocks];
        const temp = nextBlocks[idx];
        nextBlocks[idx] = nextBlocks[targetIdx];
        nextBlocks[targetIdx] = temp;
        nextBlocks.forEach((b, i) => {
            b.order_index = i;
        });
        setBlocks(nextBlocks);
        setActiveBlockIndex(targetIdx);
        setHasUnsavedChanges(true);
    };
    const handleDuplicateBlock = (idx) => {
        const source = blocks[idx];
        if (!source) return;

        let newOptions = undefined;
        let newCorrectOptionId = undefined;

        if (Array.isArray(source.options) && source.options.length > 0) {
            const oldToNewMap = new Map();
            newOptions = source.options.map((opt) => {
                const newOptId = generateUUID();
                oldToNewMap.set(opt.id, newOptId);
                return {
                    ...opt,
                    id: newOptId,
                };
            });
            const oldCorrect = source.evaluation?.correct_option_id || source.correct_option_id;
            newCorrectOptionId = oldToNewMap.get(oldCorrect) || newOptions[0]?.id;
        }

        const duplicate = {
            ...JSON.parse(JSON.stringify(source)),
            id: generateUUID(),
            title: source.title ? `${source.title} (Copy)` : 'Copy',
            options: newOptions !== undefined ? newOptions : source.options,
            evaluation: source.evaluation ? {
                ...source.evaluation,
                correct_option_id: newCorrectOptionId || source.evaluation.correct_option_id,
            } : undefined,
            correct_option_id: newCorrectOptionId || source.correct_option_id,
        };

        const nextBlocks = [...blocks];
        nextBlocks.splice(idx + 1, 0, duplicate);
        nextBlocks.forEach((b, i) => {
            b.order_index = i;
        });
        setBlocks(nextBlocks);
        setActiveBlockIndex(idx + 1);
        setHasUnsavedChanges(true);
    };
    const handleDeleteBlock = (idx) => {
        if (blocks.length <= 1)
            return;
        const nextBlocks = blocks.filter((_, i) => i !== idx);
        nextBlocks.forEach((b, i) => {
            b.order_index = i;
        });
        setBlocks(nextBlocks);
        setActiveBlockIndex(Math.max(0, idx - 1));
        setHasUnsavedChanges(true);
    };
    const handleAddBlock = (blockInput, insertAt = null) => {
        let newBlock;
        if (typeof blockInput === 'string') {
            try {
                newBlock = createBlock(blockInput, blocks.length);
            } catch {
                newBlock = createBlock('TEXT', blocks.length);
            }
        } else if (typeof blockInput === 'object' && blockInput !== null) {
            const cType = blockInput.content_type || blockInput.type || 'TEXT';
            try {
                newBlock = createBlock(cType, blocks.length, blockInput);
            } catch {
                const optA = generateUUID();
                const optB = generateUUID();
                const isInteractive = (blockInput.response_type && blockInput.response_type !== 'NONE');
                newBlock = {
                    id: generateUUID(),
                    order_index: blocks.length,
                    content_type: cType,
                    type: cType,
                    activity_type: blockInput.activity_type || 'OBSERVE',
                    response_type: blockInput.response_type || 'NONE',
                    evidence_role: blockInput.evidence_role || (isInteractive ? 'MASTERY_EVIDENCE' : 'NONE'),
                    difficulty: blockInput.difficulty || 1,
                    title: blockInput.title || `New ${cType}`,
                    content: blockInput.content || (cType === 'TEXT' ? { text: '' } : {}),
                    options: isInteractive ? (blockInput.options || [
                        { id: optA, text: 'Option A (Correct)', is_correct: true },
                        { id: optB, text: 'Option B', is_correct: false },
                    ]) : undefined,
                    evaluation: isInteractive ? (blockInput.evaluation || {
                        correct_option_id: optA,
                        explanation: 'Explanation for learner feedback and remediation.',
                    }) : undefined,
                    correct_option_id: isInteractive ? optA : undefined,
                };
            }
        }
        if (newBlock) {
            // insertAt: optional position (0-indexed). null = append to end.
            if (insertAt !== null && insertAt >= 0 && insertAt <= blocks.length) {
                const nextBlocks = [
                    ...blocks.slice(0, insertAt),
                    { ...newBlock, order_index: insertAt },
                    ...blocks.slice(insertAt),
                ];
                nextBlocks.forEach((b, i) => { b.order_index = i; });
                setBlocks(nextBlocks);
                setActiveBlockIndex(insertAt);
            } else {
                newBlock.order_index = blocks.length;
                setBlocks([...blocks, newBlock]);
                setActiveBlockIndex(blocks.length);
            }
            setHasUnsavedChanges(true);
        }
    };
    const handleReorderBlocks = (reorderedBlocks) => {
        setBlocks(reorderedBlocks);
        setHasUnsavedChanges(true);
    };
    const handleApplyQuickFix = (issue) => {
        if (!issue.suggestedAction)
            return;
        const { actionType, payload } = issue.suggestedAction;
        if (actionType === 'ADD_STEP' && payload?.type) {
            handleAddBlock(payload.type);
        }
        else if (actionType === 'EDIT_BLOCK' && issue.blockIndex !== undefined) {
            const b = blocks[issue.blockIndex];
            handleUpdateBlock(issue.blockIndex, { ...b, ...payload });
        }
        else if (actionType === 'SET_CORRECT_OPTION' && issue.blockIndex !== undefined) {
            const b = blocks[issue.blockIndex];
            if (b.options && b.options.length > 0) {
                const updatedOpts = b.options.map((o, i) => ({ ...o, is_correct: i === 0 }));
                handleUpdateBlock(issue.blockIndex, {
                    ...b,
                    options: updatedOpts,
                    correct_option_id: updatedOpts[0]?.id,
                });
            }
        }
    };
    // Last saved relative string
    const lastSavedText = `Saved ${Math.round((Date.now() - lastSavedTime.getTime()) / 1000)}s ago`;
    return (<div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F7F8FA] text-slate-900 font-sans">
      {/* ── Top Workspace Bar (Notion/Linear Density) ── */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-black text-xs">
              S
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-900">
              SentiNews Studio
            </span>
          </div>

          {/* Breadcrumb Path */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
            <span>Curriculum</span>
            <span>/</span>
            <span className="font-medium text-slate-700">{selectedModule?.name || 'All Modules'}</span>
            <span>/</span>
            <span className="font-medium text-slate-700">{selectedUnit?.name || 'Unit'}</span>
            <span>/</span>
            <span className="font-semibold text-blue-600">{lessonTitle || 'Select a Lesson'}</span>
          </div>
        </div>

        {/* Center: Surface Tabs (Studio · Reviews · Sources · Health) */}
        <div className="hidden lg:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
          <button onClick={() => setSurfaceTab('STUDIO')} className={`px-3 py-1 rounded-md transition-colors ${surfaceTab === 'STUDIO' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600'}`}>
            Studio
          </button>
          <button onClick={() => setSurfaceTab('REVIEWS')} className={`px-3 py-1 rounded-md transition-colors ${surfaceTab === 'REVIEWS' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600'}`}>
            Reviews
          </button>
          <button onClick={() => setSurfaceTab('SOURCES')} className={`px-3 py-1 rounded-md transition-colors ${surfaceTab === 'SOURCES' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600'}`}>
            Sources
          </button>
          <button onClick={() => setSurfaceTab('HEALTH')} className={`px-3 py-1 rounded-md transition-colors ${surfaceTab === 'HEALTH' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600'}`}>
            Content Health
          </button>
        </div>

        {/* Right: Role Simulator & Mode Switcher */}
        <div className="flex items-center gap-3">
          {/* Role Simulator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Role:</span>
            <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded px-2 py-1 focus:outline-none focus:border-blue-500">
              <option value="SUPER_ADMIN">Super Admin (All Access)</option>
              <option value="CONTENT_EDITOR">Content Editor</option>
              <option value="FINANCE_REVIEWER">Finance Reviewer</option>
              <option value="COMPLIANCE_REVIEWER">Compliance Reviewer</option>
            </select>
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            <button onClick={() => setMode('EDIT')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${mode === 'EDIT'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-800'}`}>
              <Edit3 className="w-3.5 h-3.5"/>
              <span>Edit</span>
            </button>

            <button onClick={() => setMode('PREVIEW')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${mode === 'PREVIEW'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-800'}`}>
              <Play className="w-3.5 h-3.5"/>
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Surface Switching ── */}
      {mode === 'PREVIEW' ? (<div className="flex-1 overflow-hidden">
          <LiveIsolatedPreview lessonTitle={lessonTitle} blocks={blocks} activeStepIndex={activeBlockIndex} onClosePreview={() => setMode('EDIT')}/>
        </div>) : surfaceTab === 'REVIEWS' ? (<ReviewInbox userRole={userRole} onOpenLesson={(versionId) => {
                setSurfaceTab('STUDIO');
                // Select and load lesson draft
                apiClient(`/api/v1/admin/lessons/draft/${versionId}`).then((data) => {
                    if (data) {
                        setLessonTitle(data.title);
                        setLessonSlug(data.slug);
                        setCurrentVersionId(data.version_id);
                        setVersionNumber(data.version_number);
                        setStatus(data.status);
                        if (data.blocks)
                            setBlocks(data.blocks);
                    }
                });
            }}/>) : surfaceTab === 'SOURCES' ? (<SourceLibrary onAttachSource={(source) => {
                if (blocks[activeBlockIndex]) {
                    handleUpdateBlock(activeBlockIndex, {
                        ...blocks[activeBlockIndex],
                        source_citation: {
                            provider: source.provider,
                            instrument: source.instrument,
                            date: source.date,
                            timeframe: source.timeframe,
                            source_url: source.source_url,
                            jurisdiction: source.jurisdiction,
                        },
                    });
                    setSurfaceTab('STUDIO');
                }
            }}/>) : surfaceTab === 'HEALTH' ? (<ContentHealthDashboard totalLessons={tree.reduce((acc, d) => acc +
                d.modules.reduce((mAcc, m) => mAcc + m.units.reduce((uAcc, u) => uAcc + u.lessons.length, 0), 0), 0)} publishedCount={2} draftCount={3} inReviewCount={1}/>) : (
        /* ── Surface: 3-Column Content Studio (Navigator · Canvas · Inspector) ── */
        <div className="flex flex-1 overflow-hidden">
          {/* Column 1: Curriculum Navigator (Left 280px) */}
          <div className="w-72 shrink-0 h-full">
            <CurriculumNavigator tree={tree} selectedLessonId={selectedLesson?.id} hasUnsavedChanges={hasUnsavedChanges} onSelectLesson={(lesson, unit, mod) => {
                setSelectedLesson(lesson);
                setSelectedUnit(unit);
                setSelectedModule(mod);
                loadLessonDraft(lesson);
            }} onCreateModule={handleCreateModule} onCreateUnit={handleCreateUnit} onCreateLesson={handleCreateLesson} onPromptUnsavedChanges={(targetAction) => {
                setPendingNavigationAction(() => targetAction);
            }} onEditModule={() => fetchCurriculumTree()} onDeleteModule={() => fetchCurriculumTree()} onEditUnit={() => fetchCurriculumTree()} onDeleteUnit={() => fetchCurriculumTree()} onDeleteLesson={handleDeleteLesson}/>
          </div>

          {/* Column 2: Pedagogical Canvas (Center Flex) */}
          <PedagogicalCanvas lessonTitle={lessonTitle} lessonSlug={lessonSlug} durationMinutes={durationMinutes} level={level} learningObjectives={learningObjectives} blocks={blocks} activeBlockIndex={activeBlockIndex} pacingIssues={qualityResult.pacingStreaks} onUpdateMetadata={(updates) => {
                if (updates.title !== undefined)
                    setLessonTitle(updates.title);
                if (updates.slug !== undefined)
                    setLessonSlug(updates.slug);
                if (updates.durationMinutes !== undefined)
                    setDurationMinutes(updates.durationMinutes);
                if (updates.level !== undefined)
                    setLevel(updates.level);
                if (updates.learningObjectives !== undefined)
                    setLearningObjectives(updates.learningObjectives);
                setHasUnsavedChanges(true);
            }} onSelectBlock={(idx) => setActiveBlockIndex(idx)} onUpdateBlock={handleUpdateBlock} onMoveBlock={handleMoveBlock} onDuplicateBlock={handleDuplicateBlock} onDeleteBlock={handleDeleteBlock} onAddBlock={handleAddBlock} onReorderBlocks={handleReorderBlocks} onPreviewStep={(idx) => {
                setActiveBlockIndex(idx);
                setMode('PREVIEW');
            }}/>


          {/* Column 3: Properties, Quality & Sources Inspector (Right 340px) */}
          <InspectorAndQualityPanel selectedBlock={blocks[activeBlockIndex]} selectedBlockIndex={activeBlockIndex} qualityResult={qualityResult} onUpdateSelectedBlock={(updated) => handleUpdateBlock(activeBlockIndex, updated)} onJumpToBlock={(idx) => setActiveBlockIndex(idx)} onApplyQuickFix={handleApplyQuickFix}/>
        </div>)}

      {/* ── Bottom Governance Action Ribbon (Studio Edit Mode Only) ── */}
      {mode === 'EDIT' && surfaceTab === 'STUDIO' && (<GovernanceBar status={status} versionNumber={versionNumber} userRole={userRole} isPublishable={qualityResult.isPublishable} isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} lastSavedText={lastSavedText} occConflict={occConflict} onSaveDraft={handleSaveDraft} onValidate={() => { }} onOpenPreview={() => setMode('PREVIEW')} onSubmitForReview={handleSubmitForReview} onApproveReview={handleApproveReview} onRequestChanges={(notes) => handleApproveReview(`CHANGES_REQUESTED: ${notes}`)} onPublish={handlePublish} onResolveOccConflict={(res) => {
                if (res === 'RELOAD' && selectedLesson) {
                    loadLessonDraft(selectedLesson);
                }
                else {
                    setOccConflict(null);
                }
            }}/>)}

      {/* ── Unsaved Changes Guard Modal ── */}
      {pendingNavigationAction && (<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <AlertOctagon className="w-4 h-4"/>
              <span>Unsaved Changes</span>
            </div>
            <p className="text-xs text-slate-600">
              You have unsaved changes on the current lesson. Switching lessons now will discard your
              unsaved edits.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPendingNavigationAction(null)} className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Stay
              </button>
              <button onClick={async () => {
                await handleSaveDraft();
                const act = pendingNavigationAction;
                setPendingNavigationAction(null);
                act();
            }} className="px-3 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white">
                Save & Switch
              </button>
              <button onClick={() => {
                const act = pendingNavigationAction;
                setPendingNavigationAction(null);
                setHasUnsavedChanges(false);
                act();
            }} className="px-3 py-1.5 rounded text-xs font-semibold text-rose-600 hover:bg-rose-50">
                Discard
              </button>
            </div>
          </div>
        </div>)}
    </div>);
};
