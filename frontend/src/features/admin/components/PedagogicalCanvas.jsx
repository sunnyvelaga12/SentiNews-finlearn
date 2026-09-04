import React, { useState } from 'react';
import { Eye, HelpCircle, Lightbulb, Sliders, BarChart2, AlertTriangle, ArrowRight, Share2, Plus, Trash2, Copy, ChevronUp, ChevronDown, Play, AlertCircle, Tag, Clock, } from 'lucide-react';
export const PedagogicalCanvas = ({ lessonTitle, lessonSlug, durationMinutes, level, learningObjectives, blocks, activeBlockIndex, pacingIssues = [], onUpdateMetadata, onSelectBlock, onUpdateBlock, onMoveBlock, onDuplicateBlock, onDeleteBlock, onAddBlock, onPreviewStep, }) => {
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [newObjective, setNewObjective] = useState('');
    // Step type metadata dictionary
    const stepTypeConfig = {
        OBSERVE: { label: 'Observe', icon: Eye, color: 'bg-sky-50 text-sky-700 border-sky-200' },
        PREDICT: { label: 'Predict', icon: HelpCircle, color: 'bg-amber-50 text-amber-700 border-amber-200' },
        EXPLAIN: { label: 'Explain', icon: Lightbulb, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        PRACTICE: { label: 'Practice', icon: Sliders, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
        MARKET_EXAMPLE: { label: 'Market Example', icon: BarChart2, color: 'bg-purple-50 text-purple-700 border-purple-200' },
        MISCONCEPTION_CHECK: { label: 'Misconception Check', icon: AlertTriangle, color: 'bg-rose-50 text-rose-700 border-rose-200' },
        APPLICATION: { label: 'Application', icon: ArrowRight, color: 'bg-teal-50 text-teal-700 border-teal-200' },
        TRANSFER: { label: 'Transfer', icon: Share2, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    };
    const handleAddObjective = () => {
        if (!newObjective.trim())
            return;
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
    return (<div className="flex-1 overflow-y-auto bg-[#FBFBFA] p-8 max-w-4xl mx-auto w-full space-y-8">
      {/* ── Lesson Header (Content Mode) ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Lesson Title
            </label>
            <input type="text" value={lessonTitle} onChange={(e) => onUpdateMetadata({ title: e.target.value })} placeholder="e.g. What is a Candlestick?" className="w-full text-2xl font-black text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors"/>
            <div className="text-xs text-slate-400 font-mono">slug: {lessonSlug}</div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Level Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Level
              </label>
              <select value={level} onChange={(e) => onUpdateMetadata({ level: e.target.value })} className="text-xs font-bold border border-slate-200 rounded px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:border-blue-500">
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
                <Clock className="w-3.5 h-3.5 text-slate-400"/>
                <input type="number" min="1" max="60" value={durationMinutes} onChange={(e) => onUpdateMetadata({ durationMinutes: parseInt(e.target.value) || 5 })} className="w-12 text-xs font-bold bg-transparent text-slate-700 focus:outline-none"/>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Objectives Tag List */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-500"/>
              Learning Objectives ({learningObjectives.length})
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {learningObjectives.map((obj, idx) => (<span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                <span>{obj}</span>
                <button onClick={() => handleRemoveObjective(idx)} className="hover:text-rose-600 rounded-full p-0.5">
                  ×
                </button>
              </span>))}

            <div className="flex items-center gap-1">
              <input type="text" placeholder="+ Add objective..." value={newObjective} onChange={(e) => setNewObjective(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddObjective()} className="text-xs px-2.5 py-1 border border-dashed border-slate-300 rounded-full bg-slate-50 focus:outline-none focus:border-blue-500 text-slate-700"/>
              {newObjective.trim() && (<button onClick={handleAddObjective} className="text-xs px-2 py-1 rounded bg-blue-600 text-white font-bold">
                  Add
                </button>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sequence Pacing Advisory Banner ── */}
      {pacingIssues.length > 0 && (<div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>
          <div className="space-y-1">
            <div className="font-bold text-amber-900">Sequence Pacing Advisory</div>
            <p className="text-amber-700 leading-relaxed">{pacingIssues[0].description}</p>
          </div>
        </div>)}

      {/* ── Pedagogical Sequence Journey Ribbon ── */}
      {blocks.length > 0 && (<div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>PEDAGOGICAL FLOW JOURNEY</span>
            <span className="text-slate-400">Click any step to inspect & configure</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {blocks.map((b, i) => {
                const cfg = stepTypeConfig[b.type] || stepTypeConfig.OBSERVE;
                const StepIcon = cfg.icon;
                const isActive = i === activeBlockIndex;
                return (<React.Fragment key={b.id || i}>
                  <button onClick={() => onSelectBlock(i)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all border ${isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}>
                    <span className="opacity-70 font-mono text-[10px]">{i + 1}.</span>
                    <StepIcon className="w-3.5 h-3.5"/>
                    <span>{b.title ? (b.title.length > 18 ? b.title.slice(0, 18) + '...' : b.title) : cfg.label}</span>
                    {b.evidence_role === 'MASTERY_EVIDENCE' && (<span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-amber-300' : 'bg-emerald-500'}`}/>)}
                  </button>
                  {i < blocks.length - 1 && (<span className="text-slate-300 text-xs font-mono shrink-0">➔</span>)}
                </React.Fragment>);
            })}
          </div>
        </div>)}

      {/* ── Pedagogical Sequence Timeline ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wider uppercase text-slate-500">
              Learning Sequence
            </span>
            <span className="text-xs font-bold text-slate-400">({blocks.length} steps)</span>
          </div>

          <div className="text-xs text-slate-400">Select a step to inspect technical properties</div>
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {blocks.map((b, idx) => {
            const isSelected = idx === activeBlockIndex;
            const config = stepTypeConfig[b.type] || stepTypeConfig.OBSERVE;
            const Icon = config.icon;
            const candlePayload = b.payload || { open: 100, high: 120, low: 90, close: 115 };
            const isBullish = (candlePayload.close ?? 100) >= (candlePayload.open ?? 100);
            return (<div key={b.id || idx} onClick={() => onSelectBlock(idx)} className={`group relative p-4 rounded-xl border transition-all cursor-pointer bg-white ${isSelected
                    ? 'border-blue-500 shadow-md ring-2 ring-blue-500/10'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
                <div className="flex items-start justify-between gap-4">
                  {/* Step Index & Badge */}
                  <div className="flex items-start gap-3.5 flex-1">
                    <span className="text-xs font-black text-slate-400 pt-1 shrink-0 font-mono">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold border ${config.color}`}>
                          <Icon className="w-3.5 h-3.5"/>
                          <span>{config.label}</span>
                        </span>

                        {b.evidence_role === 'MASTERY_EVIDENCE' && (<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Mastery Evidence
                          </span>)}

                        {b.source_citation?.provider && (<span className="text-[10px] text-slate-400 font-mono">
                            {b.source_citation.provider} · {b.source_citation.instrument}
                          </span>)}
                        
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                          {b.renderer || 'TEXT'}
                        </span>
                      </div>

                      {/* Step Title & Prompt (Inline Editable for rapid content flow) */}
                      <input type="text" value={b.title || ''} onChange={(e) => onUpdateBlock(idx, { ...b, title: e.target.value })} placeholder="Step Title (e.g. Upper Wick Price Discovery)" className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none"/>

                      <textarea rows={2} value={b.prompt || ''} onChange={(e) => onUpdateBlock(idx, { ...b, prompt: e.target.value })} placeholder="Prompt question or explanation prompt for learner..." className="w-full text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 rounded p-1.5 focus:outline-none resize-none"/>

                      {/* ── Live Candlestick Visualizer ── */}
                      {isSelected && b.renderer === 'CANDLESTICK' && (<div className="mt-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Interactive Candlestick Visualizer
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${isBullish ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {isBullish ? 'Bullish (Green)' : 'Bearish (Red)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="w-24 h-28 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center shrink-0 shadow-inner">
                              <svg viewBox="0 0 100 120" className="w-full h-full">
                                <line x1="50" y1="10" x2="50" y2="110" stroke={isBullish ? '#10B981' : '#EF4444'} strokeWidth="3"/>
                                <rect x="30" y={isBullish ? 35 : 35} width="40" height="50" fill={isBullish ? '#10B981' : '#EF4444'} rx="2"/>
                              </svg>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                              {['open', 'high', 'low', 'close'].map((key) => (<div key={key}>
                                  <label className="text-[10px] font-bold text-slate-500 block uppercase">{key}</label>
                                  <input type="number" value={candlePayload[key] ?? 100} onChange={(e) => onUpdateBlock(idx, {
                            ...b,
                            payload: { ...candlePayload, [key]: Number(e.target.value) },
                        })} className="w-full p-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded focus:border-blue-500 focus:outline-none"/>
                                </div>))}
                            </div>
                          </div>
                        </div>)}

                      {/* ── Inline Single Choice Options Editor ── */}
                      {isSelected && b.response_type === 'SINGLE_CHOICE' && (<div className="mt-3 p-3.5 rounded-lg bg-blue-50/50 border border-blue-100 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                              Multiple Choice Options & Answer Key
                            </span>
                            <button type="button" onClick={() => {
                        const existing = b.options || [];
                        const newOpt = {
                            id: `opt_${Date.now()}`,
                            text: `Option ${existing.length + 1}`,
                            is_correct: false,
                        };
                        onUpdateBlock(idx, { ...b, options: [...existing, newOpt] });
                    }} className="text-[11px] font-bold text-blue-700 hover:text-blue-800">
                              + Add Option
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            {(b.options || []).map((opt, optIdx) => (<div key={opt.id || optIdx} className="flex items-center gap-2">
                                <input type="radio" name={`correct_opt_${idx}`} checked={b.correct_option_id === opt.id || opt.is_correct} onChange={() => {
                            const updated = (b.options || []).map((o) => ({
                                ...o,
                                is_correct: o.id === opt.id,
                            }));
                            onUpdateBlock(idx, {
                                ...b,
                                options: updated,
                                correct_option_id: opt.id,
                            });
                        }} className="text-blue-600 focus:ring-blue-500"/>
                                <input type="text" value={opt.text} onChange={(e) => {
                            const updated = (b.options || []).map((o, i) => i === optIdx ? { ...o, text: e.target.value } : o);
                            onUpdateBlock(idx, { ...b, options: updated });
                        }} className="flex-1 p-1.5 text-xs bg-white border border-slate-200 rounded focus:border-blue-500 focus:outline-none"/>
                                <button type="button" onClick={() => {
                            const updated = (b.options || []).filter((_, i) => i !== optIdx);
                            onUpdateBlock(idx, { ...b, options: updated });
                        }} className="text-slate-400 hover:text-rose-600 text-xs px-1">
                                  ✕
                                </button>
                              </div>))}
                          </div>
                        </div>)}
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                    {onPreviewStep && (<button onClick={(e) => {
                        e.stopPropagation();
                        onPreviewStep(idx);
                    }} title="Preview this step" className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600">
                        <Play className="w-3.5 h-3.5"/>
                      </button>)}

                    <button onClick={(e) => {
                    e.stopPropagation();
                    onMoveBlock(idx, 'UP');
                }} disabled={idx === 0} title="Move Up" className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-20">
                      <ChevronUp className="w-3.5 h-3.5"/>
                    </button>

                    <button onClick={(e) => {
                    e.stopPropagation();
                    onMoveBlock(idx, 'DOWN');
                }} disabled={idx === blocks.length - 1} title="Move Down" className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-20">
                      <ChevronDown className="w-3.5 h-3.5"/>
                    </button>

                    <button onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateBlock(idx);
                }} title="Duplicate Step" className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800">
                      <Copy className="w-3.5 h-3.5"/>
                    </button>

                    <button onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBlock(idx);
                }} title="Delete Step" className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
              </div>);
        })}
        </div>

        {/* ── + Add Learning Step Menu ── */}
        <div className="pt-2">
          {!showAddMenu ? (<button onClick={() => setShowAddMenu(true)} className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-600 bg-white/60 hover:bg-blue-50/40 transition-all flex items-center justify-center gap-2">
              <Plus className="w-4 h-4"/>
              <span>Add Learning Step</span>
            </button>) : (<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Select Pedagogical Step Type
                </span>
                <button onClick={() => setShowAddMenu(false)} className="text-xs text-slate-400 hover:text-slate-700">
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                {
                    type: 'OBSERVE',
                    label: 'Observe',
                    desc: 'Examine visual chart or financial table',
                    icon: Eye,
                },
                {
                    type: 'PREDICT',
                    label: 'Predict',
                    desc: 'Forecast price or outcome before explaining',
                    icon: HelpCircle,
                },
                {
                    type: 'EXPLAIN',
                    label: 'Explain',
                    desc: 'Core intuition & causal mental model',
                    icon: Lightbulb,
                },
                {
                    type: 'PRACTICE',
                    label: 'Practice',
                    desc: 'Active retrieval check to reinforce understanding',
                    icon: Sliders,
                },
                {
                    type: 'MARKET_EXAMPLE',
                    label: 'Market Example',
                    desc: 'Historical real-world case study (NSE/BSE)',
                    icon: BarChart2,
                },
                {
                    type: 'MISCONCEPTION_CHECK',
                    label: 'Misconception Check',
                    desc: 'Address frequent beginner traps & errors',
                    icon: AlertTriangle,
                },
                {
                    type: 'APPLICATION',
                    label: 'Application',
                    desc: 'Scenario-based practical decision task',
                    icon: ArrowRight,
                },
                {
                    type: 'TRANSFER',
                    label: 'Transfer',
                    desc: 'Apply knowledge to novel asset or timeframe',
                    icon: Share2,
                },
            ].map((item) => {
                const Icon = item.icon;
                return (<button key={item.type} onClick={() => {
                        onAddBlock(item.type);
                        setShowAddMenu(false);
                    }} className="text-left p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all flex items-start gap-2.5 group">
                      <Icon className="w-4 h-4 text-slate-500 group-hover:text-blue-600 mt-0.5 shrink-0"/>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-500 leading-tight">
                          {item.desc}
                        </div>
                      </div>
                    </button>);
            })}
              </div>
            </div>)}
        </div>
      </div>
    </div>);
};
