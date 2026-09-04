import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { X, Check, Copy, Share2, Sparkles } from 'lucide-react';
import { telemetry } from '../services/telemetry';
export const ShareableInsightModal = ({ isOpen, onClose, conceptTitle = 'Inflation & Purchasing Power', insightHeadline = 'THE ₹100 ILLUSION', insightBody = 'Your money didn\'t disappear. What it could buy did.', }) => {
    const [copied, setCopied] = useState(false);
    if (!isOpen)
        return null;
    const shareText = `💡 ${insightHeadline}\n"${insightBody}"\n\nLearned on SentiNews Learn — Financial Intelligence for Real Life.`;
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareText);
            setCopied(true);
            telemetry.track('insight_shared', {
                payload: { method: 'CLIPBOARD_COPY', headline: insightHeadline },
            });
            setTimeout(() => setCopied(false), 2500);
        }
        catch {
            // Fallback if clipboard API fails
            setCopied(true);
        }
    };
    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: insightHeadline,
                    text: shareText,
                });
                telemetry.track('insight_shared', {
                    payload: { method: 'NATIVE_SHARE', headline: insightHeadline },
                });
            }
            catch {
                // User cancelled share
            }
        }
        else {
            handleCopy();
        }
    };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md">
        {/* Close Button */}
        <button onClick={onClose} className="absolute -top-3 -right-3 z-10 w-9 h-9 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 transition-all">
          <X className="w-5 h-5"/>
        </button>

        {/* Shareable Card Canvas */}
        <Card className="bg-gradient-to-br from-senti-900 via-senti-800 to-senti-blue text-white p-8 space-y-6 shadow-2xl border-none relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"/>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-senti-blue text-white flex items-center justify-center font-black text-xs">
                S
              </div>
              <span className="font-extrabold text-xs text-blue-200 tracking-wide uppercase">
                SentiNews Learn
              </span>
            </div>
            <span className="text-[10px] font-bold text-blue-300/80 bg-blue-500/20 px-2 py-0.5 rounded-full uppercase">
              INSIGHT #04
            </span>
          </div>

          {/* Insight Content */}
          <div className="space-y-3 py-2">
            <h3 className="text-2xl font-black tracking-tight leading-tight text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-400 fill-amber-400/20 shrink-0"/>
              <span>{insightHeadline}</span>
            </h3>
            <p className="text-blue-100 text-base font-medium leading-relaxed italic">
              "{insightBody}"
            </p>
          </div>

          {/* Footer Badge & Concept */}
          <div className="pt-4 border-t border-blue-400/20 flex items-center justify-between text-xs">
            <span className="text-blue-200 font-semibold">{conceptTitle}</span>
            <span className="text-blue-300 font-bold">sentinews.in</span>
          </div>
        </Card>

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <Button variant="success" fullWidth onClick={handleNativeShare} className="gap-2 font-extrabold shadow-lg shadow-emerald-500/20">
            <Share2 className="w-4 h-4"/> Share Insight
          </Button>
          <Button variant="secondary" onClick={handleCopy} className="gap-2 font-bold bg-white text-slate-800 hover:bg-slate-100 shrink-0">
            {copied ? <Check className="w-4 h-4 text-emerald-600"/> : <Copy className="w-4 h-4"/>}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </Button>
        </div>
      </div>
    </div>);
};
