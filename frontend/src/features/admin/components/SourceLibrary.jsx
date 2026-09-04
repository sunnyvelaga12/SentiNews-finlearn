import React, { useState } from 'react';
import { Building2, Search, Filter, Plus, ExternalLink, Calendar, Shield, Copy, } from 'lucide-react';
export const SourceLibrary = ({ onAttachSource }) => {
    const [sources, setSources] = useState([
        {
            id: 'src_nse_nifty_momentum',
            provider: 'NSE',
            title: 'Nifty 50 Resistance Breakout & Flat-Top Close',
            instrument: 'NIFTY 50',
            date: '2026-08-28',
            timeframe: '1D',
            source_url: 'https://www.nseindia.com/market-data/live-market-indices',
            jurisdiction: 'India (SEBI Regulated)',
            description: 'Daily expansion candle opening at 24,000 and closing at day high 24,480 with zero upper wick.',
            sample_payload: { open: 24000, high: 24500, low: 23950, close: 24480 },
        },
        {
            id: 'src_bse_sensex_hammer',
            provider: 'BSE',
            title: 'BSE Sensex Election Day Flash Liquidity Sweep (Hammer)',
            instrument: 'SENSEX',
            date: '2024-06-04',
            timeframe: '1D',
            source_url: 'https://www.bseindia.com',
            jurisdiction: 'India (SEBI Regulated)',
            description: 'Severe intraday drop absorbing resting institutional bids before bouncing 4,000 points into session close.',
            sample_payload: { open: 76500, high: 77000, low: 70800, close: 76200 },
        },
        {
            id: 'src_sebi_pit_reg',
            provider: 'SEBI',
            title: 'SEBI Prohibition of Insider Trading (PIT) Master Circular',
            instrument: 'ALL EQUITIES',
            date: '2024-01-15',
            timeframe: 'LEGAL',
            source_url: 'https://www.sebi.gov.in/legal/master-circulars/jan-2024/pit-regulations.html',
            jurisdiction: 'India (SEBI Statutory Authority)',
            description: 'Statutory definition of Unpublished Price Sensitive Information (UPSI) and pre-clearance limits.',
        },
        {
            id: 'src_rbi_mpc_rate',
            provider: 'RBI',
            title: 'RBI Monetary Policy Committee 25 bps Benchmark Rate Decision',
            instrument: 'REPO RATE / 10Y G-SEC',
            date: '2025-10-08',
            timeframe: 'POLICY',
            source_url: 'https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx',
            jurisdiction: 'India (RBI Statutory)',
            description: 'Resolution of the Monetary Policy Committee detailing repo rate transmission into bank lending yields.',
        },
    ]);
    const [providerFilter, setProviderFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    // New Source Form State
    const [newTitle, setNewTitle] = useState('');
    const [newProvider, setNewProvider] = useState('NSE');
    const [newInstrument, setNewInstrument] = useState('');
    const [newDate, setNewDate] = useState('2026-08-28');
    const [newTimeframe, setNewTimeframe] = useState('1D');
    const [newUrl, setNewUrl] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const handleCopyCitation = (s) => {
        const text = `${s.provider} · ${s.instrument} (${s.date}, ${s.timeframe}): ${s.source_url}`;
        navigator.clipboard.writeText(text);
        setCopiedId(s.id);
        setTimeout(() => setCopiedId(null), 2000);
    };
    const handleCreateSource = () => {
        if (!newTitle.trim() || !newInstrument.trim())
            return;
        const newSrc = {
            id: `src_${Date.now()}`,
            provider: newProvider,
            title: newTitle.trim(),
            instrument: newInstrument.trim(),
            date: newDate,
            timeframe: newTimeframe,
            source_url: newUrl.trim() || 'https://www.nseindia.com',
            jurisdiction: 'India (SEBI Regulated)',
            description: newDescription.trim() || 'Verified financial observation.',
        };
        setSources([newSrc, ...sources]);
        setShowAddModal(false);
        setNewTitle('');
        setNewInstrument('');
        setNewDescription('');
    };
    const filtered = sources.filter((s) => {
        const matchesProvider = providerFilter === 'ALL' || s.provider === providerFilter;
        const matchesSearch = searchTerm === '' ||
            s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.instrument.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesProvider && matchesSearch;
    });
    return (<div className="flex-1 overflow-y-auto bg-[#FBFBFA] p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* ── Surface Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600"/>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Verified Financial Sources & Citations Library
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Exchange data provenance and statutory filing citations ensuring pedagogical content credibility.
          </p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-sm">
          <Plus className="w-4 h-4"/>
          <span>Register New Source</span>
        </button>
      </div>

      {/* ── Search and Provider Filter Ribbon ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400"/>
          <input type="text" placeholder="Search by instrument, exchange, or keyword..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="text-xs bg-transparent focus:outline-none w-72 text-slate-800 placeholder-slate-400"/>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Filter className="w-3.5 h-3.5 text-slate-400"/>
          <span>Authority:</span>
          {['ALL', 'NSE', 'BSE', 'SEBI', 'RBI'].map((p) => (<button key={p} onClick={() => setProviderFilter(p)} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${providerFilter === p
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
              {p}
            </button>))}
        </div>
      </div>

      {/* ── Sources Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((s) => (<div key={s.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                  <Shield className="w-3 h-3 text-blue-600"/>
                  {s.provider} Verified
                </span>

                <span className="text-[11px] font-bold text-slate-500 font-mono">
                  {s.instrument} · {s.timeframe}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 leading-snug">{s.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400"/>
                <span>{s.date}</span>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => handleCopyCitation(s)} className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
                  <Copy className="w-3 h-3"/>
                  <span>{copiedId === s.id ? 'Copied!' : 'Copy Citation'}</span>
                </button>

                {s.source_url && (<a href={s.source_url} target="_blank" rel="noreferrer" className="p-1 hover:text-blue-600 text-slate-400">
                    <ExternalLink className="w-3.5 h-3.5"/>
                  </a>)}

                {onAttachSource && (<button onClick={() => onAttachSource(s)} className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold">
                    Attach
                  </button>)}
              </div>
            </div>
          </div>))}
      </div>

      {/* ── Add New Source Modal ── */}
      {showAddModal && (<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-black text-slate-900">Register Verified Financial Source</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Source Title</label>
                <input type="text" placeholder="e.g. Nifty 50 Intraday Reversal 2026" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Provider Authority</label>
                  <select value={newProvider} onChange={(e) => setNewProvider(e.target.value)} className="w-full p-2 border border-slate-200 rounded bg-slate-50 font-semibold">
                    <option value="NSE">NSE (India)</option>
                    <option value="BSE">BSE (India)</option>
                    <option value="SEBI">SEBI (Regulator)</option>
                    <option value="RBI">RBI (Central Bank)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Instrument Symbol</label>
                  <input type="text" placeholder="e.g. NIFTY 50" value={newInstrument} onChange={(e) => setNewInstrument(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Observation Date</label>
                  <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Timeframe</label>
                  <select value={newTimeframe} onChange={(e) => setNewTimeframe(e.target.value)} className="w-full p-2 border border-slate-200 rounded bg-slate-50">
                    <option value="1m">1 Minute</option>
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="1D">1 Day (Daily)</option>
                    <option value="1W">1 Week</option>
                    <option value="POLICY">Policy/Statutory</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Filing URL / Link</label>
                <input type="text" placeholder="https://www.nseindia.com/..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Contextual Description</label>
                <textarea rows={2} placeholder="Explain why this market event or regulation is relevant..." value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setShowAddModal(false)} className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={handleCreateSource} disabled={!newTitle.trim() || !newInstrument.trim()} className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm">
                Register Source
              </button>
            </div>
          </div>
        </div>)}
    </div>);
};
