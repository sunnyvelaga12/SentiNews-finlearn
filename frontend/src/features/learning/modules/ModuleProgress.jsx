import React from 'react';
import { Award, TrendingUp } from 'lucide-react';
export const ModuleProgress = ({ completedLessons, totalLessons, skillTier, badgeTitle = 'Module Badge', badgeStatus = 'NOT_EARNED', className = '', }) => {
    const percentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    return (<div className={`space-y-4 ${className}`}>
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-slate-400 block">Curriculum Completion</span>
          <div className="flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-bold text-white">
              {completedLessons} of {totalLessons} Lessons
            </span>
            <span className="text-cyan-400 font-mono text-xs">({percentage}%)</span>
          </div>
        </div>

        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-slate-400 block">Demonstrated Skill</span>
          <span className="text-base sm:text-lg font-bold text-amber-400 flex items-center gap-1.5 capitalize">
            <TrendingUp className="w-4 h-4 text-amber-400"/>
            {skillTier.replace('_', ' ').toLowerCase()}
          </span>
        </div>

        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-slate-400 block">Target Capability Badge</span>
          <span className="text-base sm:text-lg font-bold text-cyan-400 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-cyan-400"/>
            {badgeTitle}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800/60 h-2 rounded-full overflow-hidden">
        <div className="bg-cyan-400 h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.max(2, percentage)}%` }}/>
      </div>
    </div>);
};
