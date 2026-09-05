import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { apiClient, setAdminRole } from '../../services/apiClient';
import { Play, Edit3, AlertOctagon, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
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
    // Validation report modal
    const [showValidationModal, setShowValidationModal] = useState(false);
    // Top Surface Tabs (Studio · Reviews · Sources · Health)
    const [surfaceTab, setSurfaceTab] = useState('STUDIO');
    // Role Simulator
    const [userRole, setUserRole] = useState('SUPER_ADMIN');

    // Canonical synchronization refs to prevent closures from clobbering in-flight or rapid edits
    const selectedLessonRef = useRef(selectedLesson);
    useEffect(() => {
        selectedLessonRef.current = selectedLesson;
    }, [selectedLesson]);

    const latestStateRef = useRef({
        blocks,
        lessonTitle,
        lessonSlug,
        durationMinutes,
        level,
        learningObjectives,
        currentVersionId,
        versionNumber,
    });
    useEffect(() => {
        latestStateRef.current = {
            blocks,
            lessonTitle,
            lessonSlug,
            durationMinutes,
            level,
            learningObjectives,
            currentVersionId,
            versionNumber,
        };
    }, [blocks, lessonTitle, lessonSlug, durationMinutes, level, learningObjectives, currentVersionId, versionNumber]);

    const isSavingRef = useRef(false);
    const hasPendingChangesRef = useRef(false);

    // Sync simulated role with API client headers
    useEffect(() => {
        setAdminRole(userRole);
    }, [userRole]);

    // Compute canonical health stats across the full 6-level hierarchy safely
    const healthStats = useMemo(() => {
        let totalModules = 0;
        let totalUnits = 0;
        let totalLessons = 0;
        let publishedCount = 0;
        let draftCount = 0;
        let inReviewCount = 0;

        for (const d of tree) {
            const modules = (d.modules && d.modules.length > 0)
                ? d.modules
                : (d.worlds || []).flatMap((w) => (w.series || []).flatMap((s) => s.modules || []));

            for (const m of modules) {
                totalModules++;
                for (const u of (m.units || [])) {
                    totalUnits++;
                    for (const l of (u.lessons || [])) {
                        totalLessons++;
                        const st = (l.status || '').toUpperCase();
                        if (st === 'PUBLISHED') publishedCount++;
                        else if (st === 'IN_REVIEW' || st === 'REVIEW') inReviewCount++;
                        else draftCount++;
                    }
                }
            }
        }

        return {
            totalModules,
            totalUnits,
            totalLessons,
            publishedCount,
            draftCount,
            inReviewCount,
        };
    }, [tree]);

    const persistActiveContext = (lessonId, blockIdx = null) => {
        if (typeof window === 'undefined' || !lessonId) return;
        try {
            localStorage.setItem('lcms_active_lesson_id', lessonId);
            sessionStorage.setItem('lcms_active_lesson_id', lessonId);
            if (blockIdx !== null && blockIdx !== undefined) {
                localStorage.setItem(`lcms_active_block_${lessonId}`, String(blockIdx));
            }
            const url = new URL(window.location.href);
            url.searchParams.set('lessonId', lessonId);
            if (blockIdx !== null && blockIdx !== undefined && blockIdx > 0) {
                url.searchParams.set('block', String(blockIdx));
            } else if (blockIdx === 0) {
                url.searchParams.delete('block');
            }
            window.history.replaceState(null, '', url.toString());
        } catch (e) {
            console.warn('Failed to persist active context:', e);
        }
    };

    const fetchCurriculumTree = useCallback(async (targetLessonId = null) => {
        try {
            setIsLoadingTree(true);
            const data = await apiClient('/api/v1/curriculum/admin/tree');
            if (data) {
                const rawTree = Array.isArray(data) ? data : (data?.tree || []);
                setTree(rawTree);

                // Flatten units with lessons from 4-level hierarchy for selection lookups
                const allUnitsWithLessons = [];
                for (const d of rawTree) {
                    const modules = (d.modules && d.modules.length > 0)
                        ? d.modules
                        : (d.worlds || []).flatMap((w) => (w.series || []).flatMap((s) => s.modules || []));

                    for (const m of modules) {
                        for (const u of (m.units || [])) {
                            allUnitsWithLessons.push({ module: m, unit: u, lessons: u.lessons || [] });
                        }
                    }
                }

                // If a target lesson was specified explicitly, select it and load its draft
                if (targetLessonId) {
                    for (const item of allUnitsWithLessons) {
                        const l = item.lessons.find((les) => les.id === targetLessonId || les.version_id === targetLessonId);
                        if (l) {
                            setSelectedModule(item.module);
                            setSelectedUnit(item.unit);
                            setSelectedLesson(l);
                            persistActiveContext(l.id, 0);
                            loadLessonDraft(l, 0);
                            return;
                        }
                    }
                }

                // If a lesson is ALREADY selected and loaded, do NOT reload it or clobber in-memory draft!
                if (selectedLessonRef.current?.id) {
                    return;
                }

                // Otherwise, check URL query param -> localStorage -> sessionStorage for previously active lesson
                const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                const urlLessonId = searchParams?.get('lessonId');
                const urlBlock = searchParams?.get('block');
                const urlBlockIdx = urlBlock !== null ? parseInt(urlBlock, 10) : null;
                const storedLessonId = typeof window !== 'undefined'
                    ? (urlLessonId || localStorage.getItem('lcms_active_lesson_id') || sessionStorage.getItem('lcms_active_lesson_id'))
                    : null;

                if (storedLessonId) {
                    for (const item of allUnitsWithLessons) {
                        const l = item.lessons.find((les) => les.id === storedLessonId || les.version_id === storedLessonId || les.slug === storedLessonId);
                        if (l) {
                            setSelectedModule(item.module);
                            setSelectedUnit(item.unit);
                            setSelectedLesson(l);
                            persistActiveContext(l.id, urlBlockIdx);
                            loadLessonDraft(l, urlBlockIdx);
                            return;
                        }
                    }
                }

                // Auto-select first lesson if none selected
                for (const item of allUnitsWithLessons) {
                    if (item.lessons.length > 0) {
                        const firstLesson = item.lessons[0];
                        setSelectedModule(item.module);
                        setSelectedUnit(item.unit);
                        setSelectedLesson(firstLesson);
                        persistActiveContext(firstLesson.id, 0);
                        loadLessonDraft(firstLesson, 0);
                        return;
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
    }, []); // Empty deps: break reload loop on selectedLesson changes
    useEffect(() => {
        fetchCurriculumTree();
    }, [fetchCurriculumTree]);
    // ── 2. Load Selected Lesson Draft ──────────────────────────────────────────
    const loadLessonDraft = async (lesson, targetBlockIdx = null) => {
        try {
            if (lesson.id) {
                persistActiveContext(lesson.id, targetBlockIdx);
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
                    let sortedBlocks = [];
                    if (rawBlocks.length > 0) {
                        sortedBlocks = [...rawBlocks].sort(
                            (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
                        );
                    }

                    // Check local crash-proof backup for this version (e.g. if page refreshed before save)
                    const backupKey = `lcms_draft_backup_${data.version_id || lesson.version_id}`;
                    let hasRestoredBackup = false;
                    if (typeof window !== 'undefined') {
                        try {
                            const rawBackup = localStorage.getItem(backupKey);
                            if (rawBackup) {
                                const backup = JSON.parse(rawBackup);
                                if (backup) {
                                    if (Array.isArray(backup.blocks) && backup.blocks.length > 0) {
                                        sortedBlocks = backup.blocks;
                                        hasRestoredBackup = true;
                                    }
                                    if (backup.lessonTitle) setLessonTitle(backup.lessonTitle);
                                    if (backup.durationMinutes) setDurationMinutes(backup.durationMinutes);
                                    if (backup.level) setLevel(backup.level);
                                    if (backup.learningObjectives) setLearningObjectives(backup.learningObjectives);
                                    if (hasRestoredBackup) {
                                        hasPendingChangesRef.current = true;
                                        setHasUnsavedChanges(true);
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse local draft backup:', e);
                        }
                    }

                    if (sortedBlocks.length > 0) {
                        setBlocks(sortedBlocks);
                    }
                    else {
                        // Provide sensible defaults for empty lessons (clean empty text)
                        setBlocks([
                            {
                                id: `block_${Date.now()}`,
                                order_index: 0,
                                content_type: 'HEADING',
                                activity_type: 'OBSERVE',
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
                                activity_type: 'OBSERVE',
                                response_type: 'NONE',
                                title: 'Core Principles',
                                content: { text: '' },
                                evidence_role: 'NONE',
                                difficulty: 1,
                            },
                        ]);
                    }

                    // Restore block index safely from targetBlockIdx or URL/localStorage
                    let resolvedBlockIdx = 0;
                    if (targetBlockIdx !== null && targetBlockIdx !== undefined) {
                        resolvedBlockIdx = targetBlockIdx;
                    } else if (typeof window !== 'undefined') {
                        const urlBlock = new URLSearchParams(window.location.search).get('block');
                        const localBlock = localStorage.getItem(`lcms_active_block_${lesson.id}`);
                        const parsed = parseInt(urlBlock !== null ? urlBlock : (localBlock || '0'), 10);
                        if (!isNaN(parsed)) resolvedBlockIdx = parsed;
                    }
                    const totalBlocks = sortedBlocks.length > 0 ? sortedBlocks.length : 2;
                    const safeBlockIdx = Math.max(0, Math.min(resolvedBlockIdx, totalBlocks - 1));
                    setActiveBlockIndex(safeBlockIdx);
                    persistActiveContext(lesson.id, safeBlockIdx);

                    if (!hasRestoredBackup) {
                        hasPendingChangesRef.current = false;
                        setHasUnsavedChanges(false);
                    }
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
                    activity_type: 'OBSERVE',
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
                    activity_type: 'OBSERVE',
                    response_type: 'NONE',
                    title: 'Core Principles',
                    content: { text: '' },
                    evidence_role: 'NONE',
                    difficulty: 1,
                },
            ]);
            hasPendingChangesRef.current = false;
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
        const stateToSave = latestStateRef.current;
        if (!stateToSave.currentVersionId || isSavingRef.current)
            return false;
        try {
            isSavingRef.current = true;
            setIsSaving(true);
            const payload = {
                title: stateToSave.lessonTitle,
                slug: stateToSave.lessonSlug,
                duration_minutes: stateToSave.durationMinutes,
                learning_objectives: stateToSave.learningObjectives,
                blocks_json: stateToSave.blocks,
                blocks: stateToSave.blocks,
            };
            const data = await apiClient(`/api/v1/admin/lessons/draft/${stateToSave.currentVersionId}`, {
                method: 'PATCH',
                headers: {
                    'If-Match': `"${stateToSave.versionNumber}"`,
                },
                body: JSON.stringify(payload),
            });
            if (data) {
                setVersionNumber(data.version_number);
                latestStateRef.current.versionNumber = data.version_number;
                // Clear local backup once saved to backend
                if (typeof window !== 'undefined' && stateToSave.currentVersionId) {
                    try {
                        localStorage.removeItem(`lcms_draft_backup_${stateToSave.currentVersionId}`);
                    } catch (e) {}
                }
                hasPendingChangesRef.current = false;
                setHasUnsavedChanges(false);
                setLastSavedTime(new Date());
                setOccConflict(null);
                return true;
            }
        }
        catch (err) {
            // Auto-recovery: if OCC mismatch, retry without If-Match to auto-sync with server
            if (err?.status === 409 || err?.message?.includes('OCC')) {
                try {
                    const retryData = await apiClient(`/api/v1/admin/lessons/draft/${stateToSave.currentVersionId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            title: stateToSave.lessonTitle,
                            slug: stateToSave.lessonSlug,
                            duration_minutes: stateToSave.durationMinutes,
                            learning_objectives: stateToSave.learningObjectives,
                            blocks_json: stateToSave.blocks,
                            blocks: stateToSave.blocks,
                        }),
                    });
                    if (retryData) {
                        setVersionNumber(retryData.version_number);
                        latestStateRef.current.versionNumber = retryData.version_number;
                        if (typeof window !== 'undefined' && stateToSave.currentVersionId) {
                            try {
                                localStorage.removeItem(`lcms_draft_backup_${stateToSave.currentVersionId}`);
                            } catch (e) {}
                        }
                        hasPendingChangesRef.current = false;
                        setHasUnsavedChanges(false);
                        setLastSavedTime(new Date());
                        setOccConflict(null);
                        return true;
                    }
                } catch (retryErr) {
                    console.error('Auto-recovery save failed:', retryErr);
                }
            }
            console.error('Failed to save draft:', err);
            return false;
        }
        finally {
            isSavingRef.current = false;
            setIsSaving(false);
        }
    };

    // ── 4b. Debounced Autosave (600ms idle with OCC If-Match) ─────────────────
    useEffect(() => {
        if (!hasUnsavedChanges || !currentVersionId || isSaving || occConflict) {
            return;
        }
        const timer = setTimeout(() => {
            handleSaveDraft();
        }, 600);
        return () => clearTimeout(timer);
    }, [hasUnsavedChanges, currentVersionId, isSaving, occConflict, lessonTitle, durationMinutes, learningObjectives, blocks, versionNumber]);

    // ── 4c. BeforeUnload Listener (Flush & Crash-Proof Local Storage Safeguard) ─
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                const state = latestStateRef.current;
                if (state?.currentVersionId && typeof window !== 'undefined') {
                    try {
                        localStorage.setItem(`lcms_draft_backup_${state.currentVersionId}`, JSON.stringify({
                            blocks: state.blocks,
                            lessonTitle: state.lessonTitle,
                            lessonSlug: state.lessonSlug,
                            durationMinutes: state.durationMinutes,
                            level: state.level,
                            learningObjectives: state.learningObjectives,
                            savedAt: Date.now(),
                        }));
                    } catch (err) {}
                }
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // ── 4d. Active Block Context & Keystroke-Level Backup Persistence ─────────
    useEffect(() => {
        if (selectedLesson?.id && activeBlockIndex !== undefined && activeBlockIndex !== null) {
            persistActiveContext(selectedLesson.id, activeBlockIndex);
        }
    }, [selectedLesson?.id, activeBlockIndex]);

    useEffect(() => {
        if (hasUnsavedChanges && currentVersionId && typeof window !== 'undefined') {
            try {
                localStorage.setItem(`lcms_draft_backup_${currentVersionId}`, JSON.stringify({
                    blocks,
                    lessonTitle,
                    lessonSlug,
                    durationMinutes,
                    level,
                    learningObjectives,
                    savedAt: Date.now(),
                }));
            } catch (err) {}
        }
    }, [hasUnsavedChanges, currentVersionId, blocks, lessonTitle, lessonSlug, durationMinutes, level, learningObjectives]);

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
                            content: { text: '' },
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
                persistActiveContext(newLesson.id, 0);
                loadLessonDraft(newLesson, 0);
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
            if (typeof window !== 'undefined') {
                localStorage.removeItem('lcms_active_lesson_id');
                sessionStorage.removeItem('lcms_active_lesson_id');
                const url = new URL(window.location.href);
                url.searchParams.delete('lessonId');
                url.searchParams.delete('block');
                window.history.replaceState(null, '', url.toString());
            }
        }
        await fetchCurriculumTree();
    };
    // ── 6. Governance Actions (Submit, Review, Direct Approve, Publish) ───────
    const handleSubmitForReview = async () => {
        if (!currentVersionId) return;
        try {
            await handleSaveDraft();
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
            alert(`Review Submission: ${err?.message || 'Please ensure lesson has valid title and objectives.'}`);
        }
    };

    const handleDirectApprove = async () => {
        if (!currentVersionId) {
            alert('No active lesson version selected.');
            return;
        }
        try {
            await handleSaveDraft();
            const data = await apiClient(`/api/v1/admin/lessons/${currentVersionId}/review`, {
                method: 'POST',
                body: JSON.stringify({
                    review_role: userRole || 'SUPER_ADMIN',
                    status: 'APPROVED',
                    notes: 'Directly approved by administrator.',
                }),
            });
            if (data?.version_status) {
                setStatus(data.version_status);
            } else {
                setStatus('APPROVED');
            }
            await fetchCurriculumTree();
        } catch (err) {
            console.error('Failed to approve lesson:', err);
            alert(`Direct Approval Error: ${err?.message || 'Could not approve lesson.'}`);
        }
    };

    const handleApproveReview = async (notes) => {
        if (!currentVersionId)
            return;
        try {
            await handleSaveDraft();
            const data = await apiClient(`/api/v1/admin/lessons/${currentVersionId}/review`, {
                method: 'POST',
                body: JSON.stringify({
                    review_role: userRole || 'SUPER_ADMIN',
                    status: 'APPROVED',
                    notes: notes || 'Approved by administrator.',
                }),
            });
            if (data?.version_status)
                setStatus(data.version_status);
            else
                setStatus('APPROVED');
            await fetchCurriculumTree();
        }
        catch (err) {
            console.error('Failed to approve review:', err);
            alert(`Approval Error: ${err?.message || 'Could not approve review.'}`);
        }
    };

    const handlePublish = async () => {
        if (!selectedLesson?.id || !currentVersionId) {
            alert('No active lesson version selected to publish.');
            return;
        }
        try {
            await handleSaveDraft();
            // In production, ensure status is APPROVED first
            if (status !== 'APPROVED') {
                await apiClient(`/api/v1/admin/lessons/${currentVersionId}/review`, {
                    method: 'POST',
                    body: JSON.stringify({
                        review_role: userRole || 'SUPER_ADMIN',
                        status: 'APPROVED',
                        notes: 'Auto-approved for atomic release by administrator.',
                    }),
                });
                setStatus('APPROVED');
            }
            await apiClient(`/api/v1/lessons/${selectedLesson.id}/publish`, {
                method: 'POST',
                body: JSON.stringify({
                    version_id: currentVersionId,
                    notes: 'Approved publication to PostgreSQL database.',
                }),
            });
            setStatus('PUBLISHED');
            await fetchCurriculumTree();
            alert('Lesson published successfully to production database!');
        }
        catch (err) {
            console.error('Failed to publish lesson:', err);
            alert(`Publish Error: ${err?.message || 'Failed to publish lesson.'}`);
        }
    };
    // Block mutation helpers
    // Block mutation helpers (functional setters protect against closure staleness)
    const handleUpdateBlock = useCallback((idx, updated) => {
        setBlocks((prevBlocks) => {
            const nextBlocks = [...prevBlocks];
            const current = prevBlocks[idx];
            const resolved = typeof updated === 'function' ? updated(current) : updated;
            nextBlocks[idx] = resolved;

            const vId = latestStateRef.current?.currentVersionId;
            if (vId && typeof window !== 'undefined') {
                try {
                    localStorage.setItem(`lcms_draft_backup_${vId}`, JSON.stringify({
                        blocks: nextBlocks,
                        savedAt: Date.now(),
                    }));
                } catch (e) {}
            }

            return nextBlocks;
        });
        hasPendingChangesRef.current = true;
        setHasUnsavedChanges(true);
    }, []);

    const handleMoveBlock = useCallback((idx, direction) => {
        const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
        setBlocks((prevBlocks) => {
            if (targetIdx < 0 || targetIdx >= prevBlocks.length)
                return prevBlocks;
            const nextBlocks = [...prevBlocks];
            const temp = nextBlocks[idx];
            nextBlocks[idx] = nextBlocks[targetIdx];
            nextBlocks[targetIdx] = temp;
            nextBlocks.forEach((b, i) => {
                b.order_index = i;
            });
            return nextBlocks;
        });
        setActiveBlockIndex(targetIdx);
        hasPendingChangesRef.current = true;
        setHasUnsavedChanges(true);
    }, []);

    const handleDuplicateBlock = useCallback((idx) => {
        setBlocks((prevBlocks) => {
            const source = prevBlocks[idx];
            if (!source) return prevBlocks;

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

            const nextBlocks = [...prevBlocks];
            nextBlocks.splice(idx + 1, 0, duplicate);
            nextBlocks.forEach((b, i) => {
                b.order_index = i;
            });
            return nextBlocks;
        });
        setActiveBlockIndex(idx + 1);
        hasPendingChangesRef.current = true;
        setHasUnsavedChanges(true);
    }, []);

    const handleDeleteBlock = useCallback((idx) => {
        setBlocks((prevBlocks) => {
            if (prevBlocks.length <= 1)
                return prevBlocks;
            const nextBlocks = prevBlocks.filter((_, i) => i !== idx);
            nextBlocks.forEach((b, i) => {
                b.order_index = i;
            });
            return nextBlocks;
        });
        setActiveBlockIndex((prev) => Math.max(0, idx - 1));
        hasPendingChangesRef.current = true;
        setHasUnsavedChanges(true);
    }, []);

    const handleAddBlock = useCallback((blockInput, insertAt = null) => {
        setBlocks((prevBlocks) => {
            const currentCount = prevBlocks.length;
            let newBlock;
            if (typeof blockInput === 'string') {
                try {
                    newBlock = createBlock(blockInput, currentCount);
                } catch {
                    newBlock = createBlock('TEXT', currentCount);
                }
            } else if (typeof blockInput === 'object' && blockInput !== null) {
                const cType = blockInput.content_type || blockInput.type || 'TEXT';
                try {
                    newBlock = createBlock(cType, currentCount, blockInput);
                } catch {
                    const optA = generateUUID();
                    const optB = generateUUID();
                    const isInteractive = (blockInput.response_type && blockInput.response_type !== 'NONE');
                    newBlock = {
                        id: generateUUID(),
                        order_index: currentCount,
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
            if (!newBlock) return prevBlocks;

            if (insertAt !== null && insertAt >= 0 && insertAt <= prevBlocks.length) {
                const nextBlocks = [
                    ...prevBlocks.slice(0, insertAt),
                    { ...newBlock, order_index: insertAt },
                    ...prevBlocks.slice(insertAt),
                ];
                nextBlocks.forEach((b, i) => { b.order_index = i; });
                setActiveBlockIndex(insertAt);
                return nextBlocks;
            } else {
                newBlock.order_index = prevBlocks.length;
                setActiveBlockIndex(prevBlocks.length);
                return [...prevBlocks, newBlock];
            }
        });
        hasPendingChangesRef.current = true;
        setHasUnsavedChanges(true);
    }, []);

    const handleReorderBlocks = useCallback((reorderedBlocks) => {
        setBlocks(reorderedBlocks);
        hasPendingChangesRef.current = true;
        setHasUnsavedChanges(true);
    }, []);
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
          <LiveIsolatedPreview
            lessonTitle={lessonTitle}
            blocks={blocks}
            activeStepIndex={activeBlockIndex}
            onStepChange={(idx) => {
              setActiveBlockIndex(idx);
              if (selectedLesson?.id) {
                persistActiveContext(selectedLesson.id, idx);
              }
            }}
            onClosePreview={() => setMode('EDIT')}
          />
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
            }}/>) : surfaceTab === 'HEALTH' ? (
              <ContentHealthDashboard {...healthStats} />
            ) : (
        /* ── Surface: 3-Column Content Studio (Navigator · Canvas · Inspector) ── */
        <div className="flex flex-1 overflow-hidden">
          {/* Column 1: Curriculum Navigator (Left 280px) */}
          <div className="w-72 shrink-0 h-full">
            <CurriculumNavigator tree={tree} selectedLessonId={selectedLesson?.id} hasUnsavedChanges={hasUnsavedChanges} onSelectLesson={(lesson, unit, mod) => {
                setSelectedLesson(lesson);
                setSelectedUnit(unit);
                setSelectedModule(mod);
                persistActiveContext(lesson?.id, 0);
                loadLessonDraft(lesson, 0);
            }} onCreateModule={handleCreateModule} onCreateUnit={handleCreateUnit} onCreateLesson={handleCreateLesson} onPromptUnsavedChanges={(targetAction) => {
                setPendingNavigationAction(() => targetAction);
            }} onEditModule={() => fetchCurriculumTree()} onDeleteModule={(modId) => {
                if (selectedModule?.id === modId) {
                    setSelectedModule(null);
                    setSelectedUnit(null);
                    setSelectedLesson(null);
                    setBlocks([]);
                    setHasUnsavedChanges(false);
                }
                fetchCurriculumTree();
            }} onEditUnit={() => fetchCurriculumTree()} onDeleteUnit={(unitId) => {
                if (selectedUnit?.id === unitId) {
                    setSelectedUnit(null);
                    setSelectedLesson(null);
                    setBlocks([]);
                    setHasUnsavedChanges(false);
                }
                fetchCurriculumTree();
            }} onDeleteLesson={handleDeleteLesson} onRefreshTree={fetchCurriculumTree}/>
          </div>

          {/* Column 2: Pedagogical Canvas (Center Flex) */}
          {selectedLesson ? (
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
            }} onSelectBlock={(idx) => {
                setActiveBlockIndex(idx);
                if (selectedLesson?.id) {
                    persistActiveContext(selectedLesson.id, idx);
                }
            }} onUpdateBlock={handleUpdateBlock} onMoveBlock={handleMoveBlock} onDuplicateBlock={handleDuplicateBlock} onDeleteBlock={handleDeleteBlock} onAddBlock={handleAddBlock} onReorderBlocks={handleReorderBlocks} onPreviewStep={(idx) => {
                setActiveBlockIndex(idx);
                if (selectedLesson?.id) {
                    persistActiveContext(selectedLesson.id, idx);
                }
                setMode('PREVIEW');
            }}/>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50 border-r border-slate-200">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 shadow-sm">
                <BookOpen className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-base font-bold text-slate-800 mb-1">
                {tree.length === 0 ? 'No Curriculum Created Yet' : 'Select or Create a Lesson'}
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
                {tree.length === 0
                  ? 'Start by creating your first Domain in the left sidebar. You can organize your curriculum into Worlds, Series, Modules, Units, and Lessons.'
                  : 'Choose a lesson from the curriculum navigator on the left to edit its blocks, pedagogy, and governance, or create a new lesson under a unit.'}
              </p>
            </div>
          )}

          {/* Column 3: Properties, Quality & Sources Inspector (Right 340px) */}
          {selectedLesson ? (
            <InspectorAndQualityPanel
              selectedBlock={blocks[activeBlockIndex]}
              selectedBlockIndex={activeBlockIndex}
              qualityResult={qualityResult}
              onUpdateSelectedBlock={(updated) => handleUpdateBlock(activeBlockIndex, updated)}
              onJumpToBlock={(idx) => {
                setActiveBlockIndex(idx);
                if (selectedLesson?.id) {
                  persistActiveContext(selectedLesson.id, idx);
                }
              }}
              onApplyQuickFix={handleApplyQuickFix}
            />
          ) : (
            <div className="w-80 shrink-0 h-full bg-white border-l border-slate-200 flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <Sparkles className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Pedagogical Inspector</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                Quality metrics, block properties, and citations will appear here once a lesson is selected.
              </p>
            </div>
          )}
        </div>)}

      {/* ── Bottom Governance Action Ribbon (Studio Edit Mode Only) ── */}
      {mode === 'EDIT' && surfaceTab === 'STUDIO' && (
        <GovernanceBar
          status={status}
          versionNumber={versionNumber}
          userRole={userRole}
          isPublishable={qualityResult.isPublishable}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          lastSavedText={lastSavedText}
          occConflict={occConflict}
          onSaveDraft={handleSaveDraft}
          onValidate={() => setShowValidationModal(true)}
          onOpenPreview={async () => {
            if (hasUnsavedChanges) {
              await handleSaveDraft();
            }
            setMode('PREVIEW');
          }}
          onSubmitForReview={handleSubmitForReview}
          onDirectApprove={handleDirectApprove}
          onApproveReview={handleApproveReview}
          onRequestChanges={(notes) => handleApproveReview(`CHANGES_REQUESTED: ${notes}`)}
          onPublish={handlePublish}
          onResolveOccConflict={(res) => {
            if (res === 'RELOAD' && selectedLesson) {
              loadLessonDraft(selectedLesson);
            } else {
              setOccConflict(null);
            }
          }}
        />
      )}

      {/* ── Pedagogical Validation Checklist Modal ── */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Pedagogical Validation Report</h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                qualityResult.blockers.length === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                Score: {qualityResult.score}/100
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Blockers */}
              <div>
                <div className="font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${qualityResult.blockers.length > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  Critical Blockers ({qualityResult.blockers.length})
                </div>
                {qualityResult.blockers.length === 0 ? (
                  <p className="text-emerald-700 font-semibold bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All structural checks passed! This lesson is ready for approval and publishing.</span>
                  </p>
                ) : (
                  <div className="space-y-2">
                    {qualityResult.blockers.map((b, i) => (
                      <div key={i} className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-rose-800">
                          <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{b.title}</span>
                        </div>
                        <p className="text-rose-700/90 leading-relaxed pl-5">{b.message}</p>
                        {b.reason && <p className="text-[10px] text-rose-500 italic pl-5">Why this matters: {b.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warnings */}
              {qualityResult.warnings.length > 0 && (
                <div>
                  <div className="font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Pacing & Pedagogical Warnings ({qualityResult.warnings.length})
                  </div>
                  <div className="space-y-2">
                    {qualityResult.warnings.map((w, i) => (
                      <div key={i} className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-900 space-y-0.5">
                        <div className="font-bold">{w.title}</div>
                        <p className="text-amber-800/90">{w.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {qualityResult.suggestions.length > 0 && (
                <div>
                  <div className="font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Pedagogical Enhancements ({qualityResult.suggestions.length})
                  </div>
                  <div className="space-y-1.5">
                    {qualityResult.suggestions.map((s, i) => (
                      <div key={i} className="p-2 bg-blue-50/50 border border-blue-100 rounded-lg text-blue-900">
                        {s.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

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
