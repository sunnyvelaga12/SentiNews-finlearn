import React, { useState } from 'react';
import { Folder, ChevronRight, ChevronDown, Plus, Search, CheckCircle2, Clock, FileEdit, Layers, BookOpen, } from 'lucide-react';
export const CurriculumNavigator = ({ tree, selectedLessonId, hasUnsavedChanges = false, onSelectLesson, onCreateModule, onCreateUnit, onCreateLesson, onPromptUnsavedChanges, }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [expandedModules, setExpandedModules] = useState({});
    const [expandedUnits, setExpandedUnits] = useState({});
    // Modals for staged creation (No orphan content!)
    const [showAddModuleModal, setShowAddModuleModal] = useState(false);
    const [newModuleName, setNewModuleName] = useState('');
    const [newModuleDescription, setNewModuleDescription] = useState('');
    const [showAddUnitModal, setShowAddUnitModal] = useState(false);
    const [showAddLessonModal, setShowAddLessonModal] = useState(false);
    const [selectedModuleForUnit, setSelectedModuleForUnit] = useState('');
    const [newUnitName, setNewUnitName] = useState('');
    const [selectedUnitForLesson, setSelectedUnitForLesson] = useState('');
    const [newLessonTitle, setNewLessonTitle] = useState('');
    // Default expansion
    React.useEffect(() => {
        const mods = {};
        const uns = {};
        tree.forEach((group) => {
            group.modules.forEach((m) => {
                mods[m.id] = true;
                m.units.forEach((u) => {
                    uns[u.id] = true;
                });
            });
        });
        setExpandedModules((prev) => ({ ...mods, ...prev }));
        setExpandedUnits((prev) => ({ ...uns, ...prev }));
    }, [tree]);
    const toggleModule = (id) => {
        setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
    };
    const toggleUnit = (id) => {
        setExpandedUnits((prev) => ({ ...prev, [id]: !prev[id] }));
    };
    const handleLessonClick = (lesson, unit, mod) => {
        if (lesson.id === selectedLessonId)
            return;
        if (hasUnsavedChanges && onPromptUnsavedChanges) {
            onPromptUnsavedChanges(() => onSelectLesson(lesson, unit, mod));
        }
        else {
            onSelectLesson(lesson, unit, mod);
        }
    };
    // Status badge styling helper
    const renderStatusBadge = (status) => {
        switch (status) {
            case 'PUBLISHED':
                return (<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-2.5 h-2.5"/> Published
          </span>);
            case 'APPROVED':
                return (<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <CheckCircle2 className="w-2.5 h-2.5"/> Approved
          </span>);
            case 'EDITOR_REVIEW':
            case 'FINANCE_REVIEW':
            case 'COMPLIANCE_REVIEW':
                return (<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Clock className="w-2.5 h-2.5"/> Review
          </span>);
            case 'DRAFT':
            default:
                return (<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <FileEdit className="w-2.5 h-2.5"/> Draft
          </span>);
        }
    };
    return (<div className="flex flex-col h-full bg-white border-r border-slate-200 select-none text-slate-800">
      {/* ── Top Header & Actions ── */}
      <div className="p-3.5 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600"/>
            <span className="text-xs font-black tracking-wider uppercase text-slate-900">
              Curriculum Navigator
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAddModuleModal(true)}
              title="Add New Module"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Module</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400"/>
          <input type="text" placeholder="Filter lessons..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 placeholder-slate-400"/>
        </div>

        {/* Status Quick Filter */}
        <div className="flex items-center gap-1.5 text-[11px] overflow-x-auto pb-1 text-slate-500">
          <span className="font-semibold text-slate-400">Show:</span>
          {['ALL', 'DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'].map((filter) => (<button key={filter} onClick={() => setStatusFilter(filter)} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${statusFilter === filter
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
              {filter}
            </button>))}
        </div>
      </div>

      {/* ── Hierarchy Tree View ── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tree.map((group, gIdx) => (<div key={gIdx} className="space-y-1">
            {group.domain && (<div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {group.domain}
              </div>)}

            {group.modules.map((mod) => {
                const isModExpanded = expandedModules[mod.id] !== false;
                return (<div key={mod.id} className="space-y-0.5">
                  {/* Module Item Header */}
                  <div onClick={() => toggleModule(mod.id)} className="group flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-1.5 truncate">
                      {isModExpanded ? (<ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0"/>) : (<ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0"/>)}
                      <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0"/>
                      <span className="truncate">{mod.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal ml-0.5">({mod.units?.length || 0})</span>
                    </div>

                    <button onClick={(e) => {
                        e.stopPropagation();
                        setSelectedModuleForUnit(mod.id);
                        setShowAddUnitModal(true);
                    }} title="Add Unit to Module" className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-opacity">
                      <Plus className="w-3.5 h-3.5"/>
                    </button>
                  </div>

                  {/* Units inside Module */}
                  {isModExpanded && (<div className="pl-4 space-y-0.5 border-l border-slate-200 ml-3">
                      {mod.units.map((unit) => {
                            const isUnitExpanded = expandedUnits[unit.id] !== false;
                            // Filter lessons by search and status
                            const filteredLessons = unit.lessons.filter((l) => {
                                const matchesSearch = searchTerm === '' ||
                                    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    l.slug.toLowerCase().includes(searchTerm.toLowerCase());
                                const matchesStatus = statusFilter === 'ALL' ||
                                    (statusFilter === 'REVIEW'
                                        ? l.status.includes('REVIEW')
                                        : l.status === statusFilter);
                                return matchesSearch && matchesStatus;
                            });
                            return (<div key={unit.id} className="space-y-0.5">
                            {/* Unit Item Header */}
                            <div onClick={() => toggleUnit(unit.id)} className="group flex items-center justify-between px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-xs font-medium text-slate-700">
                              <div className="flex items-center gap-1.5 truncate">
                                {isUnitExpanded ? (<ChevronDown className="w-3 h-3 text-slate-400 shrink-0"/>) : (<ChevronRight className="w-3 h-3 text-slate-400 shrink-0"/>)}
                                <BookOpen className="w-3 h-3 text-slate-500 shrink-0"/>
                                <span className="truncate text-[11px] font-semibold text-slate-700">
                                  {unit.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal ml-0.5">({unit.lessons?.length || 0})</span>
                              </div>

                              <button onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedUnitForLesson(unit.id);
                                    setShowAddLessonModal(true);
                                }} title="Add Lesson to Unit" className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-opacity">
                                <Plus className="w-3.5 h-3.5"/>
                              </button>
                            </div>

                            {/* Lessons inside Unit */}
                            {isUnitExpanded && (<div className="pl-3 space-y-0.5 border-l border-slate-200 ml-2">
                                {filteredLessons.length === 0 ? (<div className="px-2 py-1 text-[10px] italic text-slate-400">
                                    No lessons match filter
                                  </div>) : (filteredLessons.map((l) => {
                                        const isSelected = l.id === selectedLessonId;
                                        const isDirty = isSelected && hasUnsavedChanges;
                                        return (<div key={l.id} onClick={() => handleLessonClick(l, unit, mod)} className={`group px-2 py-1.5 rounded cursor-pointer transition-all flex flex-col gap-0.5 border ${isSelected
                                                ? 'bg-blue-50/80 border-blue-400/80 text-blue-950 shadow-sm'
                                                : 'border-transparent hover:bg-slate-100 text-slate-700'}`}>
                                        <div className="flex items-center justify-between gap-1.5">
                                          <div className="flex items-center gap-1.5 truncate">
                                            {isDirty ? (<span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unsaved local changes"/>) : (<span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-slate-300'} shrink-0`}/>)}
                                            <span className="text-xs font-semibold truncate">
                                              {l.title}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-slate-400 pl-3">
                                          <span>v{l.version_number || 1}</span>
                                          {renderStatusBadge(l.status)}
                                        </div>
                                      </div>);
                                    }))}
                              </div>)}
                          </div>);
                        })}
                    </div>)}
                </div>);
            })}
          </div>))}
      </div>

      {/* ── Staged Modal: Add Unit (Ensures no orphan units without module) ── */}
      {showAddUnitModal && (<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create New Unit</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Target Module</label>
                <select value={selectedModuleForUnit} onChange={(e) => setSelectedModuleForUnit(e.target.value)} className="w-full mt-1 p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500">
                  {tree.flatMap((g) => g.modules.map((m) => (<option key={m.id} value={m.id}>
                        {m.name}
                      </option>)))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Unit Name</label>
                <input type="text" placeholder="e.g. Unit 2: Single Candle Patterns" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} className="w-full mt-1 p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddUnitModal(false)} className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={() => {
                if (newUnitName.trim() && onCreateUnit) {
                    onCreateUnit(selectedModuleForUnit, newUnitName.trim());
                    setNewUnitName('');
                    setShowAddUnitModal(false);
                }
            }} disabled={!newUnitName.trim()} className="px-3 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white">
                Create Unit
              </button>
            </div>
          </div>
        </div>)}

      {/* ── Staged Modal: Add Lesson (Ensures no orphan lessons without unit) ── */}
      {showAddLessonModal && (<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create New Lesson</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Target Unit</label>
                <select value={selectedUnitForLesson} onChange={(e) => setSelectedUnitForLesson(e.target.value)} className="w-full mt-1 p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500">
                  {tree.flatMap((g) => g.modules.flatMap((m) => m.units.map((u) => (<option key={u.id} value={u.id}>
                          {m.name} → {u.name}
                        </option>))))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Lesson Title</label>
                <input type="text" placeholder="e.g. Bullish & Bearish Candle Momentum" value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} className="w-full mt-1 p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddLessonModal(false)} className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={() => {
                if (newLessonTitle.trim() && onCreateLesson) {
                    onCreateLesson(selectedUnitForLesson, newLessonTitle.trim());
                    setNewLessonTitle('');
                    setShowAddLessonModal(false);
                }
            }} disabled={!newLessonTitle.trim()} className="px-3 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white">
                Create Lesson Draft
              </button>
            </div>
          </div>
        </div>)}

      {/* ── Staged Modal: Add Module (Flexible Curriculum Architecture) ── */}
      {showAddModuleModal && (<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create New Module</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Module Name</label>
                <input type="text" placeholder="e.g. Market Macro & Liquidity" value={newModuleName} onChange={(e) => setNewModuleName(e.target.value)} className="w-full mt-1 p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500 text-slate-800"/>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Description</label>
                <textarea rows={3} placeholder="e.g. Master interest rates, inflation indicators, and central bank policy cycles." value={newModuleDescription} onChange={(e) => setNewModuleDescription(e.target.value)} className="w-full mt-1 p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500 text-slate-800 resize-none"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddModuleModal(false)} className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={() => {
                if (newModuleName.trim() && onCreateModule) {
                    onCreateModule(newModuleName.trim(), newModuleDescription.trim());
                    setNewModuleName('');
                    setNewModuleDescription('');
                    setShowAddModuleModal(false);
                }
            }} disabled={!newModuleName.trim()} className="px-3 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white">
                Create Module
              </button>
            </div>
          </div>
        </div>)}
    </div>);
};
