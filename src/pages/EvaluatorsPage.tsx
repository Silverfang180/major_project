import React, { useEffect, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { api } from '../lib/api';

export const EvaluatorsPage: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        setIsLoading(true);
        try {
            const data = await api.getDashboard();
            setStats(data);
        } catch (e) {
            console.error('Failed to load eval dashboard', e);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-chr-surface">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-on-surface-variant">Loading Analytics...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex flex-col h-full bg-chr-surface overflow-y-auto">
                {/* Header */}
                <div className="px-8 py-6 border-b border-outline-variant/20 bg-surface-container-lowest shrink-0">
                    <h1 className="text-2xl font-bold tracking-tight text-on-surface">Analytics & Evaluators</h1>
                    <p className="text-sm text-on-surface-variant mt-1">Comprehensive metrics and performance evaluation</p>
                </div>
                <div className="flex-1 flex items-center justify-center p-12 text-center">
                    <div className="max-w-md space-y-4">
                        <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6">
                            <Icon name="analytics" size={32} className="text-outline-variant" />
                        </div>
                        <h2 className="text-xl font-bold text-on-surface">No Evaluation Data Yet</h2>
                        <p className="text-on-surface-variant leading-relaxed">
                            Run prompts in the execution sandbox or trigger evaluations via the API to populate this dashboard.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-chr-surface overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Header */}
                <div className="px-8 py-6 border-b border-outline-variant/20 bg-surface-container-lowest shrink-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Analytics & Evaluators</h1>
                            <p className="text-sm text-on-surface-variant mt-1">Comprehensive metrics and performance evaluation</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <select className="bg-surface-container rounded-lg px-4 py-2 text-sm font-semibold border-none focus:ring-2 focus:ring-primary/20 outline-none">
                                <option>Last 7 Days</option>
                                <option>Last 30 Days</option>
                                <option>All Time</option>
                            </select>
                            <button className="chr-btn-outline flex items-center gap-2">
                                <Icon name="download" size={18} /> Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-4 gap-6">
                        <MetricCard title="Total Jobs" value={stats.total_jobs} prevValue={stats.total_jobs - 5} suffix="" icon="work" color="text-primary" />
                        <MetricCard title="Total Datasets" value={stats.total_datasets} prevValue={stats.total_datasets} suffix="" icon="database" color="text-tertiary" />
                        <MetricCard title="Completed Jobs" value={stats.completed_jobs} prevValue={stats.completed_jobs - 2} suffix="" icon="check_circle" color="text-tertiary-fixed-dim" />
                        <MetricCard title="Failed Jobs" value={stats.failed_jobs} prevValue={0} suffix="" icon="error" color="text-error" />
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Latency Trends */}
                        <div className="chr-card p-6 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-on-surface">Latency Trends (ms)</h3>
                                <Icon name="more_horiz" size={20} className="text-outline-variant" />
                            </div>
                            <div className="h-48 flex items-end gap-2">
                                {/* Mock bars for effect if no real timeline data in basic stats */}
                                {[40, 60, 45, 80, 50, 45, 70, 90, 60, 55, 65, 50, 45, 40].map((h, i) => (
                                    <div key={i} className="flex-1 bg-primary/10 hover:bg-primary/30 transition-colors rounded-t-sm relative group">
                                        <div className="absolute inset-x-0 bottom-0 bg-primary rounded-t-sm" style={{ height: `${h}%` }}></div>
                                        {/* Tooltip */}
                                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-on-surface text-chr-surface text-[10px] px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-10 pointer-events-none">
                                            {h * 12}ms
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-on-surface-variant uppercase">
                                <span>Jan 1</span>
                                <span>Jan 14</span>
                            </div>
                        </div>

                        {/* Top Summaries */}
                        <div className="chr-card p-6 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-on-surface">Top Pareto Summaries</h3>
                                <Icon name="more_horiz" size={20} className="text-outline-variant" />
                            </div>
                            <div className="space-y-4">
                                {(stats.top_summaries || []).length > 0 ? (
                                    stats.top_summaries.slice(0, 4).map((s: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-tertiary/10 flex items-center justify-center text-tertiary font-bold text-[10px]">
                                                    v{s.version_id}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-on-surface max-w-[150px] truncate" title={s.model}>{s.model}</p>
                                                    <p className="text-[10px] text-on-surface-variant flex gap-2">
                                                        <span>Cost: ${(s.total_cost_usd || 0).toFixed(4)}</span>
                                                        <span>Acc: {(s.accuracy ? s.accuracy * 100 : 0).toFixed(1)}%</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-24 h-2 bg-surface-container rounded-full overflow-hidden">
                                                <div className="h-full bg-tertiary" style={{ width: `${(s.accuracy || 0) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-on-surface-variant text-center py-8">No pareto summaries available</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Run History Table */}
                    <div className="chr-card overflow-hidden">
                        <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-on-surface">Recent Evaluation Jobs</h3>
                            <button className="text-xs font-semibold text-primary hover:underline">View All</button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface-container-low text-xs text-on-surface-variant">
                                <tr>
                                    <th className="px-6 py-3 font-semibold uppercase tracking-wider">Job ID</th>
                                    <th className="px-6 py-3 font-semibold uppercase tracking-wider">Dataset / Version</th>
                                    <th className="px-6 py-3 font-semibold uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 font-semibold uppercase tracking-wider">Evaluators</th>
                                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/20">
                                {(stats.recent_jobs || []).length > 0 ? (
                                    stats.recent_jobs.slice(0, 5).map((job: any) => (
                                        <tr key={job.job_id} className="hover:bg-surface-container-lowest/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-[10px] text-primary">{job.job_id.substring(0, 8)}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-on-surface text-xs">{job.dataset_id?.substring(0, 8) || 'Unknown'}</div>
                                                <div className="text-[10px] text-on-surface-variant">Vers: {job.version_id}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${job.status === 'completed' ? 'bg-tertiary-container/30 text-tertiary' :
                                                        job.status === 'failed' ? 'bg-error-container/30 text-error' :
                                                            'bg-blue-500/10 text-blue-600'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'completed' ? 'bg-tertiary' :
                                                            job.status === 'failed' ? 'bg-error' :
                                                                'bg-blue-500'
                                                        }`}></span>
                                                    {job.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-1 flex-wrap">
                                                    {(job.evaluators || []).map((ev: string) => (
                                                        <span key={ev} className="bg-surface-container px-1.5 py-0.5 rounded text-[10px] text-on-surface-variant border border-outline-variant/20">
                                                            {ev}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs text-on-surface-variant font-mono">
                                                {new Date(job.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant">
                                            No recent jobs found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right Rail Timeline (Optional context pane) */}
            <div className="w-80 border-l border-outline-variant/20 bg-surface-container-low p-6 overflow-y-auto hidden xl:block">
                <h3 className="text-sm font-bold text-on-surface mb-6">Promotion Timeline</h3>
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-outline-variant/20 before:to-transparent">
                    {/* Placeholder Activity */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-tertiary shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded bg-surface-container-lowest border border-outline-variant/20 shadow-sm">
                            <div className="flex items-center justify-between space-x-2 mb-1">
                                <div className="font-bold text-on-surface text-xs">v34.0 Promoted</div>
                                <time className="font-mono text-[10px] text-outline-variant">Today</time>
                            </div>
                            <div className="text-[10px] text-on-surface-variant">Pass rate met 98% threshold on standard evaluation suite.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Internal Metric Card
const MetricCard = ({ title, value, prevValue, suffix, icon, color }: any) => {
    const diff = value - prevValue;
    const isPositive = diff >= 0;

    return (
        <div className="chr-card p-5 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-1 z-10">
                    <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{title}</h3>
                    <div className="text-3xl font-black text-on-surface tracking-tight">
                        {value}{suffix}
                    </div>
                </div>
                <div className={`p-2 bg-surface-container rounded-lg ${color} z-10`}>
                    <Icon name={icon} size={24} />
                </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold z-10 relative">
                <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${isPositive ? 'bg-tertiary/10 text-tertiary' : 'bg-error/10 text-error'}`}>
                    <Icon name={isPositive ? 'trending_up' : 'trending_down'} size={12} />
                    {isPositive ? '+' : ''}{diff}
                </div>
                <span className="text-on-surface-variant">vs last month</span>
            </div>
            {/* Hover Glow */}
            <div className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-10 transition-opacity ${color.replace('text-', 'bg-')}`}></div>
        </div>
    );
};
