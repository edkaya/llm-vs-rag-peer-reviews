import type { ReviewMetrics } from '../api';

interface MetricsCardProps {
    title: string;
    metrics: ReviewMetrics;
    variant?: 'rag' | 'norag';
}

export function MetricsCard({ title, metrics, variant = 'rag' }: MetricsCardProps) {
    const borderColor = variant === 'rag' ? '#10b981' : '#f59e0b';

    return (
        <div
            style={{
                border: `2px solid ${borderColor}`,
                borderRadius: 8,
                padding: 16,
                backgroundColor: '#1e1e1e',
                minWidth: 280
            }}
        >
            <h3 style={{ margin: '0 0 12px 0', color: borderColor }}>{title}</h3>

            <div style={{ display: 'grid', gap: 8 }}>
                <MetricRow
                    label="Hallucination Rate"
                    value={`${(metrics.hallucinationRate * 100).toFixed(1)}%`}
                    color={metrics.hallucinationRate > 0.2 ? '#ef4444' : '#10b981'}
                />
                <MetricRow
                    label="Grounding Score"
                    value={`${(metrics.groundingScore * 100).toFixed(1)}%`}
                    color={metrics.groundingScore > 0.7 ? '#10b981' : '#f59e0b'}
                />
                <MetricRow label="Claim Density" value={metrics.claimDensity.toFixed(4)} />
                <MetricRow
                    label="Avg Confidence"
                    value={`${(metrics.avgConfidence * 100).toFixed(1)}%`}
                />

                <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0' }} />

                <MetricRow label="Total Claims" value={metrics.totalClaims.toString()} />
                <MetricRow label="Word Count" value={metrics.reviewWordCount.toString()} />

                <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Verdict Breakdown:</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <VerdictBadge label="SUP" count={metrics.verdictCounts.supported} color="#10b981" />
                        <VerdictBadge label="PART" count={metrics.verdictCounts.partiallySupported} color="#3b82f6" />
                        <VerdictBadge label="NOT" count={metrics.verdictCounts.notSupported} color="#f59e0b" />
                        <VerdictBadge label="CONTRA" count={metrics.verdictCounts.contradicted} color="#ef4444" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#aaa' }}>{label}</span>
            <span style={{ fontWeight: 600, color: color || '#fff' }}>{value}</span>
        </div>
    );
}

function VerdictBadge({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <span
            style={{
                backgroundColor: color + '22',
                color: color,
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600
            }}
        >
            {label}: {count}
        </span>
    );
}
