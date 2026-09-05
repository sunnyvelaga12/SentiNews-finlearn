import React, { useState } from 'react';
import { Save, CheckCircle2, Play, Send, ShieldCheck, AlertOctagon, RotateCcw, Sparkles, GitBranch, FileCheck, MessageSquare, } from 'lucide-react';
export const GovernanceBar = ({ status, versionNumber, userRole = 'CONTENT_EDITOR', isPublishable, isSaving = false, hasUnsavedChanges = false, lastSavedText = 'Saved just now', occConflict = null, onSaveDraft, onValidate, onOpenPreview, onSubmitForReview, onApproveReview, onRequestChanges, onPublish, onResolveOccConflict, }) => {
    const [showReviewNotesModal, setShowReviewNotesModal] = useState(false);
    const [reviewAction, setReviewAction] = useState('APPROVE');
    const [reviewNotes, setReviewNotes] = useState('');
    // Status visual badge
    const renderStatusPill = () => {
        switch (status) {
            case 'PUBLISHED':
                return (<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5"/> Published (Immutable)
          </span>);
            case 'APPROVED':
                return (<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/30">
            <FileCheck className="w-3.5 h-3.5"/> Approved for Release
          </span>);
            case 'EDITOR_REVIEW':
            case 'FINANCE_REVIEW':
            case 'COMPLIANCE_REVIEW':
                return (<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/30">
            <ShieldCheck className="w-3.5 h-3.5"/> In Governance Review
          </span>);
            case 'DRAFT':
            default:
                return (<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
            <GitBranch className="w-3.5 h-3.5"/> Draft · v{versionNumber}
          </span>);
        }
    };
    const handleOpenReviewModal = (action) => {
        setReviewAction(action);
        setReviewNotes('');
        setShowReviewNotesModal(true);
    };
    const handleConfirmReview = () => {
        if (reviewAction === 'APPROVE' && onApproveReview) {
            onApproveReview(reviewNotes);
        }
        else if (reviewAction === 'REJECT' && onRequestChanges) {
            onRequestChanges(reviewNotes);
        }
        setShowReviewNotesModal(false);
    };
    return (<>
      <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200 shadow-lg text-slate-800 shrink-0">
        {/* Left: Machine State & Autosave Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {renderStatusPill()}
            <span className="text-xs text-slate-400 font-mono">v{versionNumber}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 border-l border-slate-200 pl-4">
            {isSaving ? (<span className="text-blue-600 flex items-center gap-1">
                <RotateCcw className="w-3 h-3 animate-spin"/> Saving...
              </span>) : hasUnsavedChanges ? (<span className="text-amber-600 font-semibold flex items-center gap-1">
                ● Unsaved changes
              </span>) : (<span className="text-slate-400">{lastSavedText}</span>)}
          </div>
        </div>

        {/* Right: Role-Based Progressively Stronger Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Action 1: Save Draft */}
          {status === 'DRAFT' && (<button onClick={onSaveDraft} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm">
              <Save className="w-3.5 h-3.5"/>
              <span>Save Draft</span>
            </button>)}

          {/* Action 2: Validate */}
          <button onClick={onValidate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600"/>
            <span>Validate</span>
          </button>

          {/* Action 3: Preview */}
          <button onClick={onOpenPreview} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm">
            <Play className="w-3.5 h-3.5 text-blue-400"/>
            <span>Preview Mode</span>
          </button>

          {/* Action 4: Submit for Review (Editor in DRAFT) */}
          {status === 'DRAFT' && (<button onClick={onSubmitForReview} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold transition-all shadow-sm">
              <Send className="w-3.5 h-3.5"/>
              <span>Submit for Review</span>
            </button>)}

          {/* Action 5: Review Actions (Reviewers) */}
          {['EDITOR_REVIEW', 'FINANCE_REVIEW', 'COMPLIANCE_REVIEW'].includes(status) && (<div className="flex items-center gap-2">
              <button onClick={() => handleOpenReviewModal('REJECT')} className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold">
                Request Changes
              </button>
              <button onClick={() => handleOpenReviewModal('APPROVE')} className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm">
                Approve Review
              </button>
            </div>)}

          {/* Action 6: Direct Publish (Unlocked in dev/test, requires APPROVED in production) */}
          {status !== 'PUBLISHED' && (import.meta.env.DEV || status === 'APPROVED') && (<button onClick={onPublish} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black tracking-wide shadow-md transition-all hover:scale-[1.02]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-200"/>
              <span>Publish Lesson</span>
            </button>)}
        </div>
      </div>

      {/* ── Structured Review Notes Modal ── */}
      {showReviewNotesModal && (<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600"/>
              <span>
                {reviewAction === 'APPROVE' ? 'Approve Content Review' : 'Request Content Changes'}
              </span>
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">
                Editorial Review Notes & Structured Feedback
              </label>
              <textarea rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder={reviewAction === 'APPROVE'
                ? 'e.g. Verified mathematical definitions and regulatory citations. Approved for production.'
                : 'e.g. Please verify OHLC candlestick timestamp citation in Step 2...'} className="w-full text-xs p-3 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"/>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowReviewNotesModal(false)} className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={handleConfirmReview} className={`px-4 py-1.5 rounded text-xs font-bold text-white ${reviewAction === 'APPROVE'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-rose-600 hover:bg-rose-500'}`}>
                Submit Review
              </button>
            </div>
          </div>
        </div>)}

      {/* ── Categorized OCC Conflict Modal ── */}
      {occConflict && (<div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-300 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertOctagon className="w-5 h-5 shrink-0"/>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Optimistic Concurrency Conflict Detected
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Another editor updated this lesson on the server while you were working. To prevent
              overwriting their work, your changes cannot be silently merged.
            </p>

            <div className="p-3.5 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1 text-xs">
              <div className="font-bold text-rose-900">
                Conflict Category: {occConflict.conflictType} (Server Version: v{occConflict.serverVersion})
              </div>
              <p className="text-rose-700">{occConflict.diffSummary}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button onClick={() => onResolveOccConflict && onResolveOccConflict('RELOAD')} className="px-3.5 py-1.5 rounded border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100">
                Reload Latest Server Version
              </button>
              <button onClick={() => onResolveOccConflict && onResolveOccConflict('SAVE_AS_NEW')} className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-sm">
                Save My Changes as New Draft
              </button>
            </div>
          </div>
        </div>)}
    </>);
};
