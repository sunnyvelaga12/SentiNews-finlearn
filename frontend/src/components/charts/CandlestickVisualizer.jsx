import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
/**
 * Generic locale and currency formatter — zero hardcoded currency symbols
 */
export const formatCurrency = (val, currencyCode = 'INR', locale = 'en-IN') => {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            maximumFractionDigits: 0,
        }).format(val);
    }
    catch (e) {
        return `${currencyCode} ${val.toLocaleString()}`;
    }
};
export const CandlestickVisualizer = ({ initialOHLC = { open: 100, high: 120, low: 90, close: 110, timeframe: '1D', label: 'Sample Session' }, presentationMode = 'EXPLAIN', currencyCode = 'INR', locale = 'en-IN', interactive = false, showLabels = true, showMetrics = false, onInspectCandle, className = '', }) => {
    const [ohlc, setOhlc] = useState(initialOHLC);
    useEffect(() => {
        setOhlc(initialOHLC);
    }, [initialOHLC]);
    const isBullish = ohlc.close > ohlc.open;
    const isBearish = ohlc.close < ohlc.open;
    const isNeutral = ohlc.close === ohlc.open;
    const totalRange = Math.max(1, ohlc.high - ohlc.low);
    const bodySize = Math.abs(ohlc.close - ohlc.open);
    const bodyToRangeRatio = Math.round((bodySize / totalRange) * 100);
    const upperShadow = isBullish ? ohlc.high - ohlc.close : ohlc.high - ohlc.open;
    const lowerShadow = isBullish ? ohlc.open - ohlc.low : ohlc.close - ohlc.low;
    // SVG coordinate calculations (Chart dimensions: 320x320, inner drawing area: y=40 to y=280)
    const svgHeight = 320;
    const paddingY = 40;
    const usableHeight = svgHeight - 2 * paddingY;
    const scaleY = (val) => {
        return paddingY + usableHeight * (1 - (val - ohlc.low) / totalRange);
    };
    const highY = scaleY(ohlc.high);
    const lowY = scaleY(ohlc.low);
    const openY = scaleY(ohlc.open);
    const closeY = scaleY(ohlc.close);
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(4, Math.abs(closeY - openY));
    const candleX = 138;
    const candleWidth = 44;
    const handleSliderChange = (key, value) => {
        const updated = { ...ohlc, [key]: value };
        if (key === 'high') {
            updated.high = Math.max(value, updated.open, updated.close);
        }
        else if (key === 'low') {
            updated.low = Math.min(value, updated.open, updated.close);
        }
        else if (key === 'open' || key === 'close') {
            updated.high = Math.max(updated.high, updated.open, updated.close);
            updated.low = Math.min(updated.low, updated.open, updated.close);
        }
        setOhlc(updated);
        if (onInspectCandle) {
            const b = updated.close > updated.open;
            const be = updated.close < updated.open;
            const n = updated.close === updated.open;
            const tr = Math.max(1, updated.high - updated.low);
            const bs = Math.abs(updated.close - updated.open);
            onInspectCandle({
                ohlc: updated,
                isBullish: b,
                isBearish: be,
                isNeutral: n,
                bodySize: bs,
                totalRange: tr,
                bodyToRangeRatio: Math.round((bs / tr) * 100),
                upperShadow: b ? updated.high - updated.close : updated.high - updated.open,
                lowerShadow: b ? updated.open - updated.low : updated.close - updated.low,
            });
        }
    };
    // Progressive Disclosure: In THINK mode, conceal derived metrics and answer rationale
    const isThinkMode = presentationMode === 'THINK';
    const shouldRenderMetrics = showMetrics && !isThinkMode;
    const shouldRenderSlider = (interactive || presentationMode === 'INTERACTIVE');
    return (<div className={`bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm text-[#17202A] flex flex-col md:flex-row gap-6 items-center justify-center ${className}`} role="region" aria-label="Interactive Candlestick Visualizer">
      {/* SVG Candlestick Rendering Area (Clean Light Slate Surface) */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-xl p-4 border border-slate-200 relative w-full max-w-[340px]">
        {/* Direction & Status Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {!isThinkMode && (<>
              {isBullish && (<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" aria-label="Bullish: Close was above Open">
                  <TrendingUp className="w-3 h-3 text-emerald-600" aria-hidden="true"/>
                  ▲ BULLISH
                </span>)}
              {isBearish && (<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200" aria-label="Bearish: Close was below Open">
                  <TrendingDown className="w-3 h-3 text-rose-600" aria-hidden="true"/>
                  ▼ BEARISH
                </span>)}
              {isNeutral && (<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200" aria-label="Neutral Doji: Close equals Open">
                  <Minus className="w-3 h-3 text-slate-600" aria-hidden="true"/>
                  ◆ DOJI
                </span>)}
            </>)}
          {ohlc.timeframe && (<span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              {ohlc.timeframe}
            </span>)}
        </div>

        <svg viewBox="0 0 320 320" className="w-full max-w-[300px] h-[280px] overflow-visible" role="img" aria-label={`Candlestick chart: High ${ohlc.high}, Open ${ohlc.open}, Close ${ohlc.close}, Low ${ohlc.low}`}>
          {/* Subtle light gridlines */}
          <line x1="30" y1="40" x2="290" y2="40" stroke="#E2E8F0" strokeDasharray="3 3"/>
          <line x1="30" y1="160" x2="290" y2="160" stroke="#E2E8F0" strokeDasharray="3 3"/>
          <line x1="30" y1="280" x2="290" y2="280" stroke="#E2E8F0" strokeDasharray="3 3"/>

          {/* Upper & Lower Shadow (Wick) */}
          <line x1={candleX + candleWidth / 2} y1={highY} x2={candleX + candleWidth / 2} y2={lowY} stroke={isBullish ? '#059669' : isBearish ? '#DC2626' : '#D97706'} strokeWidth="3" strokeLinecap="round"/>

          {/* Real Body */}
          <rect x={candleX} y={bodyTop} width={candleWidth} height={bodyHeight} rx="3" fill={isBullish ? '#10B981' : isBearish ? '#EF4444' : '#F59E0B'} fillOpacity="0.95" stroke={isBullish ? '#059669' : isBearish ? '#DC2626' : '#D97706'} strokeWidth="1.5" className="transition-all duration-150"/>

          {/* Price Level Reference Markers */}
          {showLabels && (<g className="text-[11px] font-mono">
              {/* High */}
              <circle cx={candleX + candleWidth / 2} cy={highY} r="3" fill="#0284C7"/>
              <text x={candleX + candleWidth + 12} y={highY + 4} fill="#0284C7" fontWeight="bold">
                {isThinkMode ? formatCurrency(ohlc.high, currencyCode, locale) : `High: ${formatCurrency(ohlc.high, currencyCode, locale)}`}
              </text>

              {/* Open */}
              <line x1={candleX - 8} y1={openY} x2={candleX} y2={openY} stroke="#94A3B8" strokeWidth="1.5"/>
              <text x={candleX - 78} y={openY + 4} fill="#475569" fontWeight="500">
                {isThinkMode ? formatCurrency(ohlc.open, currencyCode, locale) : `Open: ${formatCurrency(ohlc.open, currencyCode, locale)}`}
              </text>

              {/* Close */}
              <line x1={candleX + candleWidth} y1={closeY} x2={candleX + candleWidth + 8} y2={closeY} stroke="#94A3B8" strokeWidth="1.5"/>
              <text x={candleX + candleWidth + 12} y={closeY + 4} fill="#0F172A" fontWeight="bold">
                {isThinkMode ? formatCurrency(ohlc.close, currencyCode, locale) : `Close: ${formatCurrency(ohlc.close, currencyCode, locale)}`}
              </text>

              {/* Low */}
              <circle cx={candleX + candleWidth / 2} cy={lowY} r="3" fill="#DC2626"/>
              <text x={candleX + candleWidth + 12} y={lowY + 4} fill="#DC2626" fontWeight="bold">
                {isThinkMode ? formatCurrency(ohlc.low, currencyCode, locale) : `Low: ${formatCurrency(ohlc.low, currencyCode, locale)}`}
              </text>
            </g>)}
        </svg>
      </div>

      {/* Metrics & Interactive Exploration Panel (Progressive Disclosure) */}
      {(shouldRenderMetrics || shouldRenderSlider) && (<div className="flex-1 flex flex-col justify-between space-y-4 w-full">
          {shouldRenderMetrics && (<div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600"/>
                <span>Candle Anatomy & Dynamics</span>
              </h4>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px] mb-0.5">Total Range</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(totalRange, currencyCode, locale)}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px] mb-0.5">Real Body Ratio</span>
                  <span className="font-mono font-bold text-blue-600">
                    {bodyToRangeRatio}% of range
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px] mb-0.5">Upper Shadow</span>
                  <span className="font-mono font-medium text-slate-700">
                    {formatCurrency(upperShadow, currencyCode, locale)}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px] mb-0.5">Lower Shadow</span>
                  <span className="font-mono font-medium text-slate-700">
                    {formatCurrency(lowerShadow, currencyCode, locale)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                <strong>Pedagogical Insight:</strong> Shadows reflect price exploration away from Open and Close. Context determines whether an extreme shadow indicates price rejection or intraperiod volatility.
              </p>
            </div>)}

          {shouldRenderSlider && (<div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="text-xs font-semibold text-slate-700 block">Interactive OHLC Slider</span>
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Close Price:</span>
                  <span className="text-blue-600 font-bold">{formatCurrency(ohlc.close, currencyCode, locale)}</span>
                </div>
                <input type="range" min={ohlc.low} max={ohlc.high} step={1} value={ohlc.close} onChange={(e) => handleSliderChange('close', Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" aria-label="Adjust Close Price Slider"/>
              </div>
            </div>)}
        </div>)}
    </div>);
};
