import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { apiClient } from '../../../services/apiClient';
import { Brain, Plus, Link as LinkIcon, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
export const ConceptGraphManager = () => {
    const [concepts, setConcepts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);
    // Creation state
    const [newTitle, setNewTitle] = useState('');
    const [newDomain, setNewDomain] = useState('FOUNDATIONS');
    const [newJurisdiction, setNewJurisdiction] = useState('GLOBAL');
    const [newLevel, setNewLevel] = useState('L0_INTRO');
    // Prerequisite linking modal state
    const [linkingConcept, setLinkingConcept] = useState(null);
    const [prereqTargetId, setPrereqTargetId] = useState('');
    const [relType, setRelType] = useState('PREREQUISITE_OF');
    const [isStrictGate, setIsStrictGate] = useState(true);
    // Jurisdiction filter
    const [filterJurisdiction, setFilterJurisdiction] = useState('ALL');
    const fetchConcepts = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const data = await apiClient('/api/v1/concepts');
            setConcepts(data);
        }
        catch (err) {
            console.warn('Could not load concepts from live DB:', err);
            setErrorMsg(err.message || 'Failed to load concepts');
            setConcepts([]);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchConcepts();
    }, []);
    const handleCreateConcept = async () => {
        if (!newTitle.trim())
            return;
        const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        setErrorMsg(null);
        setStatusMsg(null);
        try {
            const created = await apiClient('/api/v1/concepts', {
                method: 'POST',
                body: JSON.stringify({
                    title: newTitle.trim(),
                    slug,
                    domain: newDomain,
                    jurisdiction: newJurisdiction,
                    learning_level: newLevel,
                    difficulty_tier: newLevel.startsWith('L0') ? 1 : newLevel.startsWith('L1') ? 2 : 3,
                    evidence_tier: 'NSE_SEBI_SEC_PRIMARY'
                })
            });
            setConcepts((prev) => [...prev, created]);
            setNewTitle('');
            setStatusMsg(`Successfully created concept: "${created.title}" [${created.jurisdiction}] in PostgreSQL.`);
        }
        catch (err) {
            setErrorMsg(err.message || 'Failed to create concept');
        }
    };
    const handleAddPrerequisite = async () => {
        if (!linkingConcept || !prereqTargetId)
            return;
        setErrorMsg(null);
        setStatusMsg(null);
        try {
            await apiClient(`/api/v1/concepts/${linkingConcept.id}/relationships`, {
                method: 'POST',
                body: JSON.stringify({
                    target_concept_id: prereqTargetId,
                    relationship_type: relType,
                    strength: 1.0,
                    pedagogical_intent: 'Core foundation prerequisite',
                    is_strict_gate: isStrictGate
                })
            });
            setStatusMsg(`Prerequisite relationship added: ${linkingConcept.title} → ${prereqTargetId}`);
            setLinkingConcept(null);
            setPrereqTargetId('');
            fetchConcepts();
        }
        catch (err) {
            // Highlights DFS cycle diagnostics if rejected
            setErrorMsg(`Graph Validation Error: ${err.message || 'Prerequisite mutation rejected'}`);
        }
    };
    const filteredConcepts = filterJurisdiction === 'ALL'
        ? concepts
        : concepts.filter((c) => (c.jurisdiction || 'GLOBAL') === filterJurisdiction);
    return (<div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Brain className="w-5 h-5 text-senti-blue"/>
          <span>CANONICAL CONCEPT GRAPH MANAGER</span>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterJurisdiction} onChange={(e) => setFilterJurisdiction(e.target.value)} className="text-xs font-bold border rounded-lg px-2.5 py-1.5 bg-white text-slate-700">
            <option value="ALL">All Jurisdictions</option>
            <option value="GLOBAL">GLOBAL</option>
            <option value="IN">IN (India / NSE / SEBI / RBI)</option>
            <option value="US">US (SEC / FINRA / Fed)</option>
            <option value="UK">UK (FCA / BoE)</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchConcepts} disabled={loading} className="gap-1 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/> Refresh
          </Button>
          <Badge variant="emerald">{filteredConcepts.length} Active Nodes</Badge>
        </div>
      </div>

      {/* Live Alerts Banner */}
      {statusMsg && (<div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold rounded-2xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0"/>
          <span>{statusMsg}</span>
        </div>)}

      {errorMsg && (<div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-sm font-semibold rounded-2xl flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"/>
          <div>
            <div className="font-extrabold">Graph Integrity Violation Rejection</div>
            <div className="text-xs font-mono mt-1 text-rose-800">{errorMsg}</div>
          </div>
        </div>)}

      {/* Form: Create Concept */}
      <Card className="space-y-4 p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-senti-blue"/> Create Knowledge Concept Node
          </h3>
          <Badge variant="blue">PostgreSQL Source of Truth</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input type="text" placeholder="Concept Title (e.g. Purchasing Power Parity)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="p-2.5 text-sm border rounded-xl sm:col-span-2 focus:border-senti-blue focus:outline-none"/>
          <select value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="p-2.5 text-sm border rounded-xl bg-white font-medium">
            <option value="FOUNDATIONS">Foundations</option>
            <option value="INVESTING_EQUITIES">Equities & Stocks</option>
            <option value="FIXED_INCOME_DEBT">Fixed Income & Debt</option>
            <option value="MACRO_ECONOMICS">Macro & Central Banks</option>
            <option value="RISK_PORTFOLIO">Risk & Portfolio</option>
          </select>
          <select value={newJurisdiction} onChange={(e) => setNewJurisdiction(e.target.value)} className="p-2.5 text-sm border rounded-xl bg-white font-medium">
            <option value="GLOBAL">GLOBAL (Universal)</option>
            <option value="IN">IN (India / NSE / SEBI)</option>
            <option value="US">US (United States / SEC)</option>
          </select>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Proficiency Level:</span>
            {['L0_INTRO', 'L1_BUILDER', 'L2_PRACTITIONER', 'L3_EXPERT'].map((lvl) => (<button key={lvl} type="button" onClick={() => setNewLevel(lvl)} className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors ${newLevel === lvl ? 'bg-senti-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {lvl}
              </button>))}
          </div>
          <Button variant="primary" size="sm" onClick={handleCreateConcept} disabled={!newTitle.trim()}>
            Save Node to PostgreSQL
          </Button>
        </div>
      </Card>

      {/* Prerequisite Linking Modal / Drawer */}
      {linkingConcept && (<Card className="p-6 bg-blue-50/70 border-2 border-blue-300 rounded-3xl space-y-4 animate-fade-in shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-slate-900">
              <LinkIcon className="w-5 h-5 text-senti-blue"/>
              <span>Link Prerequisite Edge for: {linkingConcept.title}</span>
            </div>
            <button onClick={() => setLinkingConcept(null)} className="text-xs font-bold text-slate-500 hover:text-slate-900">
              ✕ Cancel
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Adding a prerequisite edge automatically validates acyclic topology with concurrency safety (PostgreSQL advisory locks) and rejects cyclic paths.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={prereqTargetId} onChange={(e) => setPrereqTargetId(e.target.value)} className="p-2.5 text-sm border rounded-xl bg-white font-medium sm:col-span-2">
              <option value="">Select Target Prerequisite Node...</option>
              {concepts
                .filter((c) => c.id !== linkingConcept.id)
                .map((c) => (<option key={c.id} value={c.id}>
                    {c.title} ({c.domain} · {c.learning_level || 'L0'})
                  </option>))}
            </select>

            <select value={relType} onChange={(e) => setRelType(e.target.value)} className="p-2.5 text-sm border rounded-xl bg-white font-medium">
              <option value="PREREQUISITE_OF">Strict Prerequisite</option>
              <option value="EXTENDS">Extends Concept</option>
              <option value="RELATED">Related Intuition</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-blue-200">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={isStrictGate} onChange={(e) => setIsStrictGate(e.target.checked)} className="rounded accent-senti-blue"/>
              Enforce Strict Mastery Gate (Learner must master prerequisite before unlocking)
            </label>
            <Button variant="primary" size="sm" onClick={handleAddPrerequisite} disabled={!prereqTargetId}>
              Commit Safe Prerequisite Edge
            </Button>
          </div>
        </Card>)}

      {/* Concepts List */}
      <div className="space-y-3">
        {filteredConcepts.map((c) => (<Card key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-slate-200 hover:border-slate-300 transition-all rounded-2xl shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm">{c.title}</span>
                <Badge variant="blue" className="text-[10px]">{c.learning_level || 'L0_INTRO'}</Badge>
                <Badge variant="slate" className="text-[10px] font-mono">{c.jurisdiction || 'GLOBAL'}</Badge>
              </div>
              <div className="text-xs font-mono text-slate-400">
                slug: {c.slug} · id: {c.id.substring(0, 8)}...
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="emerald">{c.domain}</Badge>
              <Button size="sm" variant="outline" onClick={() => setLinkingConcept(c)} className="text-xs gap-1.5 font-bold">
                <LinkIcon className="w-3.5 h-3.5 text-senti-blue"/> Add Prerequisite
              </Button>
            </div>
          </Card>))}
      </div>
    </div>);
};
