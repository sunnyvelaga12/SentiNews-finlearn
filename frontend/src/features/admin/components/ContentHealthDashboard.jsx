import React from 'react';
import { Activity, CheckCircle2, Target, TrendingUp, Clock, ShieldAlert, } from 'lucide-react';
export const ContentHealthDashboard = ({ totalModules = 2, totalUnits = 4, totalLessons = 6, publishedCount = 2, draftCount = 3, inReviewCount = 1, }) => {
    return (<div className="flex-1 overflow-y-auto bg-[#FBFBFA] p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* ── Surface Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600"/>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Content Health, Quality & Governance Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global monitoring of pedagogical structure, sequence pacing, evidence calibration, and publication status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600"/>
            <span>Curriculum Health: Optimal</span>
          </span>
        </div>
      </div>

      {/* ── Executive Counter Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modules</span>
          <div className="text-2xl font-black text-slate-900">{totalModules}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Units</span>
          <div className="text-2xl font-black text-slate-900">{totalUnits}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Lessons</span>
          <div className="text-2xl font-black text-slate-900">{totalLessons}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Published</span>
          <div className="text-2xl font-black text-emerald-600">{publishedCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">In Review</span>
          <div className="text-2xl font-black text-amber-600">{inReviewCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Drafts</span>
          <div className="text-2xl font-black text-slate-700">{draftCount}</div>
        </div>
      </div>

      {/* ── Quality Breakdown Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Pedagogical Integrity */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
              Structural Completeness
            </span>
            <span className="text-xs font-black text-emerald-600">100%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }}/>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            All published lessons have defined learning objectives, titles, and valid renderer configurations.
          </p>
        </div>

        {/* Metric 2: Pacing & Active Engagement */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600"/>
              Active Retrieval Ratio
            </span>
            <span className="text-xs font-black text-blue-600">67%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '67%' }}/>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            2 out of every 3 cards require learner micro-predictions or formative decisions before explanation.
          </p>
        </div>

        {/* Metric 3: Verified Financial Citations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-purple-600"/>
              Regulatory Citations
            </span>
            <span className="text-xs font-black text-purple-600">92%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: '92%' }}/>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Historical claims and market examples reference verified NSE/BSE or SEBI master circular citations.
          </p>
        </div>
      </div>

      {/* ── Pedagogical Evidence Distribution ── */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600"/>
            <span>Curriculum Evidence Calibration (Bayesian Competence Breakdown)</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">Total Activities: 24</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Mastery Evidence</div>
            <div className="text-xl font-black text-emerald-800">8 Activities</div>
            <p className="text-[11px] text-emerald-700/80 leading-tight">
              Calibrated evaluatable cards contributing directly to verified concept mastery.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-blue-700">Formative Practice</div>
            <div className="text-xl font-black text-blue-800">10 Activities</div>
            <p className="text-[11px] text-blue-700/80 leading-tight">
              Low-stakes retrieval opportunities reinforcing memory without modifying mastery.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">Orientation & Concept Models</div>
            <div className="text-xl font-black text-slate-800">6 Activities</div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Visual candlestick charts and causal explanations building intuition.
            </p>
          </div>
        </div>
      </div>

      {/* ── Recent Governance Audit Events Log ── */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500"/>
          <span>Recent Content Governance & Audit Log</span>
        </h3>

        <div className="space-y-2 text-xs">
          {[
            {
                action: 'PUBLISH_LESSON_VERSION',
                resource: 'What is a Candlestick? (v2)',
                actor: 'Super Admin (publisher)',
                time: '12 minutes ago',
                status: 'SUCCESS',
            },
            {
                action: 'REVIEW_APPROVAL',
                resource: 'What is a Candlestick? (v2)',
                actor: 'Compliance Reviewer',
                time: '45 minutes ago',
                status: 'APPROVED',
            },
            {
                action: 'REVIEW_APPROVAL',
                resource: 'What is a Candlestick? (v2)',
                actor: 'Finance Reviewer',
                time: '1 hour ago',
                status: 'APPROVED',
            },
            {
                action: 'DRAFT_UPDATED',
                resource: 'Bullish Momentum Dynamics (v1)',
                actor: 'Content Editor',
                time: '2 hours ago',
                status: 'SUCCESS',
            },
        ].map((log, idx) => (<div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"/>
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800">
                    {log.action.replace(/_/g, ' ')}: <span className="text-blue-600">{log.resource}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Actor: {log.actor}</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-medium">{log.time}</div>
            </div>))}
        </div>
      </div>
    </div>);
};
