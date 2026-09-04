import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Clock, BookOpen, Sparkles, Sliders, Target, ChevronDown, ChevronUp, Shield, Layers, Lock, } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
export const LessonOverviewPage = () => {
    const { lessonSlug } = useParams();
    const navigate = useNavigate();
    const [lesson, setLesson] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState(null);
    const [isGoDeeperOpen, setIsGoDeeperOpen] = useState(false);
    useEffect(() => {
        let isMounted = true;
        async function loadLesson() {
            if (!lessonSlug)
                return;
            setIsLoading(true);
            setError(null);
            try {
                const data = await apiClient(`/api/v1/curriculum/lessons/${lessonSlug}`);
                if (isMounted) {
                    setLesson(data);
                    setIsLoading(false);
                }
            }
            catch (err) {
                console.warn('Failed to load lesson from API, falling back to canonical defaults:', err);
                if (isMounted) {
                    const isOpenHighLowClose = lessonSlug?.includes('open-high-low-close');
                    setLesson({
                        id: isOpenHighLowClose ? 'lesson-2' : 'lesson-1',
                        slug: lessonSlug || 'what-is-a-candlestick',
                        title: isOpenHighLowClose
                            ? 'Lesson 2: Open, High, Low & Close'
                            : 'Lesson 1: What is a Candlestick?',
                        duration_minutes: 5,
                        learning_objectives: isOpenHighLowClose
                            ? [
                                'Identify the 4 crucial price points (OHLC) on any candle',
                                'Explain the intraperiod auction between buyers and sellers',
                                'Interpret upper and lower wicks as period price discovery and rejection',
                            ]
                            : [
                                'Identify the 4 crucial price points (OHLC) that construct every candle',
                                'Distinguish the colored real body from the thin upper and lower shadows',
                                'Interpret price exploration vs net period closing change',
                            ],
                        is_unlocked: true,
                        status: 'AVAILABLE',
                    });
                    setIsLoading(false);
                }
            }
        }
        loadLesson();
        return () => {
            isMounted = false;
        };
    }, [lessonSlug]);
    const handleStartSession = async () => {
        if (!lesson || isStarting)
            return;
        setIsStarting(true);
        try {
            const res = await apiClient('/api/v1/learning/sessions', {
                method: 'POST',
                body: JSON.stringify({ mode: 'DEFAULT', lesson_slug: lesson.slug }),
            });
            navigate(`/learn/sessions/${res.session_id}`);
        }
        catch (err) {
            console.warn('Using fallback local session navigation:', err);
            navigate('/learn/sessions/active');
        }
        finally {
            setIsStarting(false);
        }
    };
    if (isLoading) {
        return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-sm font-semibold text-slate-500">Loading lesson overview...</p>
        </div>
      </div>);
    }
    if (error || !lesson) {
        return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
            <Lock className="w-6 h-6"/>
          </div>
          <h2 className="text-xl font-bold text-[#17202A]">Lesson Locked</h2>
          <p className="text-sm text-slate-600">{error || 'Complete preceding lessons to unlock.'}</p>
          <button onClick={() => navigate('/learn')} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer">
            Back to Curriculum
          </button>
        </div>
      </div>);
    }
    return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
        {/* Back Link */}
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4"/> Back to Units & Lessons
        </button>

        {/* Hero Briefing Layout */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Interactive Lesson · Beginner
            </span>
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-blue-600"/> ~{lesson.duration_minutes || 5} mins
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-[#17202A] tracking-tight">
              {lesson.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              A candlestick is a compact summary of how price moved during a single period.
            </p>
          </div>

          {/* Structured Pedagogical Briefing: WHY / WHAT / DO / PROVE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* WHY */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5"/> WHY THIS MATTERS
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                A market produces lots of price changes. A candlestick gives you a simple way to summarize what happened during one period.
              </p>
            </div>

            {/* WHAT */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5"/> WHAT YOU'LL LEARN
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                You'll understand: <strong className="text-slate-900">Open</strong> · <strong className="text-slate-900">High</strong> · <strong className="text-slate-900">Low</strong> · <strong className="text-slate-900">Close</strong>, plus real body and shadows.
              </p>
            </div>

            {/* DO */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5"/> WHAT YOU'LL DO
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                You'll directly manipulate a live candle slider to see how changing Close transforms candle color and body.
              </p>
            </div>

            {/* PROVE */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5"/> WHAT YOU'LL PROVE
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                After this lesson, you will be able to: Identify the 4 price points (OHLC) and explain where price closed relative to where it opened on an unfamiliar candle.
              </p>
            </div>
          </div>

          {/* You will encounter preview */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              You will encounter:
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 font-medium">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">👁 Visual Observe</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">🧠 Prediction</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">🎯 Practice Sliders</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">📊 Market Example</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">⚡ Misconception Check</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">🚀 Transfer Scenario</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button type="button" disabled={!lesson.is_unlocked || isStarting} onClick={handleStartSession} className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer">
              {isStarting ? (<>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  <span>PREPARING LEARNING CANVAS...</span>
                </>) : (<>
                  <span>START LEARNING</span>
                  <ArrowRight className="w-4 h-4"/>
                </>)}
            </button>
          </div>
        </div>

        {/* Go Deeper Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
          <button type="button" onClick={() => setIsGoDeeperOpen(!isGoDeeperOpen)} className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                <BookOpen className="w-4 h-4 text-blue-600"/>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#17202A]">Go Deeper</h3>
                <p className="text-xs text-slate-500">OHLC reference, market session details & technical definitions</p>
              </div>
            </div>
            {isGoDeeperOpen ? (<ChevronUp className="w-5 h-5 text-slate-500"/>) : (<ChevronDown className="w-5 h-5 text-slate-500"/>)}
          </button>

          {isGoDeeperOpen && (<div className="p-6 pt-0 border-t border-slate-100 space-y-6 text-xs sm:text-sm text-slate-600 leading-relaxed animate-fade-in">
              <div className="space-y-2">
                <h4 className="font-bold text-[#17202A] text-sm flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-600"/>
                  The Four Cardinal Price Points
                </h4>
                <p>
                  Every Japanese candlestick is forged from four discrete values recorded during an agreed time window (for example: 1 minute, 5 minutes, 1 hour, or 1 daily trading session):
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li><strong className="text-slate-900">Open:</strong> The price at which the very first transaction executed when the session opened.</li>
                  <li><strong className="text-slate-900">High:</strong> The absolute highest transaction price traded by any buyer and seller during that interval.</li>
                  <li><strong className="text-slate-900">Low:</strong> The absolute lowest transaction price traded during that interval.</li>
                  <li><strong className="text-slate-900">Close:</strong> The final transaction price recorded at the exact moment the session bell rang.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#17202A] text-sm flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600"/>
                  Real Body vs Shadows (Wicks)
                </h4>
                <p>
                  The rectangular colored zone is termed the <strong>Real Body</strong>. It visualizes the net difference between Open and Close.
                  The thin lines protruding from the body are called <strong>Shadows</strong> or <strong>Wicks</strong>. They reveal intraperiod price exploration where market participants tested extreme price levels before supply or demand pushed the price back toward the center.
                </p>
              </div>
            </div>)}
        </div>
      </div>
    </div>);
};
