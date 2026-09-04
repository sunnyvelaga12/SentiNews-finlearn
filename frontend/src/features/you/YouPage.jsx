import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Award, Brain, Clock, CheckCircle2, Flame, Zap, Target, History, ShieldCheck, BookOpen, ArrowRight, RotateCcw, } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
export const YouPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(location.state?.tab || 'OVERVIEW');
    const [completedLessonSlugs, setCompletedLessonSlugs] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('sentinews_completed_lessons') || '[]');
        }
        catch {
            return [];
        }
    });
    const [isResetting, setIsResetting] = useState(false);
    const [concepts, setConcepts] = useState([
        { concept_slug: 'candlestick_intro', title: 'What is a Candlestick?', status: 'STRONG', mastery_percentage: 100 },
        { concept_slug: 'ohlc_anatomy', title: 'Open, High, Low & Close', status: 'GROWING', mastery_percentage: 65 },
        { concept_slug: 'wick_body_dynamics', title: 'Body & Shadow Dynamics', status: 'NEXT', mastery_percentage: 0 },
        { concept_slug: 'bullish_bearish_sentiment', title: 'Bullish vs Bearish Anatomy', status: 'NEXT', mastery_percentage: 0 },
        { concept_slug: 'concept_bid_ask_spread', title: 'Order Matching & Bid-Ask Spread', status: 'STRONG', mastery_percentage: 85 },
    ]);
    // Sync server-authoritative module progression on mount
    useEffect(() => {
        apiClient('/api/v1/curriculum/modules/candlestick-foundations')
            .then((data) => {
            if (data.ordered_units) {
                const serverCompleted = data.ordered_units
                    .flatMap((u) => u.ordered_lessons || [])
                    .filter((l) => l.status === 'COMPLETED')
                    .map((l) => l.slug);
                if (serverCompleted.length > 0) {
                    setCompletedLessonSlugs((prev) => {
                        const combined = Array.from(new Set([...prev, ...serverCompleted]));
                        try {
                            localStorage.setItem('sentinews_completed_lessons', JSON.stringify(combined));
                        }
                        catch (e) { }
                        return combined;
                    });
                }
            }
        })
            .catch(() => {
            // Fallback to local cache
        });
        apiClient('/api/v1/mastery')
            .then((data) => {
            if (data.mastery && Array.isArray(data.mastery) && data.mastery.length > 0) {
                setConcepts(data.mastery.map((m) => ({
                    concept_slug: m.concept_slug,
                    title: m.concept_title,
                    status: m.mastery_score >= 8000 ? 'STRONG' : m.mastery_score > 0 ? 'GROWING' : 'NEXT',
                    mastery_percentage: Math.round(m.mastery_score / 100),
                })));
            }
        })
            .catch(() => {
            // Fallback default state active
        });
    }, []);
    const completedCount = completedLessonSlugs.length;
    const totalLessons = 4;
    const completionPct = Math.min(100, Math.round((completedCount / totalLessons) * 100));
    const handleResetProgress = async () => {
        if (isResetting)
            return;
        setIsResetting(true);
        try {
            await apiClient('/api/v1/curriculum/progress/reset', { method: 'POST' });
        }
        catch (e) {
            console.warn('Backend reset fallback:', e);
        }
        finally {
            localStorage.removeItem('sentinews_completed_lessons');
            setCompletedLessonSlugs([]);
            setIsResetting(false);
        }
    };
    const getNextActionDetails = () => {
        if (completedCount === 0) {
            return {
                title: 'Lesson 1: What is a Candlestick?',
                ctaLabel: 'Start Lesson 1 →',
                url: '/learn/modules/candlestick-foundations/units',
            };
        }
        if (completedCount === 1) {
            return {
                title: 'Lesson 2: Open, High, Low & Close',
                ctaLabel: 'Continue to Lesson 2 →',
                url: '/learn/modules/candlestick-foundations/units',
            };
        }
        if (completedCount === 2) {
            return {
                title: 'Lesson 3: Body & Shadow Dynamics',
                ctaLabel: 'Continue to Lesson 3 →',
                url: '/learn/modules/candlestick-foundations/units',
            };
        }
        return {
            title: 'Candlestick Foundations Capstone',
            ctaLabel: 'Take Capstone Challenge →',
            url: '/learn/modules/candlestick-foundations',
        };
    };
    const nextAction = getNextActionDetails();
    return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        {/* 1. Learner Profile Header */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-black text-2xl shadow-sm">
                S
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#17202A] tracking-tight">Sunny</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                    Active Learner
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600">
                  Financial Explorer · Technical Analysis & Market Foundations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-600 fill-amber-500"/>
                <span>{completedCount > 0 ? '1 Day Streak' : '0 Day Streak'}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-600"/>
                <span>{completedCount * 80 || 0} XP</span>
              </div>
            </div>
          </div>

          {/* 7-Day Activity Heatmap */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
              <span>Weekly Learning Momentum</span>
              <span className="text-blue-600 font-bold">Goal: 5 days/week</span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, dIdx) => {
            const isToday = dIdx === 3;
            const isComplete = completedCount > 0 && dIdx <= 3;
            return (<div key={dIdx} className={`py-2 rounded-xl text-center text-xs font-bold border transition-all ${isToday
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-100'
                    : isComplete
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    <div className="text-[10px] uppercase font-mono">{day}</div>
                    <div className="mt-0.5">{isComplete ? '✓' : '·'}</div>
                  </div>);
        })}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Lessons Completed</div>
              <div className="text-lg font-black text-slate-900 font-mono mt-0.5">{completedCount} / {totalLessons}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Concepts Mastered</div>
              <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">{completedCount >= 1 ? '2' : '0'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Application Tier</div>
              <div className="text-xs font-black text-blue-700 uppercase tracking-wider mt-1.5">
                {completedCount >= 2 ? 'Competent' : completedCount >= 1 ? 'Developing' : 'Beginning'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Next Target</div>
              <div className="text-xs font-black text-amber-700 uppercase tracking-wider mt-1.5">Candlestick Reader</div>
            </div>
          </div>
        </div>

        {/* 2. Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6 text-xs sm:text-sm font-bold">
          {[
            { id: 'OVERVIEW', label: 'Overview', icon: BookOpen },
            { id: 'KNOWLEDGE_MAP', label: 'Concept Mastery', icon: Brain },
            { id: 'ACHIEVEMENTS', label: 'Verified Badges', icon: Award },
            { id: 'HISTORY', label: 'Activity History', icon: History },
        ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3.5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${isActive
                    ? 'border-slate-900 text-slate-900 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}/>
                <span>{tab.label}</span>
              </button>);
        })}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'OVERVIEW' && (<div className="space-y-6 animate-fade-in">
            <Card className="p-6 bg-white border border-slate-200 rounded-2xl space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#17202A]">Current Learning Focus</h3>
                  <p className="text-xs text-slate-500">Candlestick Foundations · Unit 1: Understanding Candle Mechanics</p>
                </div>
                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                  {completionPct}% Complete
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-slate-900 h-full rounded-full transition-all duration-500" style={{ width: `${completionPct}%` }}/>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="text-xs text-slate-600">
                  <strong>Recommended Next Step:</strong> {nextAction.title}
                </div>
                <button onClick={() => navigate(nextAction.url)} className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <span>{nextAction.ctaLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5"/>
                </button>
              </div>
            </Card>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <span className="text-xs text-slate-500">Testing Tools</span>
              <button onClick={handleResetProgress} disabled={isResetting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors cursor-pointer">
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`}/>
                <span>{isResetting ? 'Resetting...' : 'Reset Progress (QA Test)'}</span>
              </button>
            </div>
          </div>)}

        {/* Tab 2: Concept Mastery */}
        {activeTab === 'KNOWLEDGE_MAP' && (<div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {concepts.map((c) => (<div key={c.concept_slug} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-[#17202A]">{c.title}</h4>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${c.status === 'STRONG'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : c.status === 'GROWING'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-500">Mastery Level</span>
                      <span className="font-bold text-slate-800">{c.mastery_percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${c.status === 'STRONG' ? 'bg-emerald-600' : 'bg-blue-600'}`} style={{ width: `${c.mastery_percentage}%` }}/>
                    </div>
                  </div>
                </div>))}
            </div>
          </div>)}

        {/* Tab 3: Verified Badges */}
        {activeTab === 'ACHIEVEMENTS' && (<div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${completedCount >= 4
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : completedCount >= 1
                    ? 'bg-blue-50 text-blue-600 border border-blue-100'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                  <Award className="w-6 h-6 stroke-[2.5]"/>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-[#17202A]">Candlestick Reader</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${completedCount >= 4
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : completedCount >= 1
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {completedCount >= 4 ? 'EARNED' : completedCount >= 1 ? 'IN PROGRESS' : 'LOCKED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Verified capability to identify OHLC price coordinates and explain intraperiod conviction without memorizing rigid patterns.
                  </p>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-2 border-t border-slate-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600"/>
                  <span>SEBI Investor Education Verified Credential</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 opacity-75">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center">
                  <Target className="w-6 h-6"/>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-slate-600">Order Book Practitioner</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      LOCKED
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Demonstrate mastery of bid-ask spread mechanics, liquidity depth ladders, and slippage calculations.
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-100">
                  <Clock className="w-3.5 h-3.5"/>
                  <span>Complete Market Basics module to unlock</span>
                </div>
              </div>
            </div>
          </div>)}

        {/* Tab 4: Activity History */}
        {activeTab === 'HISTORY' && (<div className="space-y-4 animate-fade-in">
            <Card className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
              <h3 className="text-base font-bold text-[#17202A]">Recent Milestone History</h3>
              {completedCount === 0 ? (<div className="text-center py-8 space-y-3">
                  <p className="text-xs text-slate-500">No completed milestones yet. Complete Lesson 1 to earn your first verified capability!</p>
                  <button onClick={() => navigate('/learn/modules/candlestick-foundations/units')} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors">
                    Start Lesson 1 →
                  </button>
                </div>) : (<div className="space-y-3">
                  {completedLessonSlugs.map((slug, idx) => {
                    const isLesson1 = slug.includes('what-is-a-candlestick') || slug === 'what-is-a-candlestick';
                    const title = isLesson1
                        ? 'Lesson 1: What is a Candlestick?'
                        : slug.includes('open-high-low-close')
                            ? 'Lesson 2: Open, High, Low & Close'
                            : `Lesson ${idx + 1}: ${slug}`;
                    return (<div key={slug} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
                          </div>
                          <div>
                            <div className="font-bold text-[#17202A]">{title}</div>
                            <div className="text-slate-500 text-[11px]">Candlestick Foundations · Completed</div>
                          </div>
                        </div>
                        <span className="font-mono text-slate-500 text-[11px]">Verified</span>
                      </div>);
                })}
                </div>)}
            </Card>
          </div>)}
      </div>
    </div>);
};
