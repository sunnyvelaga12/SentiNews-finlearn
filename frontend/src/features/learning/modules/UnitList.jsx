import React from 'react';
import { Lock, Clock, Target } from 'lucide-react';
import { LessonList } from './LessonList';
export const UnitList = ({ units }) => {
    return (<div className="space-y-8">
      {units.map((unit, uIdx) => {
            // Dev & testing phase: unlock all units
            const isUnlocked = true;
            const lessons = unit.ordered_lessons || [];
            const totalDuration = unit.estimated_minutes || lessons.reduce((acc, l) => acc + (l.duration_minutes || 5), 0);
            return (<section key={unit.id} className="space-y-5 rounded-3xl p-6 sm:p-8 border transition-all bg-slate-900/60 border-slate-800" aria-labelledby={`unit-heading-${unit.id}`}>
            {/* Unit Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="space-y-1.5">
                <h3 id={`unit-heading-${unit.id}`} className="text-xl sm:text-2xl font-black text-white">
                  Unit {uIdx + 1}: {unit.title}
                </h3>
                {unit.promised_capability && (<p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-400 shrink-0"/>
                    <span>Goal: {unit.promised_capability}</span>
                  </p>)}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5"/> {lessons.length} Lessons · ~{totalDuration} mins
                </span>
                {!isUnlocked && (<span className="inline-flex items-center gap-1 text-slate-500 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                    <Lock className="w-3 h-3"/> Locked
                  </span>)}
              </div>
            </div>

            {/* Embedded Lessons Grid */}
            {isUnlocked ? (<LessonList lessons={lessons}/>) : (<div className="py-6 text-center text-xs text-slate-500 italic">
                Complete prior unit milestones to unlock these lessons.
              </div>)}
          </section>);
        })}
    </div>);
};
