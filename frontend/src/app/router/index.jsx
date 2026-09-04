import React from 'react';
import { createBrowserRouter, Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { LearnPage } from '../../features/learning/LearnPage';
import { ModulePage } from '../../features/learning/modules/ModulePage';
import { ModuleUnitsPage } from '../../features/learning/modules/ModuleUnitsPage';
import { LessonOverviewPage } from '../../features/learning/lessons/LessonOverviewPage';
import { SessionPlayerPage } from '../../features/learning/SessionPlayerPage';
import { YouPage } from '../../features/you/YouPage';
import { DiagnosticPage } from '../../features/diagnostic/DiagnosticPage';
import { ReviewPage } from '../../features/review/ReviewPage';
import { SchoolPage } from '../../features/school/SchoolPage';
import { SchoolSlugPage } from '../../features/school/SchoolSlugPage';
import { AdminStudioPage } from '../../features/admin/AdminStudioPage';
import { BookOpen, User } from 'lucide-react';
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
        <Outlet />
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
