import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { apiClient } from '../../services/apiClient';
import { ArrowLeft, Clock, BookOpen, Target, Sparkles, CheckCircle2 } from 'lucide-react';
export const LessonPage = () => {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    const [lesson, setLesson] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        if (!lessonId)
            return;
        apiClient(`/api/v1/lessons/by-slug/${lessonId}`)
            .then((data) => {
            if (data) {
                setLesson(data);
            }
        })
            .catch(() => {
            // Fallback default info for offline/demo development
            setLesson({
                id: 'demo-lesson',
                slug: lessonId,
                domain: 'personal_finance',
                level: 'BEGINNER',
                title: lessonId === 'why-money-loses-value' ? 'Why Does Money Lose Value?' : 'What Is Money?',
                duration_minutes: 4,
                learning_objectives: [
                    'Understand value exchange and coincidence of wants',
                    'Identify functions of money: medium of exchange, unit of account, store of value',
                    'Predict real-world market outcomes with confidence calibration'
                ],
                concept_ids: ['money', 'value_exchange']
            });
        })
            .finally(() => {
            setIsLoading(false);
        });
    }, [lessonId]);
    const handleStartSession = () => {
        navigate('/learn/session');
    };
    if (isLoading) {
        return (<div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"/>
        <p className="font-medium text-sm">Loading lesson briefing...</p>
      </div>);
    }
    const title = lesson?.title || 'Interactive Financial Lesson';
    const duration = lesson?.duration_minutes || 4;
    const domain = lesson?.domain || 'personal_finance';
    const objectives = lesson?.learning_objectives || [
        'Master fundamental financial concepts',
        'Evaluate interactive real-world scenarios',
        'Calibrate your confidence and track retention'
    ];
    return (<div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/app/home')} className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4"/> Back to Home
        </button>
        <Badge variant="blue" className="uppercase text-xs font-bold">
          {domain.replace('_', ' ')}
        </Badge>
      </div>

      {/* Lesson Briefing Card */}
      <Card className="p-8 space-y-6 border-slate-200 shadow-xl bg-white rounded-3xl">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs font-semibold text-blue-600">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5"/> {duration} min bite-sized
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5"/> Adaptive Session
            </span>
          </div>

          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {title}
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            Experience the core concepts through interactive prediction, expert explanations, confidence calibration, and retention tracking.
          </p>
        </div>

        {/* Learning Objectives */}
        <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Target className="w-4 h-4 text-blue-500"/> Key Learning Objectives
          </div>
          <ul className="space-y-2">
            {objectives.map((obj, idx) => (<li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"/>
                <span>{obj}</span>
              </li>))}
          </ul>
        </div>

        {/* Start Learning Action */}
        <div className="space-y-3 pt-2">
          <Button variant="primary" fullWidth size="lg" onClick={handleStartSession} className="gap-2 text-base font-extrabold shadow-lg shadow-blue-500/25 h-14 rounded-2xl">
            <Sparkles className="w-5 h-5 text-amber-300"/>
            <span>START LEARNING</span>
          </Button>

          <p className="text-center text-xs text-slate-400 font-medium">
            Graded independently by the server-authoritative learning core.
          </p>
        </div>
      </Card>
    </div>);
};
