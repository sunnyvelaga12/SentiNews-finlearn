import React, { useState } from 'react';
import { CandlestickVisualizer, formatCurrency } from '../../../../components/charts/CandlestickVisualizer';
import {
  Calculator,
  FileSpreadsheet,
  BarChart,
  BookOpen,
  AlertTriangle,
  ShieldCheck,
  Heading,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle,
} from 'lucide-react';

/**
 * 1. Heading Renderer
 */
export const HeadingRenderer = ({ payload }) => {
  const level = payload?.level || 1;
  const title = payload?.title || payload?.text || 'Key Concept';
  const subtitle = payload?.subtitle;

  return (
    <div className="space-y-1.5 py-2">
      {level === 1 ? (
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 border-b border-slate-200 pb-2">
          {title}
        </h1>
      ) : level === 2 ? (
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          {title}
        </h2>
      ) : (
        <h3 className="text-lg font-bold text-slate-800">
          {title}
        </h3>
      )}
      {subtitle && <p className="text-xs sm:text-sm text-slate-500 font-medium">{subtitle}</p>}
    </div>
  );
};

/**
 * 2. Image Renderer
 */
export const ImageRenderer = ({ payload }) => {
  const imageUrl = payload?.url || payload?.image_url || payload?.src;
  const caption = payload?.caption;
  const alt = payload?.alt || caption || 'Educational financial illustration';

  if (!imageUrl) {
    return (
      <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
        <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-xs text-slate-400 font-medium">Illustration placeholder</p>
      </div>
    );
  }

  return (
    <figure className="space-y-2 text-center my-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm inline-block max-w-full">
        <img
          src={imageUrl}
          alt={alt}
          className="max-h-72 w-auto mx-auto object-contain rounded-xl transition-transform hover:scale-[1.01]"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className="text-xs text-slate-500 italic max-w-md mx-auto">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

/**
 * 3. Callout / Key Takeaway Renderer
 */
export const CalloutRenderer = ({ payload }) => {
  const tone = (payload?.tone || 'INFO').toUpperCase();
  const title = payload?.title || (tone === 'KEY_TAKEAWAY' ? 'Key Principle' : 'Important Note');
  const body = payload?.body || payload?.takeaway || 'Pay attention to this core market principle.';

  const toneStyles = {
    INFO: {
      bg: 'bg-blue-50/80 border-blue-200 text-blue-950',
      icon: Info,
      iconColor: 'text-blue-600',
    },
    TIP: {
      bg: 'bg-emerald-50/80 border-emerald-200 text-emerald-950',
      icon: CheckCircle,
      iconColor: 'text-emerald-600',
    },
    WARNING: {
      bg: 'bg-amber-50/80 border-amber-200 text-amber-950',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
    },
    KEY_TAKEAWAY: {
      bg: 'bg-indigo-50/80 border-indigo-200 text-indigo-950',
      icon: Sparkles,
      iconColor: 'text-indigo-600',
    },
  };

  const style = toneStyles[tone] || toneStyles.INFO;
  const ToneIcon = style.icon;

  return (
    <div className={`p-4 rounded-2xl border ${style.bg} space-y-1.5 shadow-sm`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
        <ToneIcon className={`w-4 h-4 ${style.iconColor} shrink-0`} />
        <span>{title}</span>
      </div>
      <p className="text-xs sm:text-sm leading-relaxed">{body}</p>
    </div>
  );
};

/**
 * 4. Analogy Dual-Card Renderer
 */
export const AnalogyRenderer = ({ payload }) => {
  const source = payload?.source_domain || payload?.metaphor || 'Everyday Intuition';
  const target = payload?.target_domain || payload?.concept || 'Financial Mechanism';
  const mapping = payload?.mapping_text || payload?.explanation || 'Both operate through identical equilibrium dynamics.';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
        <Sparkles className="w-4 h-4 text-emerald-600" />
        Everyday Intuition Analogy
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400">Intuitive Concept</span>
          <div className="text-sm font-bold text-slate-800">{source}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
          <span className="text-[10px] font-black uppercase text-blue-500">Market Mechanism</span>
          <div className="text-sm font-bold text-blue-900">{target}</div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900 leading-relaxed">
        <span className="font-bold">How it connects: </span>
        {mapping}
      </div>
    </div>
  );
};

/**
 * 5. Scenario Renderer
 */
export const ScenarioRenderer = ({ payload }) => {
  const context = payload?.context || 'You are observing liquidity behavior during an active trading session.';
  const dilemma = payload?.dilemma || 'How do you position risk given the sudden order book shift?';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase tracking-wider">
        <ArrowRight className="w-4 h-4 text-rose-600" />
        Market Scenario Simulation
      </div>
      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{context}</p>
      {dilemma && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-900">
          {dilemma}
        </div>
      )}
    </div>
  );
};

