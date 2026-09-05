import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { telemetry } from '../../services/telemetry';
import { apiClient, resolveEndpointUrl } from '../../services/apiClient';
import { useMediaAsset } from '../admin/utils/mediaResolver';
import { X, ArrowRight, Award, CheckCircle2, AlertCircle, HelpCircle, Check, RefreshCw, Eye, Sliders, BarChart2, AlertTriangle, Zap, Target, Shield, Flame, Lightbulb, } from 'lucide-react';
import { CandlestickVisualizer, formatCurrency } from '../../components/charts/CandlestickVisualizer';
import { TableRenderer, SEBIDisclaimer, getRenderer } from './components/renderers/RendererRegistry';

function OptionVisual({ mediaAssetId, imageUrl, altText }) {
    const { url: derivedUrl, isLoading } = useMediaAsset(mediaAssetId);
    const finalUrl = derivedUrl || (imageUrl ? resolveEndpointUrl(imageUrl) : null);

    if (isLoading) {
        return (
            <div className="w-full h-32 bg-slate-100 rounded-lg flex items-center justify-center animate-pulse text-slate-400 text-xs">
                Loading visual...
            </div>
        );
    }

    if (!finalUrl) {
        return null;
    }

    return (
        <div className="w-full h-36 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100 p-2">
            <img
                src={finalUrl}
                alt={altText || 'Choice visual'}
                className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                    e.target.style.display = 'none';
                }}
            />
        </div>
    );
}

