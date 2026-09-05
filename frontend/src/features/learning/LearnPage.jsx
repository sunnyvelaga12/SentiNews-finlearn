import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, AlertCircle, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

// Deterministic accent palette for module index styling (Varsity-style colored top rules)
const ACCENT_PALETTES = [
    { bar: 'bg-blue-600', text: 'text-blue-700' },
    { bar: 'bg-emerald-600', text: 'text-emerald-700' },
    { bar: 'bg-amber-600', text: 'text-amber-700' },
    { bar: 'bg-indigo-600', text: 'text-indigo-700' },
    { bar: 'bg-purple-600', text: 'text-purple-700' },
    { bar: 'bg-teal-600', text: 'text-teal-700' },
];

const PAGE_CHUNK_SIZE = 6;

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12)
        return 'Good morning, Learner';
    if (hour < 18)
        return 'Good afternoon, Learner';
    return 'Good evening, Learner';
};

export const LearnPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentDomain = searchParams.get('domain') || 'all';

    const [modules, setModules] = useState([]);
    const [domains, setDomains] = useState([{ slug: 'all', name: 'All' }]);
    const [totalItems, setTotalItems] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [screenAnnouncement, setScreenAnnouncement] = useState('');

    // Fetch initial page chunk when domain changes
    const loadInitialModules = useCallback(() => {
        setIsLoading(true);
        setHasError(false);
        const domainParam = currentDomain !== 'all' ? `&domain=${encodeURIComponent(currentDomain)}` : '';
        apiClient(`/api/v1/curriculum/modules?limit=${PAGE_CHUNK_SIZE}&offset=0${domainParam}`)
            .then((data) => {
                if (data && Array.isArray(data.modules)) {
                    setModules(data.modules);
                    setTotalItems(data.total_items || data.modules.length);
                    setHasMore(Boolean(data.has_more));
                    if (Array.isArray(data.domains) && data.domains.length > 0) {
                        setDomains(data.domains);
                    }
                    setScreenAnnouncement(`Loaded ${data.modules.length} modules for ${currentDomain} domain.`);
                } else {
                    setModules([]);
                    setTotalItems(0);
                    setHasMore(false);
                }
            })
            .catch((err) => {
                console.error('Failed to load curriculum modules:', err);
                setHasError(true);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [currentDomain]);

    useEffect(() => {
        loadInitialModules();
    }, [loadInitialModules]);

    // Handle "Load More" pagination
    const handleLoadMore = async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        const nextOffset = modules.length;
        const domainParam = currentDomain !== 'all' ? `&domain=${encodeURIComponent(currentDomain)}` : '';
        try {
            const data = await apiClient(`/api/v1/curriculum/modules?limit=${PAGE_CHUNK_SIZE}&offset=${nextOffset}${domainParam}`);
            if (data && Array.isArray(data.modules)) {
                setModules((prev) => [...prev, ...data.modules]);
                setHasMore(Boolean(data.has_more));
                setScreenAnnouncement(`Loaded ${data.modules.length} additional modules. Showing ${modules.length + data.modules.length} of ${data.total_items || totalItems}.`);
            }
        } catch (err) {
            console.error('Failed to load more modules:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Handle domain filter selection
    const handleSelectDomain = (domainSlug) => {
        if (domainSlug === currentDomain) return;
        if (domainSlug === 'all') {
            searchParams.delete('domain');
            setSearchParams(searchParams);
        } else {
            setSearchParams({ domain: domainSlug });
        }
    };

    // Dynamically resolve active module from progression data
    const activeModule = modules.find((m) => (m.progress?.completed_lessons || 0) < (m.progress?.total_lessons || 1)) || modules[0] || null;
    const isStarted = (activeModule?.progress?.completed_lessons || 0) > 0;

    return (
        <div className="min-h-screen bg-[#fbfbfb] text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-10">
                {/* Accessible screen-reader live updates */}
                <div aria-live="polite" className="sr-only">
                    {screenAnnouncement}
                </div>

                {/* 1. Minimalist Editorial Header */}
                <header className="space-y-2 border-b border-slate-200/80 pb-6">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        SentiNews Learn
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                        {getGreeting()}
                    </h1>
                    <p className="text-sm sm:text-base text-slate-600">
                        Continue your financial learning and verified capability building.
                    </p>
                </header>

                {/* Loading State */}
                {isLoading && (
                    <div className="space-y-6 animate-pulse" aria-label="Loading curriculum">
                        <div className="h-44 bg-slate-100 border border-slate-200 rounded-xl" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="h-40 bg-slate-100 border border-slate-200 rounded-xl" />
                            <div className="h-40 bg-slate-100 border border-slate-200 rounded-xl" />
                        </div>
                    </div>
                )}

                {/* Error State */}
                {hasError && !isLoading && (
                    <div className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-4 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-slate-900">Unable to load modules</h3>
                            <p className="text-xs sm:text-sm text-slate-600">
                                We could not connect to the learning service. Please check your connection and try again.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={loadInitialModules}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Try Again</span>
                        </button>
                    </div>
                )}

                {/* Content State */}
                {!isLoading && !hasError && (
                    <>
                        {/* 2. Dominant Continue Learning Hero */}
                        {activeModule && (
                            <section aria-labelledby="continue-learning-heading" className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <h2 id="continue-learning-heading" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                        CONTINUE LEARNING
                                    </h2>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm hover:border-slate-300 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                                        <div className="space-y-3 max-w-xl">
                                            <div className="text-xs font-medium text-slate-500">
                                                {activeModule.domain_name || activeModule.title}
                                            </div>
                                            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                                                {activeModule.title}
                                            </h3>
                                            <p className="text-xs font-semibold text-blue-700">
                                                {isStarted
                                                    ? `Lesson ${(activeModule.progress?.completed_lessons || 0) + 1} · In Progress`
                                                    : 'Lesson 1 · Ready to Begin'}
                                            </p>
                                            <p className="text-sm text-slate-600 leading-relaxed">
                                                {activeModule.description || 'Master key principles through interactive discovery and verified evidence.'}
                                            </p>
                                            <div className="pt-2 text-xs text-slate-500 font-medium">
                                                {activeModule.progress?.completed_lessons || 0} of {activeModule.progress?.total_lessons || 1} lessons completed ({activeModule.progress?.completion_pct || 0}%)
                                            </div>
                                        </div>

                                        <div className="shrink-0 sm:self-center">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/learn/modules/${activeModule.slug}`)}
                                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99] focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 focus:outline-none transition-all cursor-pointer shadow-sm"
                                                aria-label="Continue Learning"
                                            >
                                                <span>Continue Learning</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* 3. Browse Curriculum Modules with Domain Filter Tabs & Bounded Grid */}
                        <section aria-labelledby="curriculum-modules-heading" className="space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                                <div>
                                    <h2 id="curriculum-modules-heading" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                        CURRICULUM MODULES
                                    </h2>
                                    <span className="text-xs text-slate-500 font-medium">
                                        Showing {modules.length} of {totalItems} {totalItems === 1 ? 'Module' : 'Modules'}
                                    </span>
                                </div>

                                {/* Semantic Domain Category Filter Tabs */}
                                {domains.length > 1 && (
                                    <nav aria-label="Curriculum Domain Filter" className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                                        {domains.map((dom) => {
                                            const isActive = currentDomain.toLowerCase() === dom.slug.toLowerCase();
                                            return (
                                                <button
                                                    key={dom.slug}
                                                    type="button"
                                                    onClick={() => handleSelectDomain(dom.slug)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                                        isActive
                                                            ? 'bg-slate-900 text-white shadow-sm'
                                                            : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {dom.name}
                                                </button>
                                            );
                                        })}
                                    </nav>
                                )}
                            </div>

                            {/* Empty State for Selected Domain */}
                            {modules.length === 0 ? (
                                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3 shadow-sm">
                                    <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                                    <h3 className="text-base font-bold text-slate-900">No modules in this category yet</h3>
                                    <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                                        Modules for this domain are currently being authored and verified.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => handleSelectDomain('all')}
                                        className="px-4 py-2 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
                                    >
                                        View All Modules
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Responsive 2-Column Card Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {modules.map((mod, idx) => {
                                            const palette = ACCENT_PALETTES[idx % ACCENT_PALETTES.length];
                                            const moduleNum = String(idx + 1).padStart(2, '0');
                                            return (
                                                <article
                                                    key={mod.id || mod.slug}
                                                    data-testid={`module-card-${mod.slug}`}
                                                    onClick={() => navigate(`/learn/modules/${mod.slug}`)}
                                                    className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between transition-all hover:border-slate-300 hover:shadow-sm cursor-pointer"
                                                >
                                                    <div className="space-y-4">
                                                        {/* Top accent line + Module number */}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-mono text-sm font-semibold text-slate-400">
                                                                    {moduleNum}
                                                                </span>
                                                                <span className={`w-10 h-0.5 rounded-full ${palette.bar}`} />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {mod.domain_name && (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                                                        {mod.domain_name}
                                                                    </span>
                                                                )}
                                                                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                                                                    {mod.level || 'BEGINNER'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Title & metadata */}
                                                        <div className="space-y-1.5">
                                                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                                                {mod.title}
                                                            </h3>
                                                            <div className="text-xs text-slate-500 font-medium">
                                                                {mod.total_units} {mod.total_units === 1 ? 'unit' : 'units'} · {mod.total_lessons} {mod.total_lessons === 1 ? 'lesson' : 'lessons'}
                                                            </div>
                                                        </div>

                                                        {/* Description */}
                                                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                                                            {mod.description || 'Master fundamental market mechanics and verifiable principles through structured interactive lessons.'}
                                                        </p>
                                                    </div>

                                                    {/* Action & Progress */}
                                                    <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between">
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 rounded transition-colors">
                                                            <span>View module</span>
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </span>
                                                        {mod.progress?.completed_lessons > 0 && (
                                                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                                                {mod.progress.completion_pct}% complete
                                                            </span>
                                                        )}
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>

                                    {/* Bounded Load More Pagination Trigger */}
                                    {hasMore && (
                                        <div className="pt-4 text-center">
                                            <button
                                                type="button"
                                                onClick={handleLoadMore}
                                                disabled={isLoadingMore}
                                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                            >
                                                {isLoadingMore ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                                                        <span>Loading more modules...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>Load More Modules (Showing {modules.length} of {totalItems})</span>
                                                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
};
