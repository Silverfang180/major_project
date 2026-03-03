import { Routes, Route } from 'react-router'
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

export default function App() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route index element={<PromptsPage />} />
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
    )
}
