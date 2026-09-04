import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock, CheckCircle2, Clock, Target, AlertCircle, RefreshCw, Layers, } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { telemetry } from '../../../services/telemetry';
export const ModuleUnitsPage = () => {
    const { moduleSlug } = useParams();
    const navigate = useNavigate();
    const [moduleData, setModuleData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStartingLessonId, setIsStartingLessonId] = useState(null);
    const [error, setError] = useState(null);
    const loadModule = () => {
        if (!moduleSlug)
            return;
        setIsLoading(true);
        setError(null);
        apiClient(`/api/v1/curriculum/modules/${moduleSlug}`)
            .then((data) => {
            try {
                const localCompleted = JSON.parse(localStorage.getItem('sentinews_completed_lessons') || '[]');
                if (data.ordered_units) {
                    data.ordered_units.forEach((u) => {
                        u.ordered_lessons.forEach((l) => {
                            if (l.status === 'COMPLETED' || localCompleted.includes(l.slug)) {
                                l.status = 'COMPLETED';
                            }
                            else {
                                l.status = 'AVAILABLE';
                            }
                            // Dev & testing phase: all lessons are unlocked
                            l.is_unlocked = true;
                        });
                    });
                    const allLessons = data.ordered_units.flatMap((u) => u.ordered_lessons);
                    const completedCount = allLessons.filter((l) => l.status === 'COMPLETED').length;
                    if (data.progress) {
                        data.progress.completed_lessons = completedCount;
                        data.progress.completion_pct = Math.round((completedCount / (allLessons.length || 1)) * 100);
                    }
                }
            }
            catch (e) {
                // Fallback
            }
            setModuleData(data);
        })
            .catch((err) => {
            console.error('Failed to load module units:', err);
            setError('Unable to load curriculum units. Please verify your connection or try again.');
        })
            .finally(() => {
            setIsLoading(false);
        });
    };
    useEffect(() => {
        loadModule();
    }, [moduleSlug]);
    const handleLaunchLesson = async (lesson) => {
        if (isStartingLessonId)
            return;
        setIsStartingLessonId(lesson.id);
        try {
            telemetry.track('lesson_session_start_clicked', {
                lessonId: lesson.id,
                lessonSlug: lesson.slug,
                moduleSlug,
            });
            const sessionData = await apiClient('/api/v1/learning/sessions', {
                method: 'POST',
                body: JSON.stringify({
                    mode: 'DEFAULT',
                    lesson_slug: lesson.slug,
                }),
            });
            navigate(`/learn/sessions/${sessionData.session_id}`, {
                state: {
                    lessonSlug: lesson.slug,
                    lessonTitle: lesson.title,
                    moduleSlug: moduleData?.slug || moduleSlug,
                    moduleTitle: moduleData?.title || 'Module Overview',
                    cards: lesson.cards,
                },
            });
        }
        catch (err) {
            console.warn('Backend session creation fallback:', err);
            navigate(`/learn/sessions/active`, {
                state: {
                    lessonSlug: lesson.slug,
                    lessonTitle: lesson.title,
                    moduleSlug: moduleData?.slug || moduleSlug,
                    moduleTitle: moduleData?.title || 'Module Overview',
                    cards: lesson.cards,
                },
            });
        }
        finally {
            setIsStartingLessonId(null);
        }
    };
    if (isLoading) {
        return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
          <div className="h-4 w-48 bg-slate-200 rounded"/>
          <div className="h-10 w-2/3 bg-slate-200 rounded"/>
          <div className="h-20 bg-white border border-[#E5E7EB] rounded-2xl"/>
          <div className="space-y-4 pt-4">
            <div className="h-44 bg-white border border-[#E5E7EB] rounded-2xl"/>
            <div className="h-44 bg-white border border-[#E5E7EB] rounded-2xl"/>
          </div>
        </div>
      </div>);
    }
    if (error || !moduleData) {
        return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-5 bg-white p-8 rounded-2xl border border-[#E5E7EB] shadow-sm">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5"/>
          </div>
          <h2 className="text-lg font-bold text-[#17202A]">Units Not Found</h2>
          <p className="text-xs sm:text-sm text-slate-600">{error || 'Unable to display module units.'}</p>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={loadModule} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5"/>
              <span>Retry</span>
            </button>
            <button onClick={() => navigate(`/learn/modules/${moduleSlug}`)} className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer">
              Back to Overview
            </button>
          </div>
        </div>
      </div>);
    }
    const progress = moduleData.progress || {
        completed_lessons: 0,
        total_lessons: 1,
        mastered_concepts: 0,
        total_concepts: 1,
        application_tier: 'BEGINNING',
        transfer_tier: 'BEGINNING',
        completion_pct: 0,
    };
    const totalUnits = moduleData.ordered_units?.length || 0;
    const totalLessons = progress.total_lessons || 0;
    return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="text-xs text-slate-500 flex items-center gap-2">
            <button type="button" onClick={() => navigate('/learn')} className="hover:text-slate-900 transition-colors cursor-pointer">
              Learn
            </button>
            <span>/</span>
            <button type="button" onClick={() => navigate(`/learn/modules/${moduleData.slug}`)} className="hover:text-slate-900 transition-colors cursor-pointer truncate max-w-[200px]">
              {moduleData.title}
            </button>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Units & Lessons</span>
          </nav>

          <button type="button" onClick={() => navigate(`/learn/modules/${moduleData.slug}`)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer self-start sm:self-auto">
            <ArrowLeft className="w-3.5 h-3.5"/>
            <span>Module Briefing</span>
          </button>
        </div>

        {/* Header Banner */}
        <header className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600"/>
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  {moduleData.level || 'BEGINNER'} · CURRICULUM ROADMAP
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-[#17202A] tracking-tight">
                {moduleData.title}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl font-normal">
                {moduleData.learner_goal || moduleData.description}
              </p>
            </div>

            <div className="shrink-0 bg-slate-50 border border-slate-200/80 rounded-xl p-3 sm:p-4 text-center min-w-[130px]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Overall Progress
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#17202A] pt-0.5">
                {progress.completion_pct}%
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {progress.completed_lessons} of {totalLessons} Lessons
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.max(progress.completion_pct > 0 ? 3 : 0, progress.completion_pct)}%` }}/>
            </div>
          </div>
        </header>

        {/* Units and Lessons Container */}
        <main className="space-y-8">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600"/>
              <span>UNITS IN THIS MODULE ({totalUnits})</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">Select a lesson to begin learning</span>
          </div>

          <div className="space-y-8">
            {moduleData.ordered_units?.map((unit, uIdx) => {
            const unitNum = String(uIdx + 1).padStart(2, '0');
            const lessons = unit.ordered_lessons || [];
            const isUnitUnlocked = true;
            const completedInUnit = lessons.filter((l) => l.status === 'COMPLETED').length;
            return (<section key={unit.id} aria-labelledby={`unit-title-${unit.id}`} className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
                  {/* Unit Title and Meta */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          Unit {unitNum}
                        </span>
                      </div>
                      <h3 id={`unit-title-${unit.id}`} className="text-lg sm:text-xl font-bold text-[#17202A]">
                        {unit.title}
                      </h3>
                      {unit.promised_capability && (<p className="text-xs sm:text-sm text-slate-600 leading-relaxed flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-emerald-600 shrink-0"/>
                          <span><strong>Promised Capability:</strong> {unit.promised_capability}</span>
                        </p>)}
                    </div>

                    <div className="text-xs text-slate-500 shrink-0 sm:text-right space-y-0.5">
                      <div className="font-semibold text-slate-700">
                        {completedInUnit} of {lessons.length} Completed
                      </div>
                      <div className="text-[11px] text-slate-400">
                        ~{unit.estimated_minutes || lessons.length * 5} mins total
                      </div>
                    </div>
                  </div>

                  {/* Lessons Grid */}
                  <div className="space-y-3">
                    {lessons.map((lesson, lIdx) => {
                    const isCompleted = lesson.status === 'COMPLETED';
                    const isNextAction = !isCompleted;
                    const isLocked = false;
                    const isLaunching = isStartingLessonId === lesson.id;
                    return (<div key={lesson.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${isNextAction
                            ? 'bg-blue-50/40 border-blue-200 hover:border-blue-400 shadow-sm'
                            : isCompleted
                                ? 'bg-emerald-50/20 border-slate-200 hover:border-slate-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                          <div className="flex items-start gap-3.5">
                            <span className="font-mono text-xs font-bold text-slate-400 pt-0.5 w-5">
                              {String(lIdx + 1).padStart(2, '0')}
                            </span>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className={`text-sm sm:text-base font-bold ${isLocked ? 'text-slate-400' : 'text-[#17202A]'}`}>
                                  {lesson.title}
                                </h4>
                                {isCompleted && (<span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600"/> Completed
                                  </span>)}
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2 max-w-xl leading-relaxed">
                                {lesson.why_this_matters ||
                            (lesson.learning_objectives && lesson.learning_objectives[0]) ||
                            'Explore core mechanisms through interactive observation and prediction.'}
                              </p>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400"/> ~{lesson.duration_minutes || 5} mins
                                </span>
                                {isLocked && lesson.lock_reason && (<span className="text-slate-500 italic">
                                    · Prerequisite: {lesson.lock_reason}
                                  </span>)}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0 self-end sm:self-center">
                            <button type="button" disabled={isLaunching} onClick={() => handleLaunchLesson(lesson)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm ${isNextAction
                                ? 'bg-slate-900 hover:bg-slate-800 text-white hover:scale-[1.01] active:scale-[0.99]'
                                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'}`}>
                                {isLaunching ? (<>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                                    <span>Opening...</span>
                                  </>) : isNextAction ? (<>
                                    <span>Start Lesson</span>
                                    <ArrowRight className="w-3.5 h-3.5"/>
                                  </>) : (<>
                                    <span>Review Lesson</span>
                                    <ArrowRight className="w-3.5 h-3.5"/>
                                  </>)}
                            </button>
                          </div>
                        </div>);
                })}
                  </div>
                </section>);
        })}
          </div>
        </main>
      </div>
    </div>);
};
