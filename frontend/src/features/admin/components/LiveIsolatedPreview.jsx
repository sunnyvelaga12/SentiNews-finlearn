import React, { useState, useMemo } from 'react';
import { ActivityRenderer } from '../../learning/components/ActivityRenderer';
import { Monitor, Tablet, Smartphone, RotateCcw, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2, XCircle, AlertCircle, HelpCircle, } from 'lucide-react';
import { getCachedMediaUrl } from '../utils/mediaResolver';
import { resolveEndpointUrl } from '../../../services/apiClient';

export const LiveIsolatedPreview = ({
    lessonTitle,
    blocks = [],
    activeStepIndex = 0,
    onStepChange,
    onClosePreview,
}) => {
    // Navigation & Scope
    const [previewMode, setPreviewMode] = useState('STEP');
    const [currentStep, setCurrentStep] = useState(activeStepIndex);

    React.useEffect(() => {
        if (activeStepIndex !== undefined && activeStepIndex !== null && activeStepIndex !== currentStep) {
            setCurrentStep(activeStepIndex);
        }
    }, [activeStepIndex]);

    const handleSelectStep = (step) => {
        const next = Math.max(0, Math.min(step, (blocks.length || 1) - 1));
        setCurrentStep(next);
        onStepChange?.(next);
    };
    const [viewport, setViewport] = useState('DESKTOP');
    const [syntheticState, setSyntheticState] = useState('FRESH');
    // Local Deterministic Evaluation State (strictly in-memory, ZERO network calls)
    const [userAnswers, setUserAnswers] = useState({});
    const [submittedSteps, setSubmittedSteps] = useState({});
    const [revealedHints, setRevealedHints] = useState({});
    const block = blocks[currentStep] || {
        title: 'Empty Step',
        prompt: 'No content configured yet.',
        type: 'OBSERVE',
        renderer: 'CANDLESTICK',
        evidence_role: 'NONE',
        payload: {},
    };
    const options = useMemo(() => {
        const rawOpts = block.options || [];
        const correctId = block.evaluation?.correct_option_id || block.correct_option_id;
        return rawOpts.map((o, idx) => {
            const rawImg = o.media_asset_id ? getCachedMediaUrl(o.media_asset_id) : (o.image_url || o.url);
            return {
                id: o.id || `opt_${idx}`,
                text: o.text || o.label || `Option ${idx + 1}`,
                media_asset_id: o.media_asset_id,
                image_url: rawImg ? resolveEndpointUrl(rawImg) : null,
                is_correct: o.is_correct === true || o.id === correctId,
            };
        });
    }, [block]);
    const hasImageOptions = useMemo(() => options.some(o => o.image_url || o.media_asset_id), [options]);
    const correctOptionId = useMemo(() => {
        const found = options.find((o) => o.is_correct);
        return found?.id || block.evaluation?.correct_option_id || block.correct_option_id || options[0]?.id;
    }, [options, block]);
    // Synthetic State Overrides
    const selectedOption = useMemo(() => {
        if (syntheticState === 'WRONG_ANSWER') {
            const wrong = options.find((o) => !o.is_correct);
            return wrong ? wrong.id : options[0]?.id;
        }
        if (syntheticState === 'COMPLETED' || syntheticState === 'MASTERED') {
            return correctOptionId;
        }
        return userAnswers[currentStep] || null;
    }, [syntheticState, userAnswers, currentStep, options, correctOptionId]);
    const isSubmitted = useMemo(() => {
        if (['WRONG_ANSWER', 'COMPLETED', 'MASTERED'].includes(syntheticState))
            return true;
        return !!submittedSteps[currentStep];
    }, [syntheticState, submittedSteps, currentStep]);
    const isCorrect = selectedOption === correctOptionId;
    const showHint = syntheticState === 'AFTER_HINT' || !!revealedHints[currentStep];
    // Local interaction handlers (100% Client-Side, No Network Invocation)
    const handleAnswerSelect = (optionId) => {
        if (isSubmitted && syntheticState === 'FRESH')
            return;
        setUserAnswers((prev) => ({ ...prev, [currentStep]: optionId }));
    };
    const handleLocalSubmit = () => {
        if (!selectedOption)
            return;
        setSubmittedSteps((prev) => ({ ...prev, [currentStep]: true }));
    };
    const handleResetStep = () => {
        setSyntheticState('FRESH');
        setUserAnswers((prev) => {
            const next = { ...prev };
            delete next[currentStep];
            return next;
        });
        setSubmittedSteps((prev) => {
            const next = { ...prev };
            delete next[currentStep];
            return next;
        });
        setRevealedHints((prev) => {
            const next = { ...prev };
            delete next[currentStep];
            return next;
        });
    };
    // Viewport CSS width classes
    const viewportClasses = {
        DESKTOP: 'w-full max-w-4xl',
        TABLET: 'w-full max-w-[768px]',
        MOBILE: 'w-full max-w-[390px]',
    }[viewport];
    return (<div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* ── Top Bar: Synthetic Controls & Invariant Guarantee ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400"/>
            <span>PREVIEW MODE · Zero Network · No Learner Data Recorded</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
            <span>Lesson:</span>
            <span className="font-semibold text-slate-200">{lessonTitle || 'Untitled Lesson'}</span>
          </div>
        </div>

        {/* Device & State Switchers */}
        <div className="flex items-center gap-3">
          {/* Step vs Full Toggle */}
          <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700 text-xs font-medium">
            <button onClick={() => setPreviewMode('STEP')} className={`px-3 py-1 rounded transition-colors ${previewMode === 'STEP' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
              Step Preview
            </button>
            <button onClick={() => setPreviewMode('FULL')} className={`px-3 py-1 rounded transition-colors ${previewMode === 'FULL' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
              Full Lesson Journey
            </button>
          </div>

          {/* Synthetic State Selector */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400">Learner State:</span>
            <select value={syntheticState} onChange={(e) => setSyntheticState(e.target.value)} className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500">
              <option value="FRESH">Fresh (First Visit)</option>
              <option value="RETURNING">Returning (Review)</option>
              <option value="WRONG_ANSWER">Wrong Answer (Retry)</option>
              <option value="AFTER_HINT">After Hint Revealed</option>
              <option value="COMPLETED">Completed</option>
              <option value="MASTERED">Mastered (100% Verified)</option>
            </select>
          </div>

          {/* Device Viewport Icons */}
          <div className="flex items-center bg-slate-800 rounded p-1 border border-slate-700">
            <button onClick={() => setViewport('DESKTOP')} title="Desktop View" className={`p-1.5 rounded ${viewport === 'DESKTOP' ? 'bg-slate-700 text-blue-400' : 'text-slate-400'}`}>
              <Monitor className="w-4 h-4"/>
            </button>
            <button onClick={() => setViewport('TABLET')} title="Tablet View (768px)" className={`p-1.5 rounded ${viewport === 'TABLET' ? 'bg-slate-700 text-blue-400' : 'text-slate-400'}`}>
              <Tablet className="w-4 h-4"/>
            </button>
            <button onClick={() => setViewport('MOBILE')} title="Mobile View (390px)" className={`p-1.5 rounded ${viewport === 'MOBILE' ? 'bg-slate-700 text-blue-400' : 'text-slate-400'}`}>
              <Smartphone className="w-4 h-4"/>
            </button>
          </div>

          {onClosePreview && (<button onClick={onClosePreview} className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700">
              Exit Preview
            </button>)}
        </div>
      </div>

      {/* ── Main Preview Viewport Container ── */}
      <div className="flex-1 overflow-y-auto p-6 flex justify-center items-start bg-slate-950">
        <div className={`transition-all duration-200 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl flex flex-col ${viewportClasses}`}>
          {/* Progress Header in Full Mode */}
          {previewMode === 'FULL' && (<div className="mb-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Step {currentStep + 1} of {blocks.length}
                </span>
                <span className="font-semibold text-blue-400">
                  {Math.round(((currentStep + 1) / blocks.length) * 100)}% Complete
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${((currentStep + 1) / blocks.length) * 100}%` }}/>
              </div>
            </div>)}

          {/* Synthetic State Info Callout */}
          {syntheticState !== 'FRESH' && (<div className="mb-4 px-3 py-2 rounded bg-blue-500/10 border border-blue-500/30 text-xs flex items-center gap-2 text-blue-300">
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0"/>
              <span>
                Simulating <strong>{syntheticState.replace('_', ' ')}</strong> mode. User interactions remain local.
              </span>
            </div>)}

          {/* Step Title & Prompt */}
          <div className="mb-6 space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Step {currentStep + 1}: {block.type || 'OBSERVE'}
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {block.title || 'Untitled Step'}
            </h2>
            {block.prompt && (<p className="text-sm text-slate-300 leading-relaxed pt-1">{block.prompt}</p>)}
          </div>

          {/* Canonical ActivityRenderer Execution */}
          <div className="flex-1">
            <ActivityRenderer
              activityType={block.activity_type || block.type || 'EXPERIENCE'}
              rendererType={block.content_type || block.renderer || 'TEXT'}
              evidenceRole={block.evidence_role || 'NONE'}
              title={block.title}
              prompt={block.prompt || block.content?.body || block.content?.text}
              payload={{
                ...(block.content || {}),
                ...(block.payload || {}),
                media_asset_id: block.media_asset_id,
                url: block.media_asset_id
                  ? getCachedMediaUrl(block.media_asset_id)
                  : (block.content?.url || block.content?.image_url),
              }}
              provenance={block.source_citation || block.provenance}
              options={null}
              isPreview={true}
            />
          </div>

          {/* Multiple Choice Interactive Feedback Box (Client-Side Deterministic Evaluator) */}
          {options.length > 0 && (<div className="mt-6 pt-4 border-t border-slate-800 space-y-4">
              <div className={hasImageOptions ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-2"}>
                {options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                let btnStyle = 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200';
                if (isSubmitted) {
                    if (opt.is_correct) {
                        btnStyle = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300';
                    }
                    else if (isSelected) {
                        btnStyle = 'border-rose-500/60 bg-rose-500/10 text-rose-300';
                    }
                }
                else if (isSelected) {
                    btnStyle = 'border-blue-500 bg-blue-500/20 text-blue-200';
                }
                return (<button
                    key={opt.id}
                    onClick={() => handleAnswerSelect(opt.id)}
                    disabled={isSubmitted && syntheticState !== 'WRONG_ANSWER'}
                    className={`w-full text-left p-3 rounded-lg border text-sm font-medium transition-all flex flex-col justify-between gap-2 ${btnStyle}`}
                  >
                    {opt.image_url && (
                      <div className="w-full h-28 bg-slate-950/80 rounded-md overflow-hidden flex items-center justify-center border border-slate-700/60 p-1">
                        <img
                          src={opt.image_url}
                          alt={opt.text}
                          className="w-full h-full object-contain"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{opt.text}</span>
                      {isSubmitted && opt.is_correct && (<CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2"/>)}
                      {isSubmitted && isSelected && !opt.is_correct && (<XCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2"/>)}
                    </div>
                  </button>);
            })}
              </div>

              {/* Submit / Retry Actions */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {!isSubmitted ? (<button onClick={handleLocalSubmit} disabled={!selectedOption} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs">
                      Check Answer (Local)
                    </button>) : (<button onClick={handleResetStep} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700">
                      <RotateCcw className="w-3.5 h-3.5"/>
                      <span>Reset Step</span>
                    </button>)}

                  {block.hint && (<button onClick={() => setRevealedHints((p) => ({ ...p, [currentStep]: !p[currentStep] }))} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20">
                      <HelpCircle className="w-3.5 h-3.5"/>
                      <span>{showHint ? 'Hide Hint' : 'View Hint'}</span>
                    </button>)}
                </div>

                {/* Local Evaluation Result Callout */}
                {isSubmitted && (<div className="flex items-center gap-2 text-xs font-bold">
                    {isCorrect ? (<span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4"/> Correct Answer
                      </span>) : (<span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-4 h-4"/> Try Again
                      </span>)}
                  </div>)}
              </div>

              {/* Hint Box */}
              {showHint && block.hint && (<div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                  <div className="font-bold mb-0.5">Author Hint:</div>
                  <div>{block.hint}</div>
                </div>)}

              {/* Explanation Box on submission */}
              {isSubmitted && (block.evaluation?.explanation || block.feedback?.explanation || block.explanation) && (
                <div className="p-3.5 rounded bg-slate-800/80 border border-slate-700 text-xs text-slate-300 space-y-1">
                  <div className="font-bold text-slate-200">Explanation:</div>
                  <div className="leading-relaxed">
                    {block.evaluation?.explanation || block.feedback?.explanation || block.explanation}
                  </div>
                </div>
              )}
            </div>)}

          {/* Navigation Controls across steps */}
          {blocks.length > 1 && (
            <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => handleSelectStep(currentStep - 1)}
                disabled={currentStep === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-xs font-semibold text-slate-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Previous Step
              </button>

              <div className="text-xs text-slate-400 font-medium">
                Step <span className="font-bold text-white">{currentStep + 1}</span> of {blocks.length}
              </div>

              <button
                onClick={() => handleSelectStep(currentStep + 1)}
                disabled={currentStep === blocks.length - 1}
                className="flex items-center gap-1 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-xs font-bold text-white transition-colors"
              >
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>);
};
