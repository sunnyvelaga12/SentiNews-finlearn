import React, { Suspense } from 'react';
import { createBrowserRouter, Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { BookOpen, User } from 'lucide-react';

const LearnPage = React.lazy(() => import('../../features/learning/LearnPage').then(m => ({ default: m.LearnPage })));
const ModulePage = React.lazy(() => import('../../features/learning/modules/ModulePage').then(m => ({ default: m.ModulePage })));
const ModuleUnitsPage = React.lazy(() => import('../../features/learning/modules/ModuleUnitsPage').then(m => ({ default: m.ModuleUnitsPage })));
const LessonOverviewPage = React.lazy(() => import('../../features/learning/lessons/LessonOverviewPage').then(m => ({ default: m.LessonOverviewPage })));
const SessionPlayerPage = React.lazy(() => import('../../features/learning/SessionPlayerPage').then(m => ({ default: m.SessionPlayerPage })));
const YouPage = React.lazy(() => import('../../features/you/YouPage').then(m => ({ default: m.YouPage })));
const DiagnosticPage = React.lazy(() => import('../../features/diagnostic/DiagnosticPage').then(m => ({ default: m.DiagnosticPage })));
const ReviewPage = React.lazy(() => import('../../features/review/ReviewPage').then(m => ({ default: m.ReviewPage })));
const SchoolPage = React.lazy(() => import('../../features/school/SchoolPage').then(m => ({ default: m.SchoolPage })));
const SchoolSlugPage = React.lazy(() => import('../../features/school/SchoolSlugPage').then(m => ({ default: m.SchoolSlugPage })));
const AdminStudioPage = React.lazy(() => import('../../features/admin/AdminStudioPage').then(m => ({ default: m.AdminStudioPage })));

const RouteLoadingFallback = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-8">
    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
    <span className="text-xs font-semibold text-slate-500 tracking-wide">Loading workspace...</span>
  </div>
);
const AppLayout = () => {
    const location = useLocation();
    const navItems = [
        { label: 'Learn', path: '/learn', icon: BookOpen },
        { label: 'You', path: '/app/you', icon: User },
    ];
    return (<div className="min-h-screen flex flex-col bg-[#FBFBFA] font-sans text-[#17202A] selection:bg-slate-200">
      {/* Top Learner Navbar */}
      <header className="bg-[#FBFBFA]/90 backdrop-blur-md border-b border-[#E5E7EB] sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/learn" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#17202A] text-white flex items-center justify-center font-bold text-base shadow-sm">
              S
            </div>
            <span className="font-extrabold text-lg tracking-tight text-[#17202A]">
              SentiNews <span className="text-slate-500 font-semibold">Learn</span>
            </span>
          </Link>

          {/* Desktop Learner Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-2 font-medium text-sm">
            {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
                (item.path === '/learn' && (location.pathname === '/' || location.pathname.startsWith('/learn'))) ||
                (item.path === '/app/you' && location.pathname.startsWith('/app/you'));
            return (<Link key={item.path} to={item.path} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
                  <Icon className="w-3.5 h-3.5"/>
                  <span>{item.label}</span>
                </Link>);
        })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-24 md:pb-12">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile Bottom Learner Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FBFBFA]/95 backdrop-blur-md border-t border-[#E5E7EB] py-2 px-6 flex justify-around items-center z-50 shadow-sm">
        {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
                (item.path === '/learn' && (location.pathname === '/' || location.pathname.startsWith('/learn'))) ||
                (item.path === '/app/you' && location.pathname.startsWith('/app/you'));
            return (<Link key={item.path} to={item.path} className={`flex flex-col items-center gap-1 min-w-[70px] text-xs transition-all ${isActive ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium hover:text-slate-800'}`}>
              <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`}/>
              <span>{item.label}</span>
            </Link>);
        })}
      </nav>
    </div>);
};
export const router = createBrowserRouter([
    {
        path: '/',
        element: <AppLayout />,
        children: [
            { path: '/', element: <LearnPage /> },
            { path: '/learn', element: <LearnPage /> },
            { path: '/learn/modules/:moduleSlug', element: <ModulePage /> },
            { path: '/learn/modules/:moduleSlug/units', element: <ModuleUnitsPage /> },
            { path: '/learn/lessons/:lessonSlug', element: <LessonOverviewPage /> },
            { path: '/learn/session/:sessionId', element: <SessionPlayerPage /> },
            { path: '/learn/sessions/:sessionId', element: <SessionPlayerPage /> },
            { path: '/app/home', element: <Navigate to="/learn" replace/> },
            { path: '/app/explore', element: <Navigate to="/learn" replace/> },
            { path: '/app/universe', element: <Navigate to="/app/you" state={{ tab: 'KNOWLEDGE_MAP' }} replace/> },
            { path: '/app/you', element: <YouPage /> },
            { path: '/you', element: <Navigate to="/app/you" replace/> },
            { path: '/app/session/:sessionId', element: <SessionPlayerPage /> },
            { path: '/app/lesson/:lessonId', element: <LessonOverviewPage /> },
            { path: '/app/review', element: <ReviewPage /> },
            { path: '/school', element: <SchoolPage /> },
            { path: '/school/:slug', element: <SchoolSlugPage /> },
            { path: '/admin', element: <AdminStudioPage /> },
            { path: '/admin/studio', element: <AdminStudioPage /> },
            { path: '/app/diagnostic', element: <DiagnosticPage /> },
        ],
    },
]);