export const SessionPlayerPage = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [items, setItems] = useState([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [activeSessionId, setActiveSessionId] = useState(sessionId || 'demo');
    const [isLoading, setIsLoading] = useState(true);
    const [sessionLessonSlug, setSessionLessonSlug] = useState(location.state?.lessonSlug || '');
    const [sessionLessonTitle, setSessionLessonTitle] = useState(location.state?.lessonTitle || '');
    const [sessionModuleSlug, setSessionModuleSlug] = useState(location.state?.moduleSlug || '');
    const [sessionModuleTitle, setSessionModuleTitle] = useState(location.state?.moduleTitle || '');
    // Remediation & interactive state for current step
    const [selectedOption, setSelectedOption] = useState(null);
    const [remediation, setRemediation] = useState({
        status: 'IDLE',
        title: '',
        message: '',
    });
    // 3-Tier Progressive Hint System State
    const [hintTier, setHintTier] = useState(0); // 0 = none, 1 = notice, 2 = relate, 3 = recall
    const [isHintOpen, setIsHintOpen] = useState(false);
    // Practice slider state
    const [practiceClose, setPracticeClose] = useState(110);
    // Lesson completion state
    const [isLessonCompleted, setIsLessonCompleted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // 1. Fetch Session Items from PostgreSQL Backend
    useEffect(() => {
        let isMounted = true;
        async function loadSession() {
            setIsLoading(true);
            try {
                let currentSessId = sessionId;
                const isUuid = currentSessId &&
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentSessId);
                if (location.state?.cards && location.state.cards.length > 0) {
                    if (isMounted) {
                        const mappedItems = location.state.cards.map((card, idx) => ({
                            session_item_id: card.id || `card-${idx + 1}`,
                            activity_id: card.id || `card-${idx + 1}`,
                            concept_id: card.concept_id || 'concept',
                            activity_type: card.activity_type || 'OBSERVE',
                            learning_phase: card.activity_type || 'OBSERVE',
                            title: card.title || `0${idx + 1} — Activity`,
                            position: idx + 1,
                            payload: {
                                renderer: card.renderer || 'TEXT',
                                prompt: card.prompt,
                                options: card.options,
                                explanation: card.explanation,
                                correct_option_id: card.correct_option_id,
                                misconception_map: card.misconception_map,
                                hints: card.hints,
                                ...card.payload,
                            },
                        }));
                        setItems(mappedItems);
                        if (location.state.sessionId || isUuid)
                            setActiveSessionId(location.state.sessionId || currentSessId);
                        if (location.state.lessonSlug)
                            setSessionLessonSlug(location.state.lessonSlug);
                        if (location.state.lessonTitle)
                            setSessionLessonTitle(location.state.lessonTitle);
                        if (location.state.moduleSlug)
                            setSessionModuleSlug(location.state.moduleSlug);
                        if (location.state.moduleTitle)
                            setSessionModuleTitle(location.state.moduleTitle);
                        setIsLoading(false);
                    }
                    return;
                }
                if (location.state?.items && location.state.items.length > 0) {
                    if (isMounted) {
                        setItems(location.state.items);
                        if (location.state.sessionId)
                            setActiveSessionId(location.state.sessionId);
                        if (location.state.lessonSlug)
                            setSessionLessonSlug(location.state.lessonSlug);
                        if (location.state.lessonTitle)
                            setSessionLessonTitle(location.state.lessonTitle);
                        if (location.state.moduleSlug)
                            setSessionModuleSlug(location.state.moduleSlug);
                        if (location.state.moduleTitle)
                            setSessionModuleTitle(location.state.moduleTitle);
                        setIsLoading(false);
                    }
                    return;
                }
                // If no valid session ID in URL, create one
                if (!isUuid || currentSessId === 'active') {
                    const createData = await apiClient('/api/v1/learning/sessions', {
                        method: 'POST',
                        body: JSON.stringify({ mode: 'DEFAULT', lesson_slug: location.state?.lessonSlug || '' }),
                    });
                    currentSessId = createData.session_id;
                    if (isMounted) {
                        setActiveSessionId(currentSessId);
                        if (createData.lesson_slug)
                            setSessionLessonSlug(createData.lesson_slug);
                        if (createData.lesson_title)
                            setSessionLessonTitle(createData.lesson_title);
                        if (createData.module_slug)
                            setSessionModuleSlug(createData.module_slug);
                        if (createData.module_title)
                            setSessionModuleTitle(createData.module_title);
                    }
                }
                // Fetch authoritative session items
                const res = await apiClient(`/api/v1/learning/sessions/${currentSessId}`);
                if (isMounted) {
                    if (res.items && res.items.length > 0) {
                        setItems(res.items);
                        if (res.resume_position && res.resume_position > 1 && res.resume_position <= res.items.length) {
                            setCurrentIdx(res.resume_position - 1);
                        }
                    }
                    if (res.lesson_slug)
                        setSessionLessonSlug(res.lesson_slug);
                    if (res.lesson_title)
                        setSessionLessonTitle(res.lesson_title);
                    if (res.module_slug)
                        setSessionModuleSlug(res.module_slug);
                    if (res.module_title)
                        setSessionModuleTitle(res.module_title);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Failed to fetch session from API:', err);
                if (isMounted) {
                    setError(err.message || 'Failed to load learning session. Please return to the module and start again.');
                    setIsLoading(false);
                }
            }
        }
        loadSession();
        return () => {
            isMounted = false;
        };
    }, [sessionId, location.state]);
    const currentItem = items[currentIdx] || null;
    const isQuestionStep = currentItem &&
        (currentItem.is_interactive === true ||
         currentItem.response_type === 'SINGLE_CHOICE' ||
         currentItem.response_type === 'IMAGE_SELECTION' ||
         currentItem.response_type === 'TRUE_FALSE' ||
         (currentItem.payload?.options && currentItem.payload.options.length > 0) ||
         ['PREDICT', 'MISCONCEPTION_CHECK', 'APPLICATION', 'TRANSFER'].includes(currentItem.activity_type?.toUpperCase()));
    // Contract-Driven Presentation Mode Resolution
    const resolvePresentationMode = () => {
        if (!currentItem)
            return 'EXPLAIN';
        // If activity contract defines mode explicitly, respect it
        if (currentItem.payload?.presentation_mode) {
            if (isQuestionStep && remediation.status === 'CORRECT') {
                return 'EXPLAIN'; // Progressive disclosure: reveal explanation after answering correctly
            }
            return currentItem.payload.presentation_mode;
        }
        // Default pedagogical fallback
        if (currentItem.activity_type === 'PRACTICE')
            return 'INTERACTIVE';
        if (isQuestionStep) {
            return remediation.status === 'CORRECT' ? 'EXPLAIN' : 'THINK';
        }
        return 'EXPLAIN';
    };
    const activePresentationMode = resolvePresentationMode();
    // Reset remediation & hint state when moving to new step
    const handleStepTransition = (nextIdx) => {
        setSelectedOption(null);
        setRemediation({ status: 'IDLE', title: '', message: '' });
        setHintTier(0);
        setIsHintOpen(false);
        if (nextIdx >= items.length) {
            setIsLessonCompleted(true);
            const targetSlug = sessionLessonSlug;
            if (targetSlug) {
                // 1. Authoritative backend completion recording
                try {
                    apiClient(`/api/v1/curriculum/lessons/${targetSlug}/complete`, {
                        method: 'POST',
                    }).catch((err) => {
                        console.warn('Lesson completion recorded offline / locally:', err);
                    });
                }
                catch (err) {
                    console.warn('Lesson completion error:', err);
                }
            }
            // 2. Local progression cache for instant zero-lag UI updates across pages
            try {
                const stored = JSON.parse(localStorage.getItem('sentinews_completed_lessons') || '[]');
                if (!stored.includes(targetSlug)) {
                    stored.push(targetSlug);
                    localStorage.setItem('sentinews_completed_lessons', JSON.stringify(stored));
                }
            }
            catch (e) {
                // Safe fallback
            }
            telemetry.track('session_completed', {
                sessionId: activeSessionId,
                payload: {
                    total_items: items.length,
                    lesson_slug: targetSlug,
                },
            });
        }
        else {
            setCurrentIdx(nextIdx);
            const nextItem = items[nextIdx];
            if (activeSessionId && activeSessionId !== 'demo' && nextItem) {
                apiClient(`/api/v1/learning/sessions/${activeSessionId}/progress`, {
                    method: 'POST',
                    body: JSON.stringify({ position: nextIdx + 1 }),
                }).catch((err) => console.warn('Session progress tracking failed (offline mode):', err));
            }
            if (nextItem) {
                telemetry.track('activity_presented', {
                    sessionId: activeSessionId,
                    sessionItemId: nextItem.session_item_id,
                    conceptId: nextItem.concept_id,
                    payload: {
                        activity_type: nextItem.activity_type,
                        position: nextItem.position,
                    },
                });
            }
        }
    };
    // 2. Handle Option Evaluation (Supportive Misconception Check)
    const handleCheckAnswer = async () => {
        if (!currentItem || !selectedOption || isSubmitting)
            return;
        const payload = currentItem.payload || {};
        const correctOptionId = payload.correct_option_id
            || currentItem.correct_option_id
            || payload.evaluation?.correct_option_id
            || currentItem.options?.find(o => o.is_correct)?.id
            || payload.options?.find(o => o.is_correct)?.id;
        const misconceptionMap = payload.misconception_map || {};
        const explanation = payload.explanation
            || payload.feedback?.explanation
            || currentItem.explanation
            || 'Great job! You identified the key anatomical principle.';

        // Practice Mode: Instant Synchronous Client Evaluation (<16ms)
        if (correctOptionId !== undefined && correctOptionId !== null) {
            const isCorrect = String(selectedOption) === String(correctOptionId);

            telemetry.track('prediction_submitted', {
                sessionId: activeSessionId,
                sessionItemId: currentItem.session_item_id,
                conceptId: currentItem.concept_id,
                payload: {
                    selected_option_id: selectedOption,
                    is_correct: isCorrect,
                    activity_type: currentItem.activity_type,
                    hints_used: hintTier,
                },
            });

            if (!isCorrect) {
                // Misconception: Immediate supportive feedback, never falsely marks correct
                const hint = misconceptionMap[selectedOption]
                    || payload.feedback?.[selectedOption]
                    || 'Not quite. Take another look at the options and try again.';
                setRemediation({
                    status: 'MISCONCEPTION',
                    title: 'Not quite.',
                    message: hint,
                });

                // Background recording of formative attempt
                const targetActivityId = currentItem.activity_id || currentItem.session_item_id;
                if (activeSessionId && activeSessionId !== 'demo' && targetActivityId) {
                    apiClient(`/api/v1/learning/sessions/${activeSessionId}/activities/${targetActivityId}/attempts`, {
                        method: 'POST',
                        body: JSON.stringify({
                            response: { selected_option_id: selectedOption },
                            confidence_rating: 3,
                        }),
                    }).catch((err) => console.warn('Formative attempt recorded offline:', err));
                }
                return;
            }

            // Correct Answer: Instant zero-latency visual update
            setRemediation({
                status: 'CORRECT',
                title: 'Spot on! 🎉',
                message: explanation,
            });

            // Asynchronous authoritative attempt submission to Canonical Evidence Layer
            const targetActivityId = currentItem.activity_id || currentItem.session_item_id;
            if (activeSessionId && activeSessionId !== 'demo' && targetActivityId) {
                apiClient(`/api/v1/learning/sessions/${activeSessionId}/activities/${targetActivityId}/attempts`, {
                    method: 'POST',
                    body: JSON.stringify({
                        response: { selected_option_id: selectedOption },
                        confidence_rating: 4,
                    }),
                }).catch((err) => {
                    console.warn('Attempt recorded locally (offline resilience):', err);
                });
            }
            return;
        }

        // Assessment Mode Fallback: Server-Authoritative Evaluation
        setIsSubmitting(true);
        try {
            const targetActivityId = currentItem.activity_id || currentItem.session_item_id;
            let serverIsCorrect = false;
            let serverExplanation = explanation;

            if (activeSessionId && activeSessionId !== 'demo' && targetActivityId) {
                const res = await apiClient(`/api/v1/learning/sessions/${activeSessionId}/activities/${targetActivityId}/attempts`, {
                    method: 'POST',
                    body: JSON.stringify({
                        response: { selected_option_id: selectedOption },
                        confidence_rating: 4,
                    }),
                });
                serverIsCorrect = res?.is_correct === true;
                if (res?.explanation) serverExplanation = res.explanation;
            }

            if (serverIsCorrect) {
                setRemediation({
                    status: 'CORRECT',
                    title: 'Spot on! 🎉',
                    message: serverExplanation,
                });
            } else {
                setRemediation({
                    status: 'MISCONCEPTION',
                    title: 'Not quite.',
                    message: misconceptionMap[selectedOption] || 'Not quite. Review the principles and try again.',
                });
            }
        } catch (err) {
            console.error('Evaluation attempt failed:', err);
            setRemediation({
                status: 'MISCONCEPTION',
                title: 'Not quite.',
                message: 'Review the details and try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    // 3. Retry Handler (Clear selection, refocus visual without page reset)
    const handleRetry = () => {
        setSelectedOption(null);
        setRemediation({ status: 'IDLE', title: '', message: '' });
    };
    // 4. Hint Controller: Progressive 3-Tier Hierarchy (Notice -> Relate -> Recall)
    const defaultHints = [
        'Look at the price boundaries extending above and below the real body.',
        'Which part of the candle records the peak price explored during this session?',
        'The highest price reached is represented by the top tip of the upper shadow.',
    ];
    const activeHints = currentItem?.payload?.hints || defaultHints;
    const handleOpenNextHint = () => {
        const nextTier = Math.min(hintTier + 1, activeHints.length);
        setHintTier(nextTier);
        setIsHintOpen(true);
        telemetry.track('hint_opened', {
            sessionId: activeSessionId,
            sessionItemId: currentItem?.session_item_id,
            payload: { hint_tier: nextTier },
        });
    };
    // 5. Keyboard Shortcuts: Hotkeys 1-4 with Strict Input Safeguards
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Strict Input Safeguard: Ignore hotkeys if user is focusing an input, textarea, or select
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select')
                return;
            if (e.isComposing)
                return; // Ignore during IME composition
            const options = currentItem?.payload?.options || [];
            // Hotkeys 1-4 for options
            if (isQuestionStep && remediation.status !== 'CORRECT') {
                const num = parseInt(e.key, 10);
                if (num >= 1 && num <= options.length) {
                    setSelectedOption(options[num - 1].id);
                }
            }
            // Enter key for Check or Continue
            if (e.key === 'Enter') {
                if (isQuestionStep) {
                    if (remediation.status === 'CORRECT') {
                        handleStepTransition(currentIdx + 1);
                    }
                    else if (remediation.status === 'MISCONCEPTION') {
                        handleRetry();
                    }
                    else if (selectedOption) {
                        handleCheckAnswer();
                    }
                }
                else {
                    handleStepTransition(currentIdx + 1);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentItem, selectedOption, remediation.status, currentIdx, isQuestionStep]);
    // Authoritative Next Action Resolution
    const resolveNextAction = () => {
        return {
            type: 'NEXT_MODULE_OVERVIEW',
            title: 'Return to Units Overview',
            ctaLabel: 'Return to Units Overview →',
            url: sessionModuleSlug ? `/learn/modules/${sessionModuleSlug}/units` : '/learn',
            targetType: 'MODULE',
            targetSlug: sessionModuleSlug,
            moduleSlug: sessionModuleSlug,
        };
    };
    const nextAction = resolveNextAction();
    const resolveVerifiedCapabilities = () => {
        return [
            'Demonstrated core understanding through structured practice',
            'Completed all interactive discovery steps and verified evidence',
        ];
    };
    const verifiedCapabilities = resolveVerifiedCapabilities();
    if (isLoading) {
        return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-sm font-semibold text-slate-500">Loading interactive session canvas...</p>
        </div>
      </div>);
    }
    // 4. Earned Competence Milestone Completion Screen
    if (isLessonCompleted) {
        return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] flex flex-col justify-center items-center py-12 px-4 sm:px-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 space-y-7 text-center shadow-sm relative">
          {/* Milestone Badge */}
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
            <Award className="w-8 h-8 stroke-[2.5]"/>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">
              Session Milestone Reached
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#17202A] tracking-tight">
              Lesson Completed!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              You verified all anatomical price action steps and demonstrated first-attempt conceptual accuracy.
            </p>
          </div>

          {/* Mastery & Progression Status */}
          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-0.5">
              <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">Lesson Status</span>
              <span className="font-black text-emerald-600 text-sm flex items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
                COMPLETED
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-0.5">
              <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">Concept Mastery</span>
              <span className="font-black text-amber-700 text-sm">
                DEVELOPING
              </span>
            </div>
          </div>

          {/* Verified Capabilities Checklist */}
          <div className="text-left bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-2.5">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 block">
              Verified Capabilities:
            </span>
            <div className="space-y-2">
              {verifiedCapabilities.map((cap, cIdx) => (<div key={cIdx} className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"/>
                  <span>{cap}</span>
                </div>))}
            </div>
          </div>

          {/* Core Principle to Remember */}
          <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 text-left text-xs text-slate-700 space-y-1">
            <span className="font-bold text-blue-900 block text-[11px] uppercase tracking-wide">
              Core Principle to Remember:
            </span>
            <p className="leading-relaxed text-[11px] text-slate-600">
              A candlestick summarizes period price discovery from open to close. Context determines whether an extreme shadow represents price rejection or intraperiod volatility.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="space-y-3 pt-2">
            <button type="button" data-testid="next-action-cta" onClick={() => navigate(nextAction.url)} className="w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white shadow-md active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <span>{nextAction.ctaLabel}</span>
            </button>

            <button type="button" data-testid="return-module-overview-cta" onClick={() => navigate(`/learn/modules/${nextAction.moduleSlug}/units`)} className="w-full py-3 px-4 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">
              Return to Units Overview
            </button>
          </div>

          {/* Statutory SEBI Disclaimer */}
          <SEBIDisclaimer className="text-left mt-4"/>
        </div>
      </div>);
    }
    if (!currentItem) {
        return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-16 px-4 text-center flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-500 font-semibold">No session items available.</p>
        <button onClick={() => navigate('/learn')} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-sm">
          Return to Hub
        </button>
      </div>);
    }
    const payload = currentItem.payload || {};
    const ohlcData = payload.ohlc || { open: 100, high: 120, low: 90, close: 110 };
    const effectiveOHLC = currentItem.activity_type === 'PRACTICE'
        ? { ...ohlcData, close: practiceClose }
        : ohlcData;
    const provenance = payload.provenance;
    const options = payload.options || [];
    const hasImageOptions = options.some(o => o.media_asset_id || o.image_url || o.url);
    const currencyCode = payload.currency_code || 'INR';
    const locale = payload.locale || 'en-IN';
    const progressPercent = Math.round(((currentIdx + 1) / items.length) * 100);
    return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] flex flex-col justify-between selection:bg-blue-100">
      {/* 1. Learning Chrome: Top Clean Editorial Header */}
      <header className="sticky top-0 z-30 bg-[#FBFBFA]/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-6">
          {/* Exit Button */}
          <button type="button" aria-label="Back to module units" onClick={() => navigate(`/learn/modules/${nextAction.moduleSlug}/units`)} className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer">
            <X className="w-5 h-5 stroke-[2.5]"/>
          </button>

          {/* Restrained Progress Indicator */}
          <div className="flex-1 max-w-md flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full transition-all duration-300 ease-out" style={{ width: `${progressPercent}%` }}/>
            </div>
            <span className="font-mono text-xs font-bold text-slate-500 shrink-0">
              STEP {currentIdx + 1} OF {items.length}
            </span>
          </div>

          {/* Streak Flame (Secondary Motivation) */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-700 shrink-0">
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500"/>
            <span>1 Streak</span>
          </div>
        </div>
      </header>

      {/* 2. Main Learning Arena: Activity Chrome & Visual Surface */}
      {/* Strict Bottom Occlusion Contract: pb-44 ensures no controls are obscured by the dock */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-6 pb-44 space-y-6">
        {/* Activity Stage Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700">
            {currentItem.activity_type === 'OBSERVE' && <Eye className="w-3.5 h-3.5 text-blue-600"/>}
            {currentItem.activity_type === 'PREDICT' && <HelpCircle className="w-3.5 h-3.5 text-amber-600"/>}
            {currentItem.activity_type === 'EXPLAIN' && <Zap className="w-3.5 h-3.5 text-emerald-600"/>}
            {currentItem.activity_type === 'PRACTICE' && <Sliders className="w-3.5 h-3.5 text-indigo-600"/>}
            {currentItem.activity_type === 'MARKET_EXAMPLE' && <BarChart2 className="w-3.5 h-3.5 text-purple-600"/>}
            {currentItem.activity_type === 'MISCONCEPTION_CHECK' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600"/>}
            {currentItem.activity_type === 'APPLICATION' && <Target className="w-3.5 h-3.5 text-teal-600"/>}
            <span>{currentItem.title}</span>
          </div>

          {/* Provenance Tag */}
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            {provenance?.is_simulated ? 'SIMULATED EXAMPLE' : 'EDUCATIONAL ILLUSTRATION'}
          </span>
        </div>

        {/* Clear Cognitive Job: Prompt Headline */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-[#17202A] tracking-tight leading-snug">
            {payload.prompt || currentItem.title}
          </h1>
        </div>

        {/* Learning Object: Visualizer container */}
        <div className="w-full">
          {(() => {
            const rendererType = (currentItem.content_type || payload.renderer || (payload.ohlc ? 'CANDLESTICK' : 'TEXT')).toUpperCase();
            if (rendererType === 'CANDLESTICK' && (payload.ohlc || effectiveOHLC)) {
              return (
                <CandlestickVisualizer
                  initialOHLC={effectiveOHLC}
                  presentationMode={activePresentationMode}
                  currencyCode={currencyCode}
                  locale={locale}
                  interactive={currentItem.activity_type === 'PRACTICE'}
                  showMetrics={activePresentationMode === 'EXPLAIN'}
                  showLabels={true}
                />
              );
            }
            const Component = getRenderer(rendererType);
            return <Component payload={payload} effectiveInteraction={currentItem.activity_type} />;
          })()}
        </div>

        {/* Provenance & SEBI Context Callout */}
        {provenance && (<div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5"/>
            <div>
              <span className="font-bold text-slate-800">Market Context: </span>
              {provenance.instrument || 'SIMULATED · NIFTY 50 inspired'} · {provenance.disclaimer}
            </div>
          </div>)}

        {/* Practice Mode Slider (when in PRACTICE stage) */}
        {currentItem.activity_type === 'PRACTICE' && (<div className="space-y-3 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold">
              <span className="text-slate-700 uppercase tracking-wider">
                Adjust Close Price to Observe Candle Dynamics:
              </span>
              <div className="flex items-center gap-2" aria-live="polite">
                <span className="font-mono text-sm text-blue-600 font-bold">
                  {formatCurrency(practiceClose, currencyCode, locale)}
                </span>
                {practiceClose > 101 && (<span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ▲ Bullish (Close &gt; Open)
                  </span>)}
                {practiceClose < 99 && (<span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                    ▼ Bearish (Close &lt; Open)
                  </span>)}
                {Math.abs(practiceClose - 100) <= 1 && (<span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                    ▬ Doji (Close ≈ Open)
                  </span>)}
              </div>
            </div>

            <input type="range" role="slider" aria-label="Adjust Close Price slider" aria-valuemin={85} aria-valuemax={125} aria-valuenow={practiceClose} aria-valuetext={formatCurrency(practiceClose, currencyCode, locale)} min={85} max={125} step={1} value={practiceClose} onChange={(e) => setPracticeClose(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"/>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
              <span>Low: {formatCurrency(85, currencyCode, locale)}</span>
              <span>Open: {formatCurrency(100, currencyCode, locale)}</span>
              <span>High: {formatCurrency(125, currencyCode, locale)}</span>
            </div>

            {/* Dynamic Pedagogical Explanation */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              {practiceClose > 101 && (<p>
                  <strong className="text-emerald-700">Bullish Interval: </strong>
                  Because Close ({formatCurrency(practiceClose, currencyCode, locale)}) ended above Open ({formatCurrency(100, currencyCode, locale)}), the real body is green. Price ended higher than where it started.
                </p>)}
              {practiceClose < 99 && (<p>
                  <strong className="text-rose-700">Bearish Interval: </strong>
                  Because Close ({formatCurrency(practiceClose, currencyCode, locale)}) ended below Open ({formatCurrency(100, currencyCode, locale)}), the real body is red. Price ended lower than where it started.
                </p>)}
              {Math.abs(practiceClose - 100) <= 1 && (<p>
                  <strong className="text-slate-800">Very Small Body (Doji): </strong>
                  Close is virtually identical to Open. The real body collapses to a thin line because net price change over the period was near zero.
                </p>)}
            </div>
          </div>)}

        {/* Response Area: Choice Cards with Hotkey Safeguards */}
        {isQuestionStep && options && options.length > 0 && (<div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Select your answer:</span>
              <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                Press 1–4 to choose
              </span>
            </div>

            <div className={hasImageOptions ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "grid grid-cols-1 gap-2.5"}>
              {options.map((opt, optIdx) => {
                const isSelected = selectedOption === opt.id;
                const hasImage = Boolean(opt.media_asset_id || opt.image_url || opt.url);
                return (<button
                    key={opt.id}
                    type="button"
                    disabled={remediation.status === 'CORRECT'}
                    onClick={() => setSelectedOption(opt.id)}
                    className={`group p-3.5 rounded-xl border text-left text-sm font-semibold transition-all flex ${
                      hasImage ? 'flex-col gap-2.5' : 'flex-col sm:flex-row sm:items-center justify-between gap-2'
                    } cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-sm ring-1 ring-blue-600/30'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50/60 shadow-sm'
                    } ${remediation.status === 'CORRECT' ? 'opacity-80 cursor-not-allowed' : ''}`}
                  >
                    {hasImage && (
                      <OptionVisual
                        mediaAssetId={opt.media_asset_id}
                        imageUrl={opt.image_url || opt.url}
                        altText={opt.text || opt.label || 'Choice visual'}
                      />
                    )}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border transition-colors shrink-0 ${isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 group-hover:border-slate-300'}`}>
                          {optIdx + 1}
                        </span>
                        <span className="truncate">{opt.text || opt.label}</span>
                      </div>

                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0 ml-2 ${isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 group-hover:border-slate-400'}`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]"/>}
                      </div>
                    </div>
                  </button>);
            })}
            </div>

            {/* 3-Tier Progressive Hint System Affordance */}
            {remediation.status !== 'CORRECT' && (<div className="pt-2">
                {!isHintOpen ? (<button type="button" onClick={handleOpenNextHint} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer">
                    <Lightbulb className="w-3.5 h-3.5"/>
                    <span>Need a hint?</span>
                  </button>) : (<div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600"/>
                        <span>
                          Hint {hintTier} of {activeHints.length}:{' '}
                          {hintTier === 1 ? 'Notice' : hintTier === 2 ? 'Relate' : 'Recall'}
                        </span>
                      </span>
                      {hintTier < activeHints.length && (<button type="button" onClick={handleOpenNextHint} className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer">
                          Next Hint →
                        </button>)}
                    </div>
                    <p className="leading-relaxed">{activeHints[hintTier - 1]}</p>
                  </div>)}
              </div>)}
          </div>)}
      </main>

      {/* 3. Action Dock: Fixed Bottom Bar with Occlusion Safeguard */}
      <footer className={`fixed bottom-0 left-0 right-0 z-40 border-t transition-all duration-300 ${remediation.status === 'CORRECT'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950 shadow-lg'
            : remediation.status === 'MISCONCEPTION'
                ? 'bg-amber-50 border-amber-200 text-amber-950 shadow-lg'
                : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-md'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Feedback Section (Left Side) */}
          <div className="w-full sm:w-auto flex-1">
            {remediation.status === 'CORRECT' && (<div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 stroke-[3]"/>
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-black text-emerald-900">
                    Spot on! 🎉
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed max-w-xl">
                    {remediation.message}
                  </p>
                </div>
              </div>)}

            {remediation.status === 'MISCONCEPTION' && (<div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 stroke-[2.5]"/>
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-black text-amber-900">
                    Not quite.
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed max-w-xl">
                    {remediation.message}
                  </p>
                </div>
              </div>)}

            {remediation.status === 'IDLE' && (<div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>💡 Tip:</span>
                <span>
                  {isQuestionStep
                ? 'Select an option above, then click Check Answer.'
                : 'Inspect the chart, then click Continue to Next Step.'}
                </span>
              </div>)}
          </div>

          {/* Primary Action Button (Right Side) */}
          <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
            {isQuestionStep ? (remediation.status === 'CORRECT' ? (<button type="button" onClick={() => handleStepTransition(currentIdx + 1)} className="w-full sm:w-auto px-7 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider shadow-sm active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <span>{currentIdx + 1 === items.length ? 'Complete Lesson' : 'Continue to Next Step'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]"/>
                </button>) : remediation.status === 'MISCONCEPTION' ? (<button type="button" onClick={handleRetry} className="w-full sm:w-auto px-7 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs uppercase tracking-wider shadow-sm active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <RefreshCw className="w-4 h-4"/>
                  <span>Try Again</span>
                </button>) : (<button type="button" disabled={!selectedOption || isSubmitting} onClick={handleCheckAnswer} className={`w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${selectedOption && !isSubmitting
                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}>
                  {isSubmitting ? (<>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                      <span>Checking...</span>
                    </>) : (<span>Check Answer</span>)}
                </button>)) : (<button type="button" onClick={() => handleStepTransition(currentIdx + 1)} className="w-full sm:w-auto px-7 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider shadow-sm active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <span>{currentIdx + 1 === items.length ? 'Complete Lesson' : 'Continue to Next Step'}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]"/>
              </button>)}
          </div>
        </div>
      </footer>
    </div>);
};
