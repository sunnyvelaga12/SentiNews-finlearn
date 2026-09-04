import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { telemetry } from '../../services/telemetry';
import { RotateCcw, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
export const ReviewPage = () => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [completed, setCompleted] = useState(false);
    const reviewQueue = [
        {
            id: 'rev-inf-1',
            concept_id: 'inflation',
            concept_title: 'Inflation & Purchasing Power',
            scenario: 'You received a 5% salary increment this year. Over the exact same period, economic inflation was 8%.',
            question: 'Without checking prior notes: What actually happened to your purchasing power?',
            options: [
                { id: 'opt_a', label: 'My purchasing power increased because my salary went up by 5%.', isCorrect: false },
                { id: 'opt_b', label: 'My purchasing power decreased by approximately 3% because prices rose faster than salary.', isCorrect: true },
                { id: 'opt_c', label: 'My purchasing power stayed identical because money is constant.', isCorrect: false },
            ],
            explanation: 'Because inflation (8%) outpaced your nominal salary growth (5%), each rupee buys fewer real goods than it did a year ago.',
        },
    ];
    const currentItem = reviewQueue[currentIdx];
    const isCorrect = selectedOption
        ? currentItem.options.find((o) => o.id === selectedOption)?.isCorrect ?? false
        : false;
    const handleSubmit = () => {
        if (!selectedOption)
            return;
        setSubmitted(true);
        telemetry.track('review_completed', {
            conceptId: currentItem.concept_id,
            payload: { selected_option_id: selectedOption, is_correct: isCorrect },
        });
    };
    const handleNext = () => {
        setSelectedOption(null);
        setSubmitted(false);
        if (currentIdx + 1 < reviewQueue.length) {
            setCurrentIdx(currentIdx + 1);
        }
        else {
            setCompleted(true);
        }
    };
    return (<div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-slate-900">
          <RotateCcw className="w-5 h-5 text-blue-600"/>
          <span>ACTIVE RETRIEVAL PRACTICE</span>
        </div>
        <Badge variant="blue">Item {currentIdx + 1} of {reviewQueue.length}</Badge>
      </div>

      {!completed ? (<Card className="space-y-6 p-8 border border-slate-200/80 shadow-md bg-white rounded-3xl">
          <div className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">
            CONCEPT RECALL • {currentItem.concept_title}
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-700 text-sm font-medium leading-relaxed">
            {currentItem.scenario}
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
            {currentItem.question}
          </h2>

          <div className="space-y-3">
            {currentItem.options.map((option) => {
                const isSelected = selectedOption === option.id;
                return (<button key={option.id} disabled={submitted} onClick={() => setSelectedOption(option.id)} className={`w-full text-left p-4 rounded-2xl border text-sm font-medium transition-all ${isSelected
                        ? 'border-blue-600 bg-blue-50/80 text-blue-950 font-bold ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'}`}>
                  {option.label}
                </button>);
            })}
          </div>

          {!submitted ? (<Button fullWidth size="lg" disabled={!selectedOption} onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl py-4">
              Verify Active Recall
            </Button>) : (<div className="space-y-6 pt-2">
              <div className={`p-4 rounded-2xl border text-sm leading-relaxed ${isCorrect
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'}`}>
                <div className="font-extrabold text-xs uppercase mb-1 flex items-center gap-1">
                  {isCorrect ? (<span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4"/> RECALL VERIFIED
                    </span>) : (<span className="text-rose-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4"/> CONCEPT DRIFT DETECTED
                    </span>)}
                </div>
                <p>{currentItem.explanation}</p>
              </div>

              <Button fullWidth size="lg" onClick={handleNext} className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl py-4">
                Continue →
              </Button>
            </div>)}
        </Card>) : (<Card className="text-center py-12 px-6 space-y-4 bg-emerald-50/90 border border-emerald-200 shadow-lg rounded-3xl">
          <Sparkles className="w-12 h-12 text-emerald-600 mx-auto"/>
          <h2 className="text-2xl font-black text-slate-900">Active Retrieval Completed</h2>
          <p className="text-slate-600 text-sm max-w-md mx-auto">
            You reinforced your understanding of Inflation and Purchasing Power against memory decay today.
          </p>
        </Card>)}
    </div>);
};
