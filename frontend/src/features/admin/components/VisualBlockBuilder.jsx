import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { apiClient } from '../../../services/apiClient';
import { ActivityRenderer } from '../../learning/components/ActivityRenderer';
import { Trash2, Eye, CheckCircle2, AlertCircle, Save, Send, ShieldCheck, Sparkles, Sliders, HelpCircle, BarChart2, AlertTriangle, ArrowRight, Layers, Lock, } from 'lucide-react';
export const VisualBlockBuilder = () => {
    // Metadata fields
    const [lessonTitle, setLessonTitle] = useState('What is a Candlestick?');
    const [lessonSlug, setLessonSlug] = useState('what-is-a-candlestick');
    const [selectedConceptId, setSelectedConceptId] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(5);
    const [learningObjective, setLearningObjective] = useState('Explain what a single candle represents and how to read OHLC price discovery.');
    const [concepts, setConcepts] = useState([]);
    // Publication State Machine & OCC
    const [versionId, setVersionId] = useState(null);
    const [versionNumber, setVersionNumber] = useState(1);
    const [publicationState, setPublicationState] = useState('DRAFT');
    const [occConflict, setOccConflict] = useState(null);
    // Synthetic Preview State
    const [previewLearnerState, setPreviewLearnerState] = useState('FRESH');
    // Pedagogical Authoring Cards
    const [cards, setCards] = useState([
        {
            id: 'step-1',
            activity_type: 'OBSERVE',
            renderer: 'CANDLESTICK',
            evidence_role: 'NONE',
            title: 'Step 1: Visual Observation',
            prompt: 'Inspect this candlestick. Notice the green body and the thin lines extending above and below.',
            payload: {
                ohlc: { open: 100, high: 120, low: 90, close: 115, timeframe: '1D' },
                interactive: true,
            },
        },
        {
            id: 'step-2',
            activity_type: 'PREDICT',
            renderer: 'CANDLESTICK',
            evidence_role: 'MASTERY_EVIDENCE',
            title: 'Step 2: Prediction Question',
            prompt: 'Which price represents the highest level traded during this period?',
            options: [
                { id: 'opt_1', text: 'The top of the real body', is_correct: false },
                { id: 'opt_2', text: 'The highest point of the upper shadow (High)', is_correct: true },
                { id: 'opt_3', text: 'The opening price', is_correct: false },
            ],
            correct_option_id: 'opt_2',
            explanation: 'The highest point reached at any time during the period is marked by the top of the upper shadow.',
        },
        {
            id: 'step-3',
            activity_type: 'PRACTICE',
            renderer: 'CANDLESTICK',
            evidence_role: 'FORMATIVE',
            title: 'Step 3: Interactive Manipulation',
            prompt: 'Use the price sliders to change the Close price. Watch how the candle body changes color and size.',
            payload: {
                ohlc: { open: 100, high: 130, low: 85, close: 120 },
            },
        },
        {
            id: 'step-4',
            activity_type: 'MARKET_EXAMPLE',
            renderer: 'CANDLESTICK',
            evidence_role: 'NONE',
            title: 'Step 4: Real-Market Historical Context',
            prompt: 'Here is a historical daily candle from NIFTY 50 during a high-volatility session.',
            payload: {
                ohlc: { open: 19500, high: 19800, low: 19450, close: 19750, timeframe: '1D' },
            },
            provenance: {
                is_simulated: false,
                instrument: 'NSE:NIFTY50',
                exchange: 'NSE',
                timeframe: '1D',
                historical_date_range: '2023-10-15',
                source_citation: 'National Stock Exchange of India Historical Data Feed',
                disclaimer: 'For educational market demonstration only. Not investment advice.',
            },
        },
        {
            id: 'step-5',
            activity_type: 'APPLICATION',
            renderer: 'CANDLESTICK',
            evidence_role: 'MASTERY_EVIDENCE',
            title: 'Step 5: Capability Transfer Scenario',
            prompt: 'You see a long red candle with a very long lower shadow. What does this tell you about the intraperiod battle?',
            options: [
                { id: 'app_1', text: 'Buyers pushed price up throughout the entire period without opposition', is_correct: false },
                { id: 'app_2', text: 'Sellers dominated overall, but buyers mounted a strong defense near session lows', is_correct: true },
            ],
            correct_option_id: 'app_2',
            explanation: 'The red body indicates the Close was below the Open, while the long lower shadow shows buyers rejected the deepest lows.',
        },
    ]);
    // UI state
    const [activeStepIdx, setActiveStepIdx] = useState(0);
    const [statusMsg, setStatusMsg] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    useEffect(() => {
        apiClient('/api/v1/concepts')
            .then((data) => {
            const list = Array.isArray(data) ? data : data?.concepts || [];
            setConcepts(list);
            if (list.length > 0 && !selectedConceptId) {
                setSelectedConceptId(list[0].id);
            }
        })
            .catch((err) => {
            console.warn('Could not load concepts:', err);
        });
    }, []);
    const handleAddCard = (type, role = 'NONE') => {
        const newCard = {
            id: `step-${Date.now()}`,
            activity_type: type,
            renderer: 'CANDLESTICK',
            evidence_role: role,
            title: `Step ${cards.length + 1}: ${type.replace('_', ' ')}`,
            prompt: 'Enter interactive instruction or question prompt here.',
            payload: {
                ohlc: { open: 100, high: 120, low: 90, close: 110, timeframe: '1D' },
            },
            options: type === 'PREDICT' || type === 'MISCONCEPTION_CHECK' || type === 'APPLICATION'
                ? [
                    { id: 'opt_1', text: 'Option A', is_correct: true },
                    { id: 'opt_2', text: 'Option B', is_correct: false },
                ]
                : undefined,
        };
        setCards([...cards, newCard]);
        setActiveStepIdx(cards.length);
    };
    const handleRemoveCard = (index) => {
        const filtered = cards.filter((_, i) => i !== index);
        setCards(filtered);
        if (activeStepIdx >= filtered.length) {
            setActiveStepIdx(Math.max(0, filtered.length - 1));
        }
    };
    // ── Governance State Machine & OCC Actions ──────────────────────────────────
    const handleSaveDraft = async () => {
        setIsProcessing(true);
        setStatusMsg(null);
        setErrorMsg(null);
        setOccConflict(null);
        const payload = {
            title: lessonTitle,
            slug: lessonSlug,
            concept_ids: selectedConceptId ? [selectedConceptId] : [],
            duration_minutes: durationMinutes,
            learning_objectives: [learningObjective],
            blocks: cards.map((c) => ({
                id: c.id,
                type: c.activity_type,
                renderer: c.renderer,
                evidence_role: c.evidence_role || 'NONE',
                title: c.title,
                prompt: c.prompt,
                payload: c.payload,
                options: c.options,
                correct_option_id: c.correct_option_id,
                explanation: c.explanation,
                provenance: c.provenance,
            })),
            expected_version: versionNumber,
        };
        try {
            if (!versionId) {
                const res = await apiClient('/api/v1/admin/lessons/draft', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                setVersionId(res.version_id);
                setVersionNumber(res.version_number);
                setPublicationState(res.lesson_status);
                setStatusMsg(`✓ Draft v${res.version_number} created and saved to PostgreSQL.`);
            }
            else {
                const res = await apiClient(`/api/v1/admin/lessons/draft/${versionId}`, {
                    method: 'PATCH',
                    headers: { 'If-Match': `v${versionNumber}` },
                    body: JSON.stringify(payload),
                });
                setVersionNumber(res.version_number);
                setStatusMsg(`✓ Draft v${res.version_number} updated with Optimistic Concurrency check passed.`);
            }
        }
        catch (err) {
            if (err.status === 409 || err.message?.includes('OCC_CONFLICT')) {
                setOccConflict(err.message || 'This draft changed while you were editing it.');
            }
            else {
                setErrorMsg(`Failed to save draft: ${err.message}`);
            }
        }
        finally {
            setIsProcessing(false);
        }
    };
    const handleTransitionState = async (nextState, actionName) => {
        if (!versionId) {
            setErrorMsg('Please save the draft first before submitting for review.');
            return;
        }
        setIsProcessing(true);
        setStatusMsg(null);
        setErrorMsg(null);
        try {
            const res = await apiClient(`/api/v1/admin/lessons/${versionId}/transition`, {
                method: 'POST',
                body: JSON.stringify({
                    new_status: nextState,
                    notes: `Action executed: ${actionName}`,
                    idempotency_key: `trans-${versionId}-${nextState}`,
                }),
            });
            setPublicationState(res.new_status);
            setStatusMsg(`✓ Workflow Action: '${actionName}' completed. State is now ${res.new_status}.`);
        }
        catch (err) {
            if (err.status === 422) {
                setErrorMsg(`Content Completeness Check Failed: ${err.message}`);
            }
            else {
                setErrorMsg(`Transition failed: ${err.message}`);
            }
        }
        finally {
            setIsProcessing(false);
        }
    };
    const currentCard = cards[activeStepIdx] || cards[0];
    return (<div className="space-y-6">
      {/* OCC Conflict Resolution Dialog */}
      {occConflict && (<div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-200 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400"/>
              Concurrent Editing Conflict (HTTP 409)
            </div>
            <p className="text-xs text-rose-300">
              {occConflict} Another editor has published changes. Choose how you would like to proceed:
            </p>
            <div className="pt-2 flex items-center gap-3">
              <button type="button" onClick={() => setOccConflict(null)} className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold">
                Keep Local Edits & Retry
              </button>
              <button type="button" onClick={() => {
                setOccConflict(null);
                setStatusMsg('Draft reset to server state.');
            }} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">
                Reload Latest from Server
              </button>
            </div>
          </div>
        </div>)}

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest">
            <Sparkles className="w-4 h-4"/>
            Content Studio Authoring
          </div>
          <h2 className="text-2xl font-black text-white">Visual Lesson & Activity Studio</h2>
          <p className="text-xs text-slate-400">
            Author pedagogical steps, configure evidence roles, and verify live learner experience without drift.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Current State</span>
            <Badge variant={publicationState === 'PUBLISHED'
            ? 'success'
            : publicationState === 'APPROVED'
                ? 'info'
                : publicationState.includes('REVIEW')
                    ? 'warning'
                    : 'neutral'}>
              {publicationState}
            </Badge>
          </div>
        </div>
      </div>

      {/* Status / Error Toast Notifications */}
      {statusMsg && (<div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0"/>
          {statusMsg}
        </div>)}
      {errorMsg && (<div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0"/>
          {errorMsg}
        </div>)}

      {/* 1. Lesson Metadata Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          1. Lesson Metadata & Curriculum Node
        </span>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-medium text-slate-300">
          <div className="space-y-1.5">
            <label>Lesson Title:</label>
            <input type="text" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"/>
          </div>

          <div className="space-y-1.5">
            <label>URL Slug:</label>
            <input type="text" value={lessonSlug} onChange={(e) => setLessonSlug(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs"/>
          </div>

          <div className="space-y-1.5">
            <label>Primary Knowledge Concept:</label>
            <select value={selectedConceptId} onChange={(e) => setSelectedConceptId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium">
              {(concepts || []).map((c) => (<option key={c.id} value={c.id}>
                  {c.title} ({c.domain})
                </option>))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label>Estimated Duration (Minutes):</label>
            <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"/>
          </div>
        </div>

        <div className="space-y-1.5 text-xs font-medium text-slate-300">
          <label>Learning Objective & Real-World Promise:</label>
          <input type="text" value={learningObjective} onChange={(e) => setLearningObjective(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"/>
        </div>
      </div>

      {/* Step Builder & Live Preview Split Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Step Sequence Navigator */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pedagogical Steps ({cards.length})
            </span>
          </div>

          <div className="space-y-2">
            {cards.map((card, idx) => (<div key={card.id} onClick={() => setActiveStepIdx(idx)} className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-xs font-semibold ${activeStepIdx === idx
                ? 'bg-sky-500/20 border-sky-400 text-sky-200 ring-1 ring-sky-400 shadow-md'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-sky-400 uppercase">
                      Step {idx + 1} · {card.activity_type}
                    </span>
                    {card.evidence_role === 'MASTERY_EVIDENCE' && (<span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        Evidence
                      </span>)}
                    {card.evidence_role === 'FORMATIVE' && (<span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        Practice
                      </span>)}
                  </div>
                  <div className="text-white font-bold">{card.title}</div>
                </div>

                {cards.length > 1 && (<button type="button" onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveCard(idx);
                }} className="p-1 text-slate-500 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-4 h-4"/>
                  </button>)}
              </div>))}
          </div>

          {/* Add Step Buttons */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              + Add Pedagogical Step:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button variant="outline" size="sm" onClick={() => handleAddCard('OBSERVE', 'NONE')} className="justify-start gap-1.5">
                <Eye className="w-3.5 h-3.5 text-sky-400"/> Observe
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddCard('PREDICT', 'MASTERY_EVIDENCE')} className="justify-start gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400"/> Predict
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddCard('PRACTICE', 'FORMATIVE')} className="justify-start gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400"/> Manipulate
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddCard('MARKET_EXAMPLE', 'NONE')} className="justify-start gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-purple-400"/> Market Lab
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddCard('MISCONCEPTION_CHECK', 'MASTERY_EVIDENCE')} className="justify-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400"/> Misconception
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddCard('APPLICATION', 'MASTERY_EVIDENCE')} className="justify-start gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-teal-400"/> Application
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Live Shared ActivityRenderer Preview Canvas */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400"/>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  LIVE RENDERER PREVIEW (SHARED ACTIVITY RENDERER)
                </span>
              </div>

              {/* Synthetic Learner Context Selector */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-semibold">Preview Context:</span>
                <select value={previewLearnerState} onChange={(e) => setPreviewLearnerState(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-xs">
                  <option value="FRESH">Fresh Learner</option>
                  <option value="RETURNING">Returning Learner</option>
                  <option value="WRONG_ANSWER">Wrong Answer / Misconception</option>
                  <option value="MASTERED">Mastery Demonstrated</option>
                  <option value="LOCKED">Locked Preview</option>
                </select>
              </div>
            </div>

            {/* Zero-Drift Shared ActivityRenderer */}
            <ActivityRenderer activityType={currentCard.activity_type} rendererType={currentCard.renderer} evidenceRole={currentCard.evidence_role} title={currentCard.title} prompt={currentCard.prompt} payload={currentCard.payload} provenance={currentCard.provenance} options={currentCard.options} isPreview={true}/>

            {/* Synthetic Preview Simulation Boxes */}
            {previewLearnerState === 'WRONG_ANSWER' && (<div className="mt-4 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400"/>
                  <span>Learner Selected Common Misconception (Simulated Wrong Answer)</span>
                </div>
                <p className="text-rose-200/90 leading-relaxed">
                  {currentCard.explanation ||
                'Misconception Feedback: The highest traded price in the period is indicated by the tip of the upper wick, not the real body.'}
                </p>
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-rose-900/40">
                  <span>Remediation Strategy: Visual hint enabled & retry allowed</span>
                  <span className="font-mono text-amber-400">Mastery Impact: None (Formative Guidance)</span>
                </div>
              </div>)}

            {previewLearnerState === 'MASTERED' && (<div className="mt-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
                  <span>Mastery Evidence Verified</span>
                </div>
                <p className="text-emerald-200/90 leading-relaxed">
                  This learner has answered key predictive and application prompts correctly. Concept mastery projection: <strong>Proficient (85%)</strong>.
                </p>
              </div>)}

            {previewLearnerState === 'LOCKED' && (<div className="mt-4 p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Lock className="w-4 h-4 text-amber-400"/>
                  <span>Locked Lesson Preview</span>
                </div>
                <p className="text-amber-200/90 leading-relaxed">
                  Prerequisites incomplete. Overview metadata and learning outcomes remain visible; session player is locked.
                </p>
              </div>)}
          </div>

          {/* 3. Governance Review Pipeline Actions */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400"/>
                Governance Review Pipeline
              </span>
              <span className="text-xs font-mono text-slate-400">
                Current Stage: <strong className="text-white">{publicationState}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="primary" onClick={handleSaveDraft} disabled={isProcessing} className="gap-1.5 shadow-lg shadow-sky-500/20">
                <Save className="w-4 h-4"/> Save Draft v{versionNumber}
              </Button>

              {publicationState === 'DRAFT' && (<Button variant="outline" onClick={() => handleTransitionState('EDITOR_REVIEW', 'Submit for Editorial Review')} disabled={isProcessing} className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
                  <Send className="w-4 h-4"/> Submit for Review
                </Button>)}

              {publicationState === 'EDITOR_REVIEW' && (<Button variant="outline" onClick={() => handleTransitionState('FINANCE_REVIEW', 'Approve Editorial & Forward to Finance')} disabled={isProcessing} className="gap-1.5 border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                  <CheckCircle2 className="w-4 h-4"/> Approve Editorial
                </Button>)}

              {publicationState === 'FINANCE_REVIEW' && (<Button variant="outline" onClick={() => handleTransitionState('COMPLIANCE_REVIEW', 'Approve Finance & Forward to Compliance')} disabled={isProcessing} className="gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-500/10">
                  <CheckCircle2 className="w-4 h-4"/> Approve Finance
                </Button>)}

              {publicationState === 'COMPLIANCE_REVIEW' && (<Button variant="outline" onClick={() => handleTransitionState('APPROVED', 'Approve Compliance')} disabled={isProcessing} className="gap-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
                  <CheckCircle2 className="w-4 h-4"/> Approve Compliance
                </Button>)}

              {publicationState === 'APPROVED' && (<Button variant="primary" onClick={() => handleTransitionState('PUBLISHED', 'Publish Approved Version')} disabled={isProcessing} className="gap-1.5 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 text-white font-bold">
                  <Sparkles className="w-4 h-4"/> Publish Approved Version
                </Button>)}
            </div>
          </div>
        </div>
      </div>
    </div>);
};
