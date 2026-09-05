import React, { useState } from 'react';
import { getRenderer } from './renderers/RendererRegistry';
import { Eye, HelpCircle, Lightbulb, Sliders, BarChart2, AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, Target, } from 'lucide-react';
export const ActivityRenderer = ({ activityType = 'OBSERVE', rendererType = 'CANDLESTICK', evidenceRole, title, prompt, payload, provenance, options, onAnswerSubmit, onInteraction, isPreview = false, className = '', }) => {
    const effectiveInteraction = (activityType || payload?.activity_type || 'OBSERVE').toUpperCase();
    const effectiveRenderer = (rendererType || payload?.renderer || payload?.visual_type || 'CANDLESTICK').toUpperCase();
    const effectiveEvidenceRole = (evidenceRole || payload?.evidence_role || 'NONE').toUpperCase();
    const [selectedOption, setSelectedOption] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const handleSelectOption = (optId) => {
        if (submitted && !isPreview)
            return;
        setSelectedOption(optId);
    };
    const handleSubmit = () => {
        if (!selectedOption)
            return;
        setSubmitted(true);
        // In preview mode: strictly local state, zero network/analytics dispatches
        if (!isPreview && onAnswerSubmit) {
            onAnswerSubmit(selectedOption);
        }
    };
    const handleReset = () => {
        setSelectedOption(null);
        setSubmitted(false);
    };
    // Resolve visual component from the pluggable RendererRegistry
    const VisualComponent = getRenderer(effectiveRenderer);
    const resolvedCorrectId = payload?.correct_option_id 
        || payload?.evaluation?.correct_option_id 
        || options?.find(o => o.is_correct)?.id;

    const isAnswerCorrect = resolvedCorrectId ? String(selectedOption) === String(resolvedCorrectId) : true;
    const explanationText = payload?.explanation 
        || payload?.feedback?.explanation 
        || (isAnswerCorrect ? 'Great job! You identified the correct concept.' : 'Take another look at the principles and try again.');

    return (<div className={`space-y-6 ${className}`}>
      {/* Interaction Stage & Evidence Role Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {effectiveInteraction === 'OBSERVE' && <Eye className="w-5 h-5 text-sky-400"/>}
          {effectiveInteraction === 'PREDICT' && <HelpCircle className="w-5 h-5 text-amber-400"/>}
          {effectiveInteraction === 'EXPLAIN' && <Lightbulb className="w-5 h-5 text-emerald-400"/>}
          {effectiveInteraction === 'PRACTICE' && <Sliders className="w-5 h-5 text-indigo-400"/>}
          {effectiveInteraction === 'MARKET_EXAMPLE' && <BarChart2 className="w-5 h-5 text-purple-400"/>}
          {effectiveInteraction === 'MISCONCEPTION_CHECK' && <AlertTriangle className="w-5 h-5 text-rose-400"/>}
          {(effectiveInteraction === 'APPLICATION' || effectiveInteraction === 'TRANSFER') && (<ArrowRight className="w-5 h-5 text-teal-400"/>)}

          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {effectiveInteraction.replace('_', ' ')}
          </span>

          {/* Evidence Role Tag */}
          {effectiveEvidenceRole === 'MASTERY_EVIDENCE' && (<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <Target className="w-3 h-3 text-emerald-400"/>
              Mastery Evidence
            </span>)}
          {effectiveEvidenceRole === 'FORMATIVE' && (<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sliders className="w-3 h-3 text-indigo-400"/>
              Formative Practice
            </span>)}
        </div>

        {/* Provenance Badge */}
        {provenance && (<div className="flex items-center gap-2">
            {provenance.is_simulated ? (<span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ⚡ SIMULATED MARKET DATA
              </span>) : (<span className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400 border border-slate-700">
                HISTORICAL: {provenance.instrument || 'NIFTY 50'} · {provenance.timeframe || '1D'}
              </span>)}
          </div>)}
      </div>

      {/* Main Title & Prompt */}
      {title && <h3 className="text-xl font-black text-white">{title}</h3>}
      {prompt && <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{prompt}</p>}

      {/* Visual Component Rendered through Registry */}
      <VisualComponent payload={payload} effectiveInteraction={effectiveInteraction} isPreview={isPreview} onInteraction={onInteraction}/>

      {/* Formative / Evaluation Multiple Choice Questions */}
      {options && options.length > 0 && (<div className="space-y-3 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {effectiveEvidenceRole === 'MASTERY_EVIDENCE'
                ? 'Select the most accurate conclusion:'
                : 'Test your understanding:'}
          </div>

          <div className={options.some(o => o.image_url) ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "grid grid-cols-1 gap-2.5"}>
            {options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                let optBorder = 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700';
                if (submitted && resolvedCorrectId) {
                  if (String(opt.id) === String(resolvedCorrectId)) {
                    optBorder = 'bg-emerald-500/15 border-emerald-500 text-emerald-100 ring-1 ring-emerald-400 shadow-md';
                  } else if (isSelected) {
                    optBorder = 'bg-rose-500/15 border-rose-500 text-rose-200 ring-1 ring-rose-400 shadow-md';
                  }
                } else if (isSelected) {
                  optBorder = 'bg-sky-500/20 border-sky-400 text-white ring-1 ring-sky-400 shadow-md';
                }

                return (<button key={opt.id} type="button" onClick={() => handleSelectOption(opt.id)} className={`p-3.5 rounded-xl border text-left text-sm font-medium transition-all flex flex-col gap-2 ${optBorder}`}>
                  {opt.image_url && (<img src={opt.image_url} alt={opt.text || opt.label || 'Choice visual'} className="w-full h-28 object-contain rounded-lg bg-slate-950/60 p-1"/>)}
                  <div className="flex items-center justify-between w-full">
                    <span>{opt.text || opt.label}</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-sky-400 bg-sky-500' : 'border-slate-600'}`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                    </div>
                  </div>
                </button>);
            })}
          </div>

          {/* Feedback & Submission Actions */}
          <div className="pt-3 space-y-3">
            {!submitted ? (
              <button type="button" disabled={!selectedOption} onClick={handleSubmit} className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-sky-500/20 transition-all cursor-pointer">
                Submit Answer
              </button>
            ) : (
              <div className="space-y-3">
                <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  isAnswerCorrect 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {isAnswerCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="text-sm font-bold">
                      {isAnswerCorrect ? 'Spot on! 🎉' : 'Not quite.'}
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed">
                      {explanationText}
                    </div>
                  </div>
                </div>

                {(!isAnswerCorrect || isPreview) && (
                  <button type="button" onClick={handleReset} className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5"/>
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>
        </div>)}
    </div>);
};

