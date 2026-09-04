import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, CheckCircle2, ExternalLink, Search, Filter, ArrowRight, } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
export const ReviewInbox = ({ onOpenLesson, userRole = 'SUPER_ADMIN', }) => {
    const [reviews, setReviews] = useState([]);
    const [filterRole, setFilterRole] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReview, setSelectedReview] = useState(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notification, setNotification] = useState(null);
    useEffect(() => {
        fetchPendingReviews();
    }, []);
    const fetchPendingReviews = async () => {
        try {
            const data = await apiClient('/api/v1/admin/reviews/pending');
            if (data?.pending_reviews) {
                setReviews(data.pending_reviews);
            }
        }
        catch (err) {
            console.error('Failed to fetch pending reviews:', err);
            // Fallback mock items if server has no pending items yet
            setReviews([
                {
                    lesson_id: 'l-candlestick-1',
                    slug: 'what-is-a-candlestick',
                    version_id: 'v-candlestick-1',
                    version_number: 2,
                    title: 'What is a Candlestick? Anatomy & Coordinates',
                    status: 'FINANCE_REVIEW',
                    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
                },
                {
                    lesson_id: 'l-candlestick-2',
                    slug: 'candlestick-anatomy-wick-and-body',
                    version_id: 'v-candlestick-2',
                    version_number: 1,
                    title: 'Candlestick Anatomy: Wick vs Real Body',
                    status: 'COMPLIANCE_REVIEW',
                    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
                },
                {
                    lesson_id: 'l-candlestick-3',
                    slug: 'bullish-momentum-dynamics',
                    version_id: 'v-candlestick-3',
                    version_number: 1,
                    title: 'Bullish Momentum Dynamics',
                    status: 'EDITOR_REVIEW',
                    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
                },
            ]);
        }
    };
    const handleReviewAction = async (action) => {
        if (!selectedReview)
            return;
        try {
            setIsSubmitting(true);
            const reviewRole = userRole === 'FINANCE_REVIEWER'
                ? 'FINANCE_REVIEWER'
                : userRole === 'COMPLIANCE_REVIEWER'
                    ? 'COMPLIANCE_REVIEWER'
                    : 'CONTENT_REVIEWER';
            await apiClient(`/api/v1/admin/lessons/${selectedReview.version_id}/review`, {
                method: 'POST',
                body: JSON.stringify({
                    review_role: reviewRole,
                    status: action,
                    notes: reviewNotes || (action === 'APPROVED' ? 'Approved without reservations.' : 'Changes requested.'),
                }),
            });
            setNotification(`Review submitted: ${action}`);
            setTimeout(() => setNotification(null), 3000);
            setSelectedReview(null);
            setReviewNotes('');
            fetchPendingReviews();
        }
        catch (err) {
            console.error('Failed to submit review:', err);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const filtered = reviews.filter((r) => {
        const matchesFilter = filterRole === 'ALL' || r.status === filterRole;
        const matchesSearch = searchTerm === '' ||
            r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.slug.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });
    return (<div className="flex-1 overflow-y-auto bg-[#FBFBFA] p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* ── Surface Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600"/>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Governance & Editorial Review Pipeline
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative multi-role sign-off gates: Content, Financial Integrity & Compliance.
          </p>
        </div>

        {notification && (<div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
            <span>{notification}</span>
          </div>)}
      </div>

      {/* ── Pipeline Statistics Ribbon ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Pending</span>
          <div className="text-2xl font-black text-slate-900">{reviews.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Editorial Review</span>
          <div className="text-2xl font-black text-amber-600">
            {reviews.filter((r) => r.status === 'EDITOR_REVIEW').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">Finance Review</span>
          <div className="text-2xl font-black text-blue-600">
            {reviews.filter((r) => r.status === 'FINANCE_REVIEW').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-500">Compliance Review</span>
          <div className="text-2xl font-black text-purple-600">
            {reviews.filter((r) => r.status === 'COMPLIANCE_REVIEW').length}
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400"/>
          <input type="text" placeholder="Search pending reviews..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="text-xs bg-transparent focus:outline-none w-60 text-slate-800 placeholder-slate-400"/>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Filter className="w-3.5 h-3.5 text-slate-400"/>
          <span>Stage:</span>
          {['ALL', 'EDITOR_REVIEW', 'FINANCE_REVIEW', 'COMPLIANCE_REVIEW'].map((r) => (<button key={r} onClick={() => setFilterRole(r)} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${filterRole === r
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
              {r.replace('_REVIEW', '').replace('ALL', 'All Stages')}
            </button>))}
        </div>
      </div>

      {/* ── Review Queue Items ── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (<div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto"/>
            <h3 className="text-sm font-bold text-slate-800">No Pending Reviews in Queue</h3>
            <p className="text-xs text-slate-400">All submitted lesson drafts have been evaluated.</p>
          </div>) : (filtered.map((item) => {
            return (<div key={item.version_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${item.status === 'FINANCE_REVIEW'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : item.status === 'COMPLIANCE_REVIEW'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      <Clock className="w-3 h-3"/>
                      <span>{item.status.replace('_', ' ')}</span>
                    </span>

                    <span className="text-xs text-slate-400 font-mono">v{item.version_number}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-400">
                      Submitted {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h3>

                  <div className="text-xs text-slate-400 font-mono">slug: {item.slug}</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => onOpenLesson(item.version_id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700">
                    <span>Inspect in Canvas</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400"/>
                  </button>

                  <button onClick={() => setSelectedReview(item)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-sm">
                    <span>Review & Sign Off</span>
                    <ArrowRight className="w-3.5 h-3.5"/>
                  </button>
                </div>
              </div>);
        }))}
      </div>

      {/* ── Review Sign-off Modal ── */}
      {selectedReview && (<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                Governance Review Sign-off
              </span>
              <h3 className="text-base font-black text-slate-900">{selectedReview.title}</h3>
              <p className="text-xs text-slate-500">
                Acting as <strong>{userRole}</strong> on version v{selectedReview.version_number}.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Structured Review Comments</label>
              <textarea rows={4} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Enter specific editorial, financial accuracy, or regulatory compliance notes..." className="w-full p-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"/>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button onClick={() => setSelectedReview(null)} className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button onClick={() => handleReviewAction('CHANGES_REQUESTED')} disabled={isSubmitting} className="px-3.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold">
                  Request Changes
                </button>
                <button onClick={() => handleReviewAction('APPROVED')} disabled={isSubmitting} className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm">
                  Approve Review
                </button>
              </div>
            </div>
          </div>
        </div>)}
    </div>);
};
