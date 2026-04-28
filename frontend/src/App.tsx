import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import AppShell from './components/AppShell'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const ProjectTasks = lazy(() => import('./pages/project/ProjectTasks'))
const ProjectCalendar = lazy(() => import('./pages/project/ProjectCalendar'))
const ProjectBudget = lazy(() => import('./pages/project/ProjectBudget'))
const ProjectSite = lazy(() => import('./pages/project/ProjectSite'))
const ProjectDocuments = lazy(() => import('./pages/project/ProjectDocuments'))
const ProjectTeam = lazy(() => import('./pages/project/ProjectTeam'))
const ProjectReports = lazy(() => import('./pages/project/ProjectReports'))
const ProjectSettings = lazy(() => import('./pages/project/ProjectSettings'))
const ProjectGantt = lazy(() => import('./pages/project/ProjectGantt').then((m) => ({ default: m.ProjectGantt })))
const ProjectObjectives = lazy(() => import('./pages/project/ProjectObjectives'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Budget = lazy(() => import('./pages/Budget'))
const Documents = lazy(() => import('./pages/Documents'))
const Team = lazy(() => import('./pages/Team'))
const Reports = lazy(() => import('./pages/Reports'))
const Features = lazy(() => import('./pages/Features'))
const Profile = lazy(() => import('./pages/Profile'))
const Activity = lazy(() => import('./pages/Activity'))
const InvitePage = lazy(() => import('./pages/Invite'))

function PageFallback() {
  return (
    <div className="bf-surface p-8">
      Chargement...
    </div>
  )
}

function NotFound() {
  return (
    <div className="bf-surface flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <p className="text-6xl font-bold text-slate-200">404</p>
      <p className="text-lg font-semibold text-slate-600">Page introuvable</p>
      <Link to="/" className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
        Retour à l'accueil
      </Link>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            {/* Routes espace de travail d'un projet */}
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="projects/:id/tasks" element={<ProjectTasks />} />
            <Route path="projects/:id/calendar" element={<ProjectCalendar />} />
            <Route path="projects/:id/budget" element={<ProjectBudget />} />
            <Route path="projects/:id/site" element={<ProjectSite />} />
            <Route path="projects/:id/documents" element={<ProjectDocuments />} />
            <Route path="projects/:id/team" element={<ProjectTeam />} />
            <Route path="projects/:id/reports" element={<ProjectReports />} />
            <Route path="projects/:id/gantt" element={<ProjectGantt />} />
            <Route path="projects/:id/settings" element={<ProjectSettings />} />
            <Route path="projects/:id/objectives" element={<ProjectObjectives />} />
            {/* Routes globales */}
            <Route path="tasks" element={<Tasks />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="budget" element={<Budget />} />
            <Route path="documents" element={<Documents />} />
            <Route path="team" element={<Team />} />
            <Route path="reports" element={<Reports />} />
            <Route path="features" element={<Features />} />
            <Route path="profile" element={<Profile />} />
            <Route path="activity" element={<Activity />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App