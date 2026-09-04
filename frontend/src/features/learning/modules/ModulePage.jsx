import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, RefreshCw, Award, Layers, } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
export const ModulePage = () => {
    const { moduleSlug } = useParams();
    const navigate = useNavigate();
    const [moduleData, setModuleData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
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
                if (data.ordered_units && localCompleted.length > 0) {
                    let hasFoundNext = false;
                    data.ordered_units.forEach((u) => {
                        u.ordered_lessons.forEach((l) => {
                            if (l.status === 'COMPLETED' || localCompleted.includes(l.slug)) {
                                l.status = 'COMPLETED';
                                l.is_unlocked = true;
                            }
                            else if (!hasFoundNext) {
                                l.status = 'AVAILABLE';
                                l.is_unlocked = true;
                                hasFoundNext = true;
                            }
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
            console.error('Failed to load module data:', err);
            setError('Unable to load module. Please verify your connection or try again.');
        })
            .finally(() => {
            setIsLoading(false);
        });
    };
    useEffect(() => {
        loadModule();
    }, [moduleSlug]);
    if (isLoading) {
        return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
          <div className="h-4 w-36 bg-slate-200 rounded"/>
          <div className="h-12 w-2/3 bg-slate-200 rounded"/>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-32 bg-white border border-slate-200 rounded-xl"/>
              <div className="h-48 bg-white border border-slate-200 rounded-xl"/>
            </div>
            <div className="space-y-4">
              <div className="h-44 bg-white border border-slate-200 rounded-xl"/>
              <div className="h-44 bg-white border border-slate-200 rounded-xl"/>
            </div>
          </div>
        </div>
      </div>);
    }
    if (error || !moduleData) {
        return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-5 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5"/>
          </div>
          <h2 className="text-lg font-bold text-[#17202A]">Module Not Found</h2>
          <p className="text-xs sm:text-sm text-slate-600">{error || 'The requested curriculum module does not exist.'}</p>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={loadModule} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5"/>
              <span>Retry</span>
            </button>
            <button onClick={() => navigate('/learn')} className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer">
              Back to Learn Hub
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
    const badge = moduleData.badge || {
        id: `badge-${moduleData.slug}`,
        title: `${moduleData.title} Credential`,
        description: 'Capability credential for price action reading on unfamiliar charts.',
        status: 'LOCKED',
        credential_claim: 'Demonstrated verified application and active recall across all unit milestones.',
    };
    const totalUnits = moduleData.ordered_units?.length || 0;
    const totalLessons = progress.total_lessons || 0;
    const firstUnit = moduleData.ordered_units?.[0];
    const nextAvailableLesson = moduleData.ordered_units
        ?.flatMap((u) => u.ordered_lessons || [])
        ?.find((l) => l.is_unlocked && l.status !== 'COMPLETED') ||
        firstUnit?.ordered_lessons?.[0] ||
        null;
    return (<div className="min-h-screen bg-[#FBFBFA] text-[#17202A] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8 sm:space-y-10">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500 flex items-center gap-2">
          <button type="button" onClick={() => navigate('/learn')} className="hover:text-slate-900 transition-colors cursor-pointer">
            Learn
          </button>
          <span>/</span>
          <span className="text-slate-900 font-medium truncate">{moduleData.title}</span>
        </nav>

        {/* 1. Header Section */}
        <header className="space-y-3 sm:space-y-4 border-b border-[#E5E7EB] pb-8">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600"/>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              {moduleData.level || 'BEGINNER'} · FINANCIAL MARKETS
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-black text-[#17202A] tracking-tight">
              {moduleData.title}
            </h1>
            <p className="text-base sm:text-xl text-slate-600 leading-relaxed max-w-3xl font-normal">
              {moduleData.learner_goal || moduleData.description}
            </p>
            <div className="text-xs font-semibold text-slate-500 pt-1 flex flex-wrap items-center gap-3">
              <span>{totalUnits} {totalUnits === 1 ? 'Unit' : 'Units'}</span>
              <span>·</span>
              <span>{totalLessons} {totalLessons === 1 ? 'Lesson' : 'Lessons'}</span>
              <span>·</span>
              <span>~{moduleData.estimated_hours || 1.5} hours</span>
              <span>·</span>
              <span className="text-emerald-700 font-bold">Verified Credential</span>
            </div>
          </div>
        </header>

        {/* 2. Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Content Column (span 2) */}
          <div className="lg:col-span-2 space-y-10">
            {/* ABOUT THIS MODULE */}
            <section aria-labelledby="about-heading" className="space-y-4">
              <h2 id="about-heading" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                ABOUT THIS MODULE
              </h2>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                {moduleData.description}
              </p>
              {moduleData.why_this_matters && (<div className="border-l-2 border-slate-300 pl-4 py-2 bg-slate-50/50 rounded-r-lg">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Why this matters:
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 italic leading-relaxed">
                    {moduleData.why_this_matters}
                  </p>
                </div>)}
            </section>

            {/* WHAT YOU'LL LEARN */}
            {moduleData.learning_outcomes && moduleData.learning_outcomes.length > 0 && (<section aria-labelledby="outcomes-heading" className="space-y-4">
                <div className="space-y-1">
                  <h2 id="outcomes-heading" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    WHAT YOU&apos;LL LEARN
                  </h2>
                  <div className="text-xs text-slate-500">
                    What you&apos;ll be able to do:
                  </div>
                </div>
                <ul className="space-y-2.5">
                  {moduleData.learning_outcomes.map((outcome, idx) => (<li key={idx} className="text-xs sm:text-sm text-slate-700 flex items-start gap-3">
                      <span className="text-blue-600 font-bold mt-0.5">•</span>
                      <span className="leading-relaxed">{outcome}</span>
                    </li>))}
                </ul>
              </section>)}

            {/* SYLLABUS AT A GLANCE */}
            <section aria-labelledby="syllabus-heading" className="space-y-5 border-t border-[#E5E7EB] pt-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 id="syllabus-heading" className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600"/>
                    <span>SYLLABUS & CURRICULUM ARCHITECTURE</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    {totalUnits} structured {totalUnits === 1 ? 'unit' : 'units'} containing {totalLessons} interactive learning milestones.
                  </p>
                </div>

                <button type="button" onClick={() => navigate(`/learn/modules/${moduleData.slug}/units`)} className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer">
                  <span>View Units & Lessons</span>
                  <ArrowRight className="w-3.5 h-3.5"/>
                </button>
              </div>

              <div className="space-y-4">
                {moduleData.ordered_units?.map((unit, uIdx) => {
            const unitLessons = unit.ordered_lessons || [];
            return (<div key={unit.id} onClick={() => navigate(`/learn/modules/${moduleData.slug}/units`)} className="p-4 sm:p-5 rounded-xl border border-[#E5E7EB] bg-white hover:border-slate-400 transition-all cursor-pointer shadow-sm group">
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                            Unit {String(uIdx + 1).padStart(2, '0')}
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-[#17202A] group-hover:text-blue-600 transition-colors">
                            Unit {uIdx + 1}: {unit.title}
                          </h3>
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">
                          {unitLessons.length} {unitLessons.length === 1 ? 'lesson' : 'lessons'} · ~{unit.estimated_minutes || 20} mins
                        </span>
                      </div>

                      {unit.promised_capability && (<p className="text-xs text-slate-600 pl-8 pt-1.5 line-clamp-1">
                          <strong>Goal:</strong> {unit.promised_capability}
                        </p>)}

                      {/* Lesson Titles Preview */}
                      <div className="pl-8 pt-3 flex flex-wrap gap-2">
                        {unitLessons.map((l) => (<span key={l.id} className="inline-flex items-center text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                            {l.title}
                          </span>))}
                      </div>
                    </div>);
        })}
              </div>
            </section>

            {/* PREREQUISITES & AUDIENCE */}
            <section aria-labelledby="prereq-heading" className="space-y-2 text-xs text-slate-600 border-t border-[#E5E7EB] pt-6">
              <h2 id="prereq-heading" className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                PREREQUISITES & AUDIENCE
              </h2>
              <p className="leading-relaxed">
                {moduleData.prerequisites && moduleData.prerequisites.length > 0
            ? `Prerequisites: ${moduleData.prerequisites.join(', ')}`
            : 'Prerequisites: None. Zero prior trading or finance background required. Designed from first principles.'}
              </p>
            </section>
          </div>

          {/* Sidebar Column (span 1) */}
          <div className="space-y-6">
            {/* Primary Action Card: Start / Continue Learning */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {progress.completed_lessons > 0 ? 'CONTINUE LEARNING' : 'START LEARNING'}
                </div>
                <div className="text-base sm:text-lg font-bold text-[#17202A] leading-snug">
                  {nextAvailableLesson ? nextAvailableLesson.title : moduleData.title}
                </div>
                <p className="text-xs text-slate-600">
                  {progress.completed_lessons > 0
            ? 'Resume your learning progress in the units curriculum.'
            : `Begin Unit 1 with ${totalLessons} interactive lessons.`}
                </p>
              </div>

              {/* Progress Summary */}
              <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>Progress</span>
                <span className="font-bold text-slate-800">
                  {progress.completed_lessons} of {progress.total_lessons} ({progress.completion_pct}%)
                </span>
              </div>

              {/* High-Contrast Start Learning CTA */}
              <button type="button" onClick={() => navigate(`/learn/modules/${moduleData.slug}/units`)} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.99] focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all cursor-pointer shadow-md">
                <span>{progress.completed_lessons > 0 ? 'Continue Learning' : 'Start Learning'}</span>
                <ArrowRight className="w-4 h-4"/>
              </button>
            </div>

            {/* Course Specifications Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3.5 shadow-sm text-xs">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-2">
                COURSE SPECIFICATIONS
              </div>
              <div className="space-y-2.5 text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Curriculum Structure</span>
                  <span className="font-semibold text-slate-800">{totalUnits} Unit · {totalLessons} Lessons</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pacing</span>
                  <span className="font-semibold text-slate-800">Self-paced · ~5 min/lesson</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Passing Standard</span>
                  <span className="font-semibold text-slate-800">≥ {moduleData.challenge?.passing_score_pct || 80}% Accuracy</span>
                </div>
              </div>
            </div>

            {/* Capability Credential Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-slate-800">
                <Award className="w-4 h-4 text-blue-600"/>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  CAPABILITY BADGE
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#17202A]">
                {badge.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {badge.description}
              </p>
              <div className="text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <strong className="text-slate-700">Evidence Required: </strong>
                {badge.credential_claim}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
};
