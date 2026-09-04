import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
export const ModuleCard = ({ module, isHero = false }) => {
    const navigate = useNavigate();
    const progress = module.progress || {
        completed_lessons: 0,
        total_lessons: module.total_lessons,
        mastered_concepts: 0,
        total_concepts: 4,
        skill_tier: 'DEVELOPING',
        application_tier: 'DEVELOPING',
        transfer_tier: 'BEGINNING',
        completion_pct: 0,
    };
    const isCompleted = progress.completed_lessons > 0 && progress.completed_lessons >= progress.total_lessons;
    const isStarted = progress.completed_lessons > 0;
    const handleOpenModule = () => {
        navigate(`/learn/modules/${module.slug}`);
    };
    if (isHero) {
        return (<div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Sparkles className="w-3.5 h-3.5 text-blue-600"/>
                Featured Curriculum
              </span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {module.total_units} Units • {module.total_lessons} Lessons
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-[#17202A] tracking-tight">
              {module.title}
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed">
              {module.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"/>
                <span>Level: {module.level}</span>
              </div>
              <div>•</div>
              <div>Progress: {progress.completed_lessons} of {progress.total_lessons} Lessons</div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-start md:items-end justify-center space-y-3">
            <button onClick={handleOpenModule} data-testid={`module-card-${module.slug}`} className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2 cursor-pointer">
              <span>{isStarted ? 'Continue Learning' : 'Start Learning'}</span>
              <ArrowRight className="w-4 h-4"/>
            </button>
            <span className="text-xs text-slate-500">
              Free • Zero Setup Required
            </span>
          </div>
        </div>
      </div>);
    }
    return (<div onClick={handleOpenModule} data-testid={`module-card-${module.slug}`} className="bg-white border border-slate-200 hover:border-slate-400 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group" role="article" aria-label={`Module: ${module.title}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="uppercase tracking-wider font-bold text-blue-600">
            {module.level}
          </span>
          <span>{module.total_units} Units • {module.total_lessons} Lessons</span>
        </div>

        <h3 className="text-xl font-bold text-[#17202A] group-hover:text-blue-600 transition-colors">
          {module.title}
        </h3>

        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {module.description}
        </p>
      </div>

      <div className="pt-4 border-t border-slate-100 space-y-3">
        {/* Progress track */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              {progress.completed_lessons} of {progress.total_lessons} Complete
            </span>
            <span className="text-slate-900 font-bold font-mono">
              {progress.completion_pct}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-slate-900 h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(4, progress.completion_pct)}%` }}/>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span className="capitalize">{progress.skill_tier?.replace('_', ' ').toLowerCase()}</span>
          <span className="text-blue-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            View Module <ArrowRight className="w-3.5 h-3.5"/>
          </span>
        </div>
      </div>
    </div>);
};
