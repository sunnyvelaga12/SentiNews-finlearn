import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Lock, ArrowRight, Clock, PlayCircle } from 'lucide-react';
export const LessonList = ({ lessons }) => {
    const navigate = useNavigate();
    const handleOpenLesson = (lesson) => {
        if (lesson.is_unlocked) {
            navigate(`/learn/lessons/${lesson.slug}`);
        }
    };
    return (<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {lessons.map((lesson, index) => {
            const isUnlocked = lesson.is_unlocked;
            const isCompleted = lesson.status === 'COMPLETED';
            const isNextAction = isUnlocked && !isCompleted;
            return (<div key={lesson.id} onClick={() => handleOpenLesson(lesson)} className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${isNextAction
                    ? 'bg-gradient-to-br from-slate-900 to-sky-950/40 border-sky-500/40 hover:border-sky-400 cursor-pointer shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/20'
                    : isCompleted
                        ? 'bg-slate-900/80 border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer'
                        : 'bg-slate-950/60 border-slate-800/60 opacity-60 cursor-not-allowed'}`} role="button" aria-disabled={!isUnlocked} aria-label={`${lesson.title} - ${isCompleted ? 'Completed' : isUnlocked ? 'Available' : 'Locked'}`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-mono font-bold text-sky-400">
                  Lesson {index + 1}
                </span>

                {isCompleted ? (<span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400"/> Completed
                  </span>) : isNextAction ? (<span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-sky-300 bg-sky-500/20 px-2.5 py-0.5 rounded-full border border-sky-400/40 shadow-sm animate-pulse">
                    <PlayCircle className="w-3 h-3 text-sky-400"/> Continue Here
                  </span>) : (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                    <Lock className="w-3 h-3"/> Locked
                  </span>)}
              </div>

              <h4 className="font-bold text-white text-base leading-snug">{lesson.title}</h4>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {lesson.why_this_matters || (lesson.learning_objectives && lesson.learning_objectives[0])}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-3 mt-4">
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5"/> ~{lesson.duration_minutes || 5} mins
              </span>

              {isUnlocked ? (<span className={`font-bold flex items-center gap-1 ${isNextAction ? 'text-sky-400' : 'text-slate-400'}`}>
                  {isCompleted ? 'Review' : 'Start'} <ArrowRight className="w-3.5 h-3.5"/>
                </span>) : (<span className="text-slate-600 text-[11px] italic truncate max-w-[160px]">
                  {lesson.lock_reason || 'Prerequisite required'}
                </span>)}
            </div>
          </div>);
        })}
    </div>);
};