/**
 * 6. Candlestick Renderer (with contract-driven presentation mode & locale currency)
 */
export const CandlestickRenderer = ({
  payload,
  effectiveInteraction,
  presentationMode,
  currencyCode = 'INR',
  locale = 'en-IN',
  onInteraction,
}) => {
  const [practiceOHLC, setPracticeOHLC] = useState(
    payload?.ohlc || { open: 100, high: 120, low: 90, close: 110 }
  );

  const activeOHLC =
    effectiveInteraction === 'PRACTICE'
      ? practiceOHLC
      : payload?.ohlc || { open: 100, high: 120, low: 90, close: 110, timeframe: '1D' };

  const resolvedMode =
    presentationMode ||
    payload?.presentation_mode ||
    (effectiveInteraction === 'PRACTICE'
      ? 'INTERACTIVE'
      : effectiveInteraction === 'PREDICT'
      ? 'THINK'
      : 'EXPLAIN');

  const resolvedCurrency = payload?.currency_code || currencyCode;
  const resolvedLocale = payload?.locale || locale;

  return (
    <div className="w-full space-y-4">
      <CandlestickVisualizer
        initialOHLC={activeOHLC}
        presentationMode={resolvedMode}
        currencyCode={resolvedCurrency}
        locale={resolvedLocale}
        interactive={effectiveInteraction === 'PRACTICE'}
        showMetrics={resolvedMode === 'EXPLAIN'}
        showLabels={true}
        onInspectCandle={(data) => {
          if (onInteraction) onInteraction(data);
        }}
      />

      {effectiveInteraction === 'PRACTICE' && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium text-slate-700">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Open Price:</span>
              <span className="font-mono font-bold text-blue-600">
                {formatCurrency(practiceOHLC.open, resolvedCurrency, resolvedLocale)}
              </span>
            </div>
            <input
              aria-label="Adjust Open Price Slider"
              type="range"
              min="50"
              max="200"
              value={practiceOHLC.open}
              onChange={(e) => {
                const next = { ...practiceOHLC, open: Number(e.target.value) };
                setPracticeOHLC(next);
                if (onInteraction) onInteraction({ ohlc: next });
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Close Price:</span>
              <span
                className={`font-mono font-bold ${
                  practiceOHLC.close >= practiceOHLC.open
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {formatCurrency(practiceOHLC.close, resolvedCurrency, resolvedLocale)}
              </span>
            </div>
            <input
              aria-label="Adjust Close Price Slider"
              type="range"
              min="50"
              max="200"
              value={practiceOHLC.close}
              onChange={(e) => {
                const next = { ...practiceOHLC, close: Number(e.target.value) };
                setPracticeOHLC(next);
                if (onInteraction) onInteraction({ ohlc: next });
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 7. Chart Renderer (Price action line / bar charts)
 */
export const ChartRenderer = ({ payload }) => {
  const dataPoints = payload?.series || [100, 105, 102, 108, 115, 110, 120];
  const max = Math.max(...dataPoints, 1);
  const min = Math.min(...dataPoints, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
        <span className="flex items-center gap-1.5 text-slate-800">
          <BarChart className="w-4 h-4 text-blue-600" />
          {payload?.chart_title || 'Market Trend Series'}
        </span>
        <span className="font-mono text-slate-500">Period: {payload?.timeframe || '1D'}</span>
      </div>

      <div className="h-36 flex items-end gap-2 pt-4 px-2 border-b border-slate-200">
        {dataPoints.map((val, idx) => {
          const heightPct = Math.round(((val - min) / (max - min || 1)) * 80) + 15;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                style={{ height: `${heightPct}%` }}
                className="w-full bg-gradient-to-t from-blue-700 to-sky-500 rounded-t transition-all group-hover:brightness-95"
              />
              <span className="font-mono text-[10px] text-slate-500">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 8. Table Renderer (Financial data / comparison matrix / Order Book)
 */
export const TableRenderer = ({ payload }) => {
  const headers = payload?.headers || ['Metric', 'Period A', 'Period B', 'Delta'];
  const rows = payload?.rows || [
    ['Volume', '1.2M', '3.5M', '+191%'],
    ['High/Low Spread', '₹15.00', '₹42.00', '+180%'],
    ['Upper Wick Ratio', '12%', '48%', '+36%'],
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
            {headers.map((h, i) => (
              <th key={i} className="pb-3 px-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="py-2.5 px-3 font-mono">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * 9. Calculator Renderer (Financial ratio & position sizing)
 */
export const CalculatorRenderer = ({ payload, currencyCode = 'INR', locale = 'en-IN' }) => {
  const [inputVal, setInputVal] = useState(payload?.initial_value || 100);
  const multiplier = payload?.multiplier || 1.15;
  const result = inputVal * multiplier;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase">
        <Calculator className="w-4 h-4" />
        {payload?.calculator_title || 'Financial Calculation'}
      </div>
      <div className="space-y-2">
        <label className="text-xs text-slate-600 font-medium">Input Value:</label>
        <input
          type="number"
          value={inputVal}
          onChange={(e) => setInputVal(Number(e.target.value))}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold"
        />
      </div>
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
        <span className="text-slate-500 font-medium">Calculated Output:</span>
        <span className="text-emerald-700 font-mono font-bold text-base">
          {formatCurrency(result, currencyCode, locale)}
        </span>
      </div>
    </div>
  );
};

/**
 * 10. Financial Statement Renderer
 */
export const FinancialStatementRenderer = ({ payload }) => {
  const statement = payload?.statement || {
    Revenue: '₹5,420 Cr',
    'Operating Expenses': '₹3,200 Cr',
    EBITDA: '₹2,220 Cr',
    'Net Profit': '₹1,450 Cr',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase border-b border-slate-200 pb-2">
        <FileSpreadsheet className="w-4 h-4" />
        {payload?.statement_title || 'Financial Statement Snapshot'}
      </div>
      <div className="space-y-2 text-xs">
        {Object.entries(statement).map(([key, val]) => (
          <div key={key} className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">{key}</span>
            <span className="font-mono font-bold text-slate-900">{String(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 11. Text / Editorial Diagram Renderer
 */
export const TextRenderer = ({ payload }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase">
        <BookOpen className="w-4 h-4" />
        {payload?.heading || 'Key Pedagogical Principle'}
      </div>
      <div className="text-sm text-slate-700 leading-relaxed space-y-2">
        <p>
          {payload?.body ||
            'Price action reflects human behavior: buyers driving discovery, sellers enforcing boundaries.'}
        </p>
      </div>
    </div>
  );
};

/**
 * Statutory SEBI Investor Education Disclaimer Component
 */
export const SEBIDisclaimer = ({ className = '' }) => (
  <div
    className={`p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-500 leading-relaxed space-y-1 ${className}`}
    role="note"
    aria-label="SEBI Investor Education Statutory Notice"
  >
    <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider">
      <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
      <span>SEBI Investor Education Statutory Notice</span>
    </div>
    <p>
      This interactive module is developed strictly for investor education and financial literacy.
      SentiNews Learn does not offer investment advisory services, research analyst reports, price
      targets, or trading recommendations under SEBI (Investment Advisers) Regulations, 2013 or
      SEBI (Research Analysts) Regulations, 2014. Market prices are shown for conceptual demonstration
      only.
    </p>
  </div>
);

/**
 * Safe Fallback for Unsupported or Unregistered Renderers
 */
export const UnsupportedRendererFallback = ({ requestedType, isPreview }) => {
  return (
    <div
      role="alert"
      className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 shadow-sm space-y-3"
    >
      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wide">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        {isPreview ? '⚠ Unsupported Renderer in Preview' : 'Interactive Visualizer Unavailable'}
      </div>
      <p className="text-xs text-amber-800 leading-relaxed">
        {isPreview
          ? `The renderer identifier "${requestedType}" is not registered in the client RendererRegistry. Supported renderers: HEADING, TEXT, IMAGE, CALLOUT, ANALOGY, SCENARIO, CANDLESTICK, CHART, TABLE, CALCULATOR, FINANCIAL_STATEMENT.`
          : 'This interactive visualizer is currently being updated. Pedagogical instructions and questions remain accessible below.'}
      </p>
    </div>
  );
};

/**
 * Deterministic Internal Renderer Registry
 */
export const RendererRegistry = {
  HEADING: HeadingRenderer,
  TEXT: TextRenderer,
  IMAGE: ImageRenderer,
  CALLOUT: CalloutRenderer,
  ANALOGY: AnalogyRenderer,
  SCENARIO: ScenarioRenderer,
  CANDLESTICK: CandlestickRenderer,
  CHART: ChartRenderer,
  TABLE: TableRenderer,
  CALCULATOR: CalculatorRenderer,
  FINANCIAL_STATEMENT: FinancialStatementRenderer,
};

export const getRenderer = (type) => {
  if (!type) return TextRenderer;
  const normalized = type.toUpperCase();
  if (RendererRegistry[normalized]) {
    return RendererRegistry[normalized];
  }
  console.warn(
    `[RendererRegistry] Unrecognized renderer: "${type}". Dispatching UnsupportedRendererFallback.`
  );
  return (props) => <UnsupportedRendererFallback {...props} requestedType={type} />;
};
