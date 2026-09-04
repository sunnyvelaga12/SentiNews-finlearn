import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Layers } from 'lucide-react';
export const CurriculumManager = () => {
    const tree = [
        {
            domain: 'Stocks & Equity',
            worlds: [
                {
                    name: 'World 1: Stock Fundamentals',
                    series: [
                        {
                            name: 'Series A: Equity Basics',
                            modules: ['Module 1: What is a Stock', 'Module 2: Stock Ownership Rights']
                        }
                    ]
                }
            ]
        },
        {
            domain: 'Market Indices',
            worlds: [
                {
                    name: 'World 2: Indian Exchanges',
                    series: [
                        {
                            name: 'Series B: NSE & BSE',
                            modules: ['Module 3: Stock Exchanges', 'Module 4: Nifty 50 Index']
                        }
                    ]
                }
            ]
        }
    ];
    return (<div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Layers className="w-5 h-5 text-senti-blue"/>
          <span>CURRICULUM TREE HIERARCHY</span>
        </div>
        <Badge variant="blue">Domain → World → Series → Module</Badge>
      </div>

      <div className="space-y-4">
        {tree.map((d, idx) => (<Card key={idx} className="space-y-3 bg-white border border-slate-200">
            <div className="font-extrabold text-senti-blue text-base border-b pb-2">
              Domain: {d.domain}
            </div>

            {d.worlds.map((w, wIdx) => (<div key={wIdx} className="pl-4 space-y-2 border-l-2 border-slate-200">
                <div className="font-bold text-slate-900 text-sm">{w.name}</div>

                {w.series.map((s, sIdx) => (<div key={sIdx} className="pl-4 space-y-1">
                    <div className="text-xs font-semibold text-slate-600">{s.name}</div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {s.modules.map((m, mIdx) => (<span key={mIdx} className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-700">
                          {m}
                        </span>))}
                    </div>
                  </div>))}
              </div>))}
          </Card>))}
      </div>
    </div>);
};
