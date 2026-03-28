import { Routes, Route } from 'react-router'
import { Toaster } from 'sonner'
import { AppLayout } from './app/components/layout/AppLayout'
import { PromptsPage } from './app/pages/PromptsPage'
import { VersionsPage } from './app/pages/VersionsPage'
import { RunsPage } from './app/pages/RunsPage'
import { DatasetsPage } from './app/pages/DatasetsPage'
import { EvalJobsPage } from './app/pages/EvalJobsPage'
import { EvalAnalyticsPage } from './app/pages/EvalAnalyticsPage'
import { ABTestsPage } from './app/pages/ABTestsPage'
import { ModelComparisonsPage } from './app/pages/ModelComparisonsPage'
import { ParetoPage } from './app/pages/ParetoPage'
import { MonitorPage } from './app/pages/MonitorPage'
import { SettingsPage } from './app/pages/SettingsPage'
import { LoginPage } from './app/pages/LoginPage'
import { DashboardPage } from './app/pages/DashboardPage'
import { AuthProvider } from './app/context/AuthContext'

export default function App() {
    return (
    <AuthProvider>
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="prompts" element={<PromptsPage />} />
                <Route path="versions" element={<VersionsPage />} />
                <Route path="runs" element={<RunsPage />} />
                <Route path="datasets" element={<DatasetsPage />} />
                <Route path="eval-jobs" element={<EvalJobsPage />} />
                <Route path="eval-analytics/:jobId" element={<EvalAnalyticsPage />} />
                <Route path="ab-tests" element={<ABTestsPage />} />
                <Route path="model-comparisons" element={<ModelComparisonsPage />} />
                <Route path="pareto" element={<ParetoPage />} />
                <Route path="monitor" element={<MonitorPage />} />
                <Route path="settings" element={<SettingsPage />} />
            </Route>
        </Routes>
        <Toaster theme="dark" position="bottom-right" />
    </AuthProvider>
    )
}
