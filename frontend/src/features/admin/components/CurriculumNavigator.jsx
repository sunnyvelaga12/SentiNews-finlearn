import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Compass,
  Layers,
  Folder,
  BookOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  FileEdit,
  Sparkles,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../../services/apiClient';

export const CurriculumNavigator = ({
  tree = [],
  selectedLessonId,
  hasUnsavedChanges = false,
  onSelectLesson,
  onCreateModule,
  onCreateUnit,
  onCreateLesson,
  onPromptUnsavedChanges,
  onEditModule,
  onDeleteModule,
  onEditUnit,
  onDeleteUnit,
  onDeleteLesson,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Expansion states across the 6-level hierarchy
  const [expandedDomains, setExpandedDomains] = useState({});
  const [expandedWorlds, setExpandedWorlds] = useState({});
  const [expandedSeries, setExpandedSeries] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [expandedUnits, setExpandedUnits] = useState({});

  // Modals for staged creation (No orphan content!)
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [moduleForm, setModuleForm] = useState({
    series_id: '',
    name: '',
    slug: '',
    description: '',
    learner_goal: '',
    why_this_matters: '',
    learning_outcomes: '',
    completion_criteria: '',
    estimated_hours: 1.5,
    level: 'BEGINNER',
  });

  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [unitForm, setUnitForm] = useState({
    module_id: '',
    name: '',
    description: '',
  });

  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [lessonForm, setLessonForm] = useState({
    unit_id: '',
    title: '',
    duration_minutes: 5,
    level: 'BEGINNER',
    learning_objectives: '',
  });

  // ── Edit Modals ──────────────────────────────────────────────────────────
  const [showEditModuleModal, setShowEditModuleModal] = useState(false);
  const [editModuleTarget, setEditModuleTarget] = useState(null); // { id, name, description, level, estimated_hours, learner_goal, why_this_matters, learning_outcomes }
  const [editModuleForm, setEditModuleForm] = useState({});

  const [showEditUnitModal, setShowEditUnitModal] = useState(false);
  const [editUnitTarget, setEditUnitTarget] = useState(null); // { id, name, description }
  const [editUnitForm, setEditUnitForm] = useState({});

  // ── Delete Confirmation Dialog ────────────────────────────────────────────
  const [deleteDialog, setDeleteDialog] = useState(null); // { type, id, name, onConfirm }
  const [isDeleting, setIsDeleting] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Collect flat lists for selector dropdowns
  const availableSeries = useMemo(() => {
    const list = [];
    tree.forEach((domain) => {
      (domain.worlds || []).forEach((world) => {
        (world.series || []).forEach((s) => {
          list.push({
            id: s.id,
            label: `${domain.name} → ${world.name} → ${s.name}`,
          });
        });
      });
    });
    return list;
  }, [tree]);

  const availableModules = useMemo(() => {
    const list = [];
    tree.forEach((domain) => {
      (domain.worlds || []).forEach((world) => {
        (world.series || []).forEach((s) => {
          (s.modules || []).forEach((m) => {
            list.push({
              id: m.id,
              name: m.name,
              label: `${m.name} (${domain.name})`,
            });
          });
        });
      });
    });
    return list;
  }, [tree]);

  const availableUnits = useMemo(() => {
    const list = [];
    tree.forEach((domain) => {
      (domain.worlds || []).forEach((world) => {
        (world.series || []).forEach((s) => {
          (s.modules || []).forEach((m) => {
            (m.units || []).forEach((u) => {
              list.push({
                id: u.id,
                label: `${m.name} → ${u.name}`,
              });
            });
          });
        });
      });
    });
    return list;
  }, [tree]);

  // Default expansion on tree load
  useEffect(() => {
    const doms = {};
    const wrlds = {};
    const sers = {};
    const mods = {};
    const uns = {};

    tree.forEach((domain) => {
      doms[domain.id] = true;
      (domain.worlds || []).forEach((world) => {
        wrlds[world.id] = true;
        (world.series || []).forEach((s) => {
          sers[s.id] = true;
          (s.modules || []).forEach((m) => {
            mods[m.id] = true;
            (m.units || []).forEach((u) => {
              uns[u.id] = true;
            });
          });
        });
      });
    });

    setExpandedDomains((prev) => ({ ...doms, ...prev }));
    setExpandedWorlds((prev) => ({ ...wrlds, ...prev }));
    setExpandedSeries((prev) => ({ ...sers, ...prev }));
    setExpandedModules((prev) => ({ ...mods, ...prev }));
    setExpandedUnits((prev) => ({ ...uns, ...prev }));
  }, [tree]);

  const toggleDomain = (id) => setExpandedDomains((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleWorld = (id) => setExpandedWorlds((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleSeries = (id) => setExpandedSeries((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleModule = (id) => setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleUnit = (id) => setExpandedUnits((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleLessonClick = (lesson, unit, mod) => {
    if (lesson.id === selectedLessonId) return;
    if (hasUnsavedChanges && onPromptUnsavedChanges) {
      onPromptUnsavedChanges(() => onSelectLesson(lesson, unit, mod));
    } else {
      onSelectLesson(lesson, unit, mod);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" /> Published
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" /> Approved
          </span>
        );
      case 'EDITOR_REVIEW':
      case 'FINANCE_REVIEW':
      case 'COMPLIANCE_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Clock className="w-2.5 h-2.5" /> Review
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <FileEdit className="w-2.5 h-2.5" /> Draft
          </span>
        );
    }
  };

  const handleOpenAddModule = () => {
    setModuleForm({
      series_id: availableSeries[0]?.id || '',
      name: '',
      slug: '',
      description: '',
      learner_goal: '',
      why_this_matters: '',
      learning_outcomes: '',
      completion_criteria: '',
      estimated_hours: 1.5,
      level: 'BEGINNER',
    });
    setShowAddModuleModal(true);
  };

  const handleOpenAddUnit = (defaultModuleId = null) => {
    setUnitForm({
      module_id: defaultModuleId || availableModules[0]?.id || '',
      name: '',
      description: '',
    });
    setShowAddUnitModal(true);
  };

  const handleOpenAddLesson = (defaultUnitId = null) => {
    setLessonForm({
      unit_id: defaultUnitId || availableUnits[0]?.id || '',
      title: '',
      duration_minutes: 5,
      level: 'BEGINNER',
      learning_objectives: '',
    });
    setShowAddLessonModal(true);
  };

  const handleConfirmCreateModule = async () => {
    if (!moduleForm.name.trim() || !onCreateModule) return;
    const outcomesArray = moduleForm.learning_outcomes
      ? moduleForm.learning_outcomes.split('\n').map((s) => s.trim()).filter(Boolean)
      : [];
    await onCreateModule({
      series_id: moduleForm.series_id || undefined,
      name: moduleForm.name.trim(),
      slug: moduleForm.slug.trim() || undefined,
      description: moduleForm.description.trim(),
      learner_goal: moduleForm.learner_goal.trim() || `Master ${moduleForm.name.trim()}`,
      why_this_matters: moduleForm.why_this_matters.trim() || `Foundational competency in ${moduleForm.name.trim()}`,
      learning_outcomes: outcomesArray.length > 0 ? outcomesArray : [`Understand ${moduleForm.name.trim()}`],
      completion_criteria: moduleForm.completion_criteria.trim() || 'Complete all unit milestones with >= 80%',
      estimated_hours: Number(moduleForm.estimated_hours) || 1.5,
      level: moduleForm.level,
    });
    setShowAddModuleModal(false);
  };

  const handleConfirmCreateUnit = async () => {
    if (!unitForm.name.trim() || !unitForm.module_id || !onCreateUnit) return;
    await onCreateUnit(unitForm.module_id, unitForm.name.trim(), unitForm.description.trim());
    setShowAddUnitModal(false);
  };

  const handleConfirmCreateLesson = async () => {
    if (!lessonForm.title.trim() || !lessonForm.unit_id || !onCreateLesson) return;
    const objectivesArray = lessonForm.learning_objectives
      ? lessonForm.learning_objectives.split('\n').map((s) => s.trim()).filter(Boolean)
      : [`Understand ${lessonForm.title.trim()}`];
    await onCreateLesson(lessonForm.unit_id, {
      title: lessonForm.title.trim(),
      durationMinutes: Number(lessonForm.duration_minutes) || 5,
      level: lessonForm.level,
      learningObjectives: objectivesArray,
    });
    setShowAddLessonModal(false);
  };

  // ── Edit Handlers ──────────────────────────────────────────────────────────
  const handleOpenEditModule = (e, mod) => {
    e.stopPropagation();
    setEditModuleTarget(mod);
    setEditModuleForm({
      name: mod.name || '',
      description: mod.description || '',
      level: mod.level || 'BEGINNER',
      estimated_hours: mod.estimated_hours || 1.5,
      learner_goal: mod.learner_goal || '',
      why_this_matters: mod.why_this_matters || '',
      learning_outcomes: Array.isArray(mod.learning_outcomes)
        ? mod.learning_outcomes.join('\n')
        : (mod.learning_outcomes || ''),
    });
    setShowEditModuleModal(true);
  };

  const handleConfirmEditModule = async () => {
    if (!editModuleTarget?.id || !editModuleForm.name.trim()) return;
    setIsSavingEdit(true);
    try {
      const outcomesArray = editModuleForm.learning_outcomes
        ? editModuleForm.learning_outcomes.split('\n').map((s) => s.trim()).filter(Boolean)
        : [];
      await apiClient(`/api/v1/curriculum/modules/${editModuleTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editModuleForm.name.trim(),
          description: editModuleForm.description.trim(),
          level: editModuleForm.level,
          estimated_hours: Number(editModuleForm.estimated_hours) || 1.5,
          learner_goal: editModuleForm.learner_goal.trim(),
          why_this_matters: editModuleForm.why_this_matters.trim(),
          learning_outcomes: outcomesArray.length > 0 ? outcomesArray : undefined,
        }),
      });
      if (onEditModule) await onEditModule();
      setShowEditModuleModal(false);
    } catch (err) {
      console.error('Failed to edit module:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenEditUnit = (e, unit) => {
    e.stopPropagation();
    setEditUnitTarget(unit);
    setEditUnitForm({
      name: unit.name || '',
      description: unit.description || '',
    });
    setShowEditUnitModal(true);
  };

  const handleConfirmEditUnit = async () => {
    if (!editUnitTarget?.id || !editUnitForm.name.trim()) return;
    setIsSavingEdit(true);
    try {
      await apiClient(`/api/v1/curriculum/units/${editUnitTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editUnitForm.name.trim(),
          description: editUnitForm.description.trim(),
        }),
      });
      if (onEditUnit) await onEditUnit();
      setShowEditUnitModal(false);
    } catch (err) {
      console.error('Failed to edit unit:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────
  const promptDelete = (e, type, id, name, onConfirm) => {
    e.stopPropagation();
    setForceDelete(false);
    setDeleteError(null);
    setDeleteDialog({ type, id, name, onConfirm });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteDialog.onConfirm(forceDelete);
      setDeleteDialog(null);
    } catch (err) {
      console.error('Delete failed:', err);
      const msg = err?.details?.detail || err?.message || 'Failed to delete item. Check published content or permissions.';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 select-none text-slate-800">
      {/* ── Top Header & Actions ── */}
      <div className="p-3.5 border-b border-slate-200 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-black tracking-wider uppercase text-slate-900">
              Curriculum Navigator
            </span>
          </div>

          <button
            onClick={handleOpenAddModule}
            title="Create New Module"
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Module</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search lessons, units, modules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Status Quick Filter */}
        <div className="flex items-center gap-1 text-[10px] overflow-x-auto pb-0.5 text-slate-500">
          <span className="font-semibold text-slate-400 mr-0.5">Filter:</span>
          {['ALL', 'DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                statusFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dynamic 6-Level Hierarchy Tree View ── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 space-y-2">
            <p>No curriculum content found in database.</p>
            <button
              onClick={handleOpenAddModule}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Module</span>
            </button>
          </div>
        ) : (
          tree.map((domain) => {
            const isDomainExpanded = expandedDomains[domain.id] !== false;
            return (
              <div key={domain.id} className="space-y-1">
                {/* 1. Domain Level */}
                <div
                  onClick={() => toggleDomain(domain.id)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-xs font-black uppercase tracking-wider text-slate-600"
                >
                  {isDomainExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">{domain.name}</span>
                </div>

                {isDomainExpanded && (
                  <div className="pl-3 ml-2 border-l border-slate-200 space-y-1">
                    {(domain.worlds || []).map((world) => {
                      const isWorldExpanded = expandedWorlds[world.id] !== false;
                      return (
                        <div key={world.id} className="space-y-1">
                          {/* 2. World Level */}
                          <div
                            onClick={() => toggleWorld(world.id)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-700"
                          >
                            {isWorldExpanded ? (
                              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            <Compass className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            <span className="truncate text-[11px] uppercase tracking-wide">
                              {world.name}
                            </span>
                          </div>

                          {isWorldExpanded && (
                            <div className="pl-3 ml-2 border-l border-slate-200 space-y-1">
                              {(world.series || []).map((series) => {
                                const isSeriesExpanded = expandedSeries[series.id] !== false;
                                return (
                                  <div key={series.id} className="space-y-1">
                                    {/* 3. Series Level */}
                                    <div
                                      onClick={() => toggleSeries(series.id)}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-xs font-semibold text-slate-600"
                                    >
                                      {isSeriesExpanded ? (
                                        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                      )}
                                      <Layers className="w-3 h-3 text-emerald-500 shrink-0" />
                                      <span className="truncate text-[11px]">
                                        {series.name}
                                      </span>
                                    </div>

                                    {isSeriesExpanded && (
                                      <div className="pl-3 ml-2 border-l border-slate-200 space-y-1">
                                        {(series.modules || []).map((mod) => {
                                          const isModExpanded = expandedModules[mod.id] !== false;
                                          return (
                                            <div key={mod.id} className="space-y-0.5">
                                              {/* 4. Module Level */}
                                                 <div
                                                  onClick={() => toggleModule(mod.id)}
                                                  className="group flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-900"
                                                >
                                                  <div className="flex items-center gap-1.5 truncate">
                                                    {isModExpanded ? (
                                                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    ) : (
                                                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    )}
                                                    <Folder className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                    <span className="truncate">{mod.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-normal ml-0.5">
                                                      ({mod.units?.length || 0})
                                                    </span>
                                                  </div>

                                                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
                                                    <button
                                                      onClick={(e) => handleOpenEditModule(e, mod)}
                                                      title="Edit Module"
                                                      className="p-0.5 hover:bg-blue-100 hover:text-blue-700 rounded text-slate-400 transition-colors"
                                                    >
                                                      <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      onClick={(e) => promptDelete(e, 'Module', mod.id, mod.name, async (force) => {
                                                        await apiClient(`/api/v1/curriculum/modules/${mod.id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
                                                        if (onDeleteModule) await onDeleteModule(mod.id);
                                                      })}
                                                      title="Delete Module"
                                                      className="p-0.5 hover:bg-rose-100 hover:text-rose-600 rounded text-slate-400 transition-colors"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenAddUnit(mod.id);
                                                      }}
                                                      title="Add Unit to Module"
                                                      className="p-0.5 hover:bg-slate-200 rounded text-slate-400 transition-colors"
                                                    >
                                                      <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                </div>

                                              {/* 5. Unit Level */}
                                              {isModExpanded && (
                                                <div className="pl-3 ml-2 border-l border-slate-200 space-y-0.5">
                                                  {(mod.units || []).map((unit) => {
                                                    const isUnitExpanded = expandedUnits[unit.id] !== false;
                                                    const filteredLessons = (unit.lessons || []).filter((l) => {
                                                      const q = searchTerm.toLowerCase();
                                                      const matchesSearch =
                                                        q === '' ||
                                                        l.title.toLowerCase().includes(q) ||
                                                        l.slug.toLowerCase().includes(q) ||
                                                        unit.name.toLowerCase().includes(q) ||
                                                        mod.name.toLowerCase().includes(q);
                                                      const matchesStatus =
                                                        statusFilter === 'ALL' ||
                                                        (statusFilter === 'REVIEW'
                                                          ? l.status.includes('REVIEW')
                                                          : l.status === statusFilter);
                                                      return matchesSearch && matchesStatus;
                                                    });

                                                    return (
                                                      <div key={unit.id} className="space-y-0.5">
                                                         <div
                                                          onClick={() => toggleUnit(unit.id)}
                                                          className="group flex items-center justify-between px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-xs font-medium text-slate-700"
                                                        >
                                                          <div className="flex items-center gap-1.5 truncate">
                                                            {isUnitExpanded ? (
                                                              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                                            ) : (
                                                              <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                                            )}
                                                            <BookOpen className="w-3 h-3 text-amber-500 shrink-0" />
                                                            <span className="truncate text-[11px] font-semibold text-slate-700">
                                                              {unit.name}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-normal ml-0.5">
                                                              ({unit.lessons?.length || 0})
                                                            </span>
                                                          </div>

                                                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
                                                            <button
                                                              onClick={(e) => handleOpenEditUnit(e, unit)}
                                                              title="Edit Unit"
                                                              className="p-0.5 hover:bg-blue-100 hover:text-blue-700 rounded text-slate-400 transition-colors"
                                                            >
                                                              <Pencil className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                              onClick={(e) => promptDelete(e, 'Unit', unit.id, unit.name, async (force) => {
                                                                await apiClient(`/api/v1/curriculum/units/${unit.id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
                                                                if (onDeleteUnit) await onDeleteUnit(unit.id);
                                                              })}
                                                              title="Delete Unit"
                                                              className="p-0.5 hover:bg-rose-100 hover:text-rose-600 rounded text-slate-400 transition-colors"
                                                            >
                                                              <Trash2 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenAddLesson(unit.id);
                                                              }}
                                                              title="Add Lesson to Unit"
                                                              className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                                            >
                                                              <Plus className="w-3.5 h-3.5" />
                                                            </button>
                                                          </div>
                                                        </div>

                                                        {/* 6. Lesson Level */}
                                                        {isUnitExpanded && (
                                                          <div className="pl-3 ml-2 border-l border-slate-200 space-y-0.5">
                                                            {filteredLessons.length === 0 ? (
                                                              <div className="px-2 py-1 text-[10px] italic text-slate-400">
                                                                No lessons match filter
                                                              </div>
                                                            ) : (
                                                              filteredLessons.map((l) => {
                                                                const isSelected = l.id === selectedLessonId;
                                                                const isDirty = isSelected && hasUnsavedChanges;
                                                                return (
                                                                  <div
                                                                    key={l.id}
                                                                    onClick={() => handleLessonClick(l, unit, mod)}
                                                                    className={`group px-2 py-1.5 rounded cursor-pointer transition-all flex flex-col gap-0.5 border ${
                                                                      isSelected
                                                                        ? 'bg-blue-50/90 border-blue-400 text-blue-950 shadow-sm'
                                                                        : 'border-transparent hover:bg-slate-100 text-slate-700'
                                                                    }`}
                                                                  >
                                                                    <div className="flex items-center justify-between gap-1.5">
                                                                      <div className="flex items-center gap-1.5 truncate">
                                                                        {isDirty ? (
                                                                          <span
                                                                            className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse"
                                                                            title="Unsaved changes"
                                                                          />
                                                                        ) : (
                                                                          <span
                                                                            className={`w-1.5 h-1.5 rounded-full ${
                                                                              isSelected
                                                                                ? 'bg-blue-600'
                                                                                : 'bg-slate-300'
                                                                            } shrink-0`}
                                                                          />
                                                                        )}
                                                                        <span className="text-xs font-semibold truncate">
                                                                          {l.title}
                                                                        </span>
                                                                      </div>

                                                                      {/* Lesson delete button on hover */}
                                                                      <button
                                                                        onClick={(e) => promptDelete(e, 'Lesson', l.id, l.title, async (force) => {
                                                                          await apiClient(`/api/v1/admin/lessons/${l.id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
                                                                          if (onDeleteLesson) await onDeleteLesson(l.id);
                                                                        })}
                                                                        title="Delete Lesson"
                                                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-rose-100 hover:text-rose-600 rounded text-slate-400 transition-all shrink-0"
                                                                      >
                                                                        <Trash2 className="w-3 h-3" />
                                                                      </button>
                                                                    </div>

                                                                    <div className="flex items-center justify-between text-[10px] text-slate-400 pl-3">
                                                                      <span>v{l.version_number || 1}</span>
                                                                      {renderStatusBadge(l.status)}
                                                                    </div>
                                                                  </div>
                                                                );
                                                              })
                                                            )}
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Modal: Edit Module ── */}
      {showEditModuleModal && editModuleTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto text-slate-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" />
              <span>Edit Module — {editModuleTarget.name}</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600">Module Name *</label>
                  <input
                    type="text"
                    value={editModuleForm.name}
                    onChange={(e) => setEditModuleForm({ ...editModuleForm, name: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Difficulty Level</label>
                  <select
                    value={editModuleForm.level}
                    onChange={(e) => setEditModuleForm({ ...editModuleForm, level: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600">Description</label>
                <textarea
                  rows={2}
                  value={editModuleForm.description}
                  onChange={(e) => setEditModuleForm({ ...editModuleForm, description: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Learner Goal</label>
                <input
                  type="text"
                  value={editModuleForm.learner_goal}
                  onChange={(e) => setEditModuleForm({ ...editModuleForm, learner_goal: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Why This Matters</label>
                <input
                  type="text"
                  value={editModuleForm.why_this_matters}
                  onChange={(e) => setEditModuleForm({ ...editModuleForm, why_this_matters: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Learning Outcomes (one per line)</label>
                <textarea
                  rows={2}
                  value={editModuleForm.learning_outcomes}
                  onChange={(e) => setEditModuleForm({ ...editModuleForm, learning_outcomes: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Estimated Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={editModuleForm.estimated_hours}
                  onChange={(e) => setEditModuleForm({ ...editModuleForm, estimated_hours: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowEditModuleModal(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEditModule}
                disabled={!editModuleForm.name.trim() || isSavingEdit}
                className="px-4 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-sm flex items-center gap-1.5"
              >
                {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Unit ── */}
      {showEditUnitModal && editUnitTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4 text-slate-800">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" />
              <span>Edit Unit — {editUnitTarget.name}</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600">Unit Name *</label>
                <input
                  type="text"
                  value={editUnitForm.name}
                  onChange={(e) => setEditUnitForm({ ...editUnitForm, name: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600">Description</label>
                <textarea
                  rows={2}
                  value={editUnitForm.description}
                  onChange={(e) => setEditUnitForm({ ...editUnitForm, description: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowEditUnitModal(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEditUnit}
                disabled={!editUnitForm.name.trim() || isSavingEdit}
                className="px-3.5 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-sm flex items-center gap-1.5"
              >
                {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create Module (Full Canonical DB Fields) ── */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto text-slate-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Folder className="w-4 h-4 text-blue-600" />
              <span>Create New Curriculum Module</span>
            </h3>

            <div className="space-y-3 text-xs">
              {availableSeries.length > 0 && (
                <div>
                  <label className="font-semibold text-slate-600">Parent Hierarchy Series</label>
                  <select
                    value={moduleForm.series_id}
                    onChange={(e) => setModuleForm({ ...moduleForm, series_id: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  >
                    {availableSeries.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600">Module Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Financial Statements"
                    value={moduleForm.name}
                    onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Slug (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. financial-statements"
                    value={moduleForm.slug}
                    onChange={(e) => setModuleForm({ ...moduleForm, slug: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600">Description</label>
                <textarea
                  rows={2}
                  placeholder="Comprehensive breakdown of financial statements..."
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Learner Goal</label>
                <input
                  type="text"
                  placeholder="e.g. Master three-statement modeling and income statement analysis."
                  value={moduleForm.learner_goal}
                  onChange={(e) => setModuleForm({ ...moduleForm, learner_goal: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Why This Matters</label>
                <input
                  type="text"
                  placeholder="e.g. Financial statements form the foundation of equity research and corporate finance."
                  value={moduleForm.why_this_matters}
                  onChange={(e) => setModuleForm({ ...moduleForm, why_this_matters: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Learning Outcomes (One per line)</label>
                <textarea
                  rows={2}
                  placeholder="Identify revenue vs cost of goods sold&#10;Compute operating margins&#10;Evaluate cash flow reconciliation"
                  value={moduleForm.learning_outcomes}
                  onChange={(e) => setModuleForm({ ...moduleForm, learning_outcomes: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600">Estimated Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={moduleForm.estimated_hours}
                    onChange={(e) => setModuleForm({ ...moduleForm, estimated_hours: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Difficulty Level</label>
                  <select
                    value={moduleForm.level}
                    onChange={(e) => setModuleForm({ ...moduleForm, level: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddModuleModal(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreateModule}
                disabled={!moduleForm.name.trim()}
                className="px-4 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-sm"
              >
                Create Module
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create Unit (Under Module - Strictly Non-Orphan) ── */}
      {showAddUnitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4 text-slate-800">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-500" />
              <span>Create New Unit</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600">Target Module</label>
                <select
                  value={unitForm.module_id}
                  onChange={(e) => setUnitForm({ ...unitForm, module_id: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                >
                  {availableModules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-600">Unit Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Income Statement"
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional unit description..."
                  value={unitForm.description}
                  onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddUnitModal(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreateUnit}
                disabled={!unitForm.name.trim() || !unitForm.module_id}
                className="px-3.5 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-sm"
              >
                Create Unit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create Lesson (Under Unit - Strictly Non-Orphan) ── */}
      {showAddLessonModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4 text-slate-800">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Create New Lesson</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600">Target Unit</label>
                <select
                  value={lessonForm.unit_id}
                  onChange={(e) => setLessonForm({ ...lessonForm, unit_id: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                >
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-600">Lesson Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Revenue & Top-Line Recognition"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600">Duration (Min)</label>
                  <input
                    type="number"
                    min="1"
                    value={lessonForm.duration_minutes}
                    onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Level</label>
                  <select
                    value={lessonForm.level}
                    onChange={(e) => setLessonForm({ ...lessonForm, level: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600">Learning Objectives (One per line)</label>
                <textarea
                  rows={2}
                  placeholder="Understand gross vs net revenue&#10;Identify ASC 606 revenue recognition steps"
                  value={lessonForm.learning_objectives}
                  onChange={(e) => setLessonForm({ ...lessonForm, learning_objectives: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddLessonModal(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreateLesson}
                disabled={!lessonForm.title.trim() || !lessonForm.unit_id}
                className="px-3.5 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-sm"
              >
                Create Lesson Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shared Delete Confirmation Dialog ── */}
      {deleteDialog && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4 text-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete {deleteDialog.type}?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg space-y-1.5">
              <p className="text-xs text-rose-800 font-medium">
                Are you sure you want to delete <span className="font-black">"{deleteDialog.name}"</span>?
                {deleteDialog.type === 'Module' && ' This will permanently delete the entire module, all its child units, and all lessons inside it at once.'}
                {deleteDialog.type === 'Unit' && ' This will permanently delete the unit and all lessons inside it at once.'}
                {deleteDialog.type === 'Lesson' && ' This will permanently delete this lesson and all its draft versions.'}
              </p>
              <p className="text-[11px] text-rose-600 font-semibold">
                This item and its contents will be permanently removed from both Content Studio and Learner Discovery.
              </p>
            </div>

            {/* Error message banner */}
            {deleteError && (
              <div className="p-2.5 bg-rose-100/80 border border-rose-300 rounded-lg text-xs text-rose-800 font-medium space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Deletion Failed</span>
                </div>
                <p className="text-[11px] leading-relaxed">{deleteError}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={() => {
                  setDeleteDialog(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white shadow-sm flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {isDeleting ? 'Deleting...' : `Delete ${deleteDialog.type}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
