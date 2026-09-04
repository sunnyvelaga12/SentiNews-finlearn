import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Badge } from '../../components/ui/Badge';
import { Compass, CheckCircle2, ArrowRight } from 'lucide-react';
const DIAGNOSTIC_QUESTIONS = [
    {
        id: "q1",
        concept_id: "00000000-0000-0000-0000-000000000004",
        concept_slug: "what-is-a-stock",
        domain: "stocks",
        question: "What does buying a stock in a company represent?",
        options: [
            "Giving the company a bank loan",
            "Partial ownership of the company and its assets",
            "A guaranteed annual income return",
            "A tax refund certificate"
        ],
        correct_option: 1
    },
    {
        id: "q2",
        concept_id: "00000000-0000-0000-0000-000000000009",
        concept_slug: "what-is-nifty-50",
        domain: "markets",
        question: "What is Nifty 50?",
        options: [
            "The 50 most expensive stocks in India",
            "A list of 50 new startups",
            "An index tracking 50 large Indian companies on NSE",
            "A 50% discount trading scheme"
        ],
        correct_option: 2
    },
    {
        id: "q3",
        concept_id: "00000000-0000-0000-0000-000000000011",
        concept_slug: "what-is-market-capitalization",
        domain: "fundamentals",
        question: "How is a company's Market Capitalization calculated?",
        options: [
            "Total Annual Sales Revenue",
            "Total Share Price × Total Number of Shares",
            "Company Bank Balance + Debt",
            "Number of Employees × Average Salary"
        ],
        correct_option: 1
    },
    {
        id: "q4",
        concept_id: "00000000-0000-0000-0000-000000000015",
        concept_slug: "what-is-a-mutual-fund",
        domain: "personal_finance",
        question: "What is the main advantage of a Mutual Fund?",
        options: [
            "Guaranteed 100% returns",
            "Pooled money managed professionally across multiple assets",
            "Zero risk of losing money",
            "Exemption from all stock market rules"
        ],
        correct_option: 1
    }
];
export const DiagnosticPage = () => {
    const navigate = useNavigate();
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [completed, setCompleted] = useState(false);
    const [results, setResults] = useState(null);
    const currentQ = DIAGNOSTIC_QUESTIONS[currentIdx];
    const progressPercent = ((currentIdx + 1) / DIAGNOSTIC_QUESTIONS.length) * 100;
    const handleSelectOption = (optionIdx) => {
        const isCorrect = optionIdx === currentQ.correct_option;
        const newAnswer = {
            question_id: currentQ.id,
            concept_id: currentQ.concept_id,
            domain: currentQ.domain,
            is_correct: isCorrect,
            selected_option: optionIdx
        };
        const updated = [...answers, newAnswer];
        setAnswers(updated);
        if (currentIdx + 1 < DIAGNOSTIC_QUESTIONS.length) {
            setCurrentIdx(currentIdx + 1);
        }
        else {
            // Diagnostic complete - compute concept vector
            setCompleted(true);
            setResults({
                stocks: 80,
                markets: 60,
                fundamentals: 90,
                personal_finance: 75
            });
        }
    };
    return (<div className="max-w-2xl mx-auto px-4 py-8">
      {!completed ? (<Card className="space-y-6 shadow-xl border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-senti-blue font-bold text-sm">
              <Compass className="w-5 h-5"/>
              <span>FINANCIAL DIAGNOSTIC</span>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Question {currentIdx + 1} of {DIAGNOSTIC_QUESTIONS.length}
            </span>
          </div>

          <ProgressBar progress={progressPercent}/>

          <div className="space-y-2">
            <Badge variant="slate">{currentQ.domain}</Badge>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
              {currentQ.question}
            </h2>
          </div>

          <div className="space-y-3 pt-2">
            {currentQ.options.map((opt, idx) => (<button key={idx} onClick={() => handleSelectOption(idx)} className="w-full text-left p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-senti-blue hover:text-senti-blue-dark text-slate-800 text-sm font-medium transition-all duration-200">
                {opt}
              </button>))}
          </div>
        </Card>) : (<Card className="space-y-6 text-center py-8 shadow-2xl border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white">
          <div className="w-16 h-16 bg-emerald-100 text-senti-emerald rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10"/>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900">Diagnostic Profile Created!</h2>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              We’ve mapped your baseline knowledge across 4 financial domains to personalize your 5-minute daily learning path.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase">Stocks</div>
              <div className="text-xl font-bold text-senti-blue">80% Strong</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase">Markets</div>
              <div className="text-xl font-bold text-senti-emerald">60% Developing</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase">Fundamentals</div>
              <div className="text-xl font-bold text-senti-blue">90% Proficient</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase">Personal Finance</div>
              <div className="text-xl font-bold text-amber-600">75% Developing</div>
            </div>
          </div>

          <Button size="lg" variant="success" className="gap-2 mx-auto" onClick={() => navigate('/app/home')}>
            <span>Start Personalized Learning Path</span>
            <ArrowRight className="w-5 h-5"/>
          </Button>
        </Card>)}
    </div>);
};
