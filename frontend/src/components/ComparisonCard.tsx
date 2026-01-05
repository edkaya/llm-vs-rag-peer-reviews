interface ComparisonCardProps {
    title: string;
    comparison: {
        hallucinationDelta: number;
        groundingDelta: number;
        claimDensityDelta: number;
        confidenceDelta: number;
    };
}

export function ComparisonCard({ title, comparison }: ComparisonCardProps) {
    return (
        <div
            style={{
                border: '2px solid #6366f1',
                borderRadius: 8,
                padding: 16,
                backgroundColor: '#1e1e1e',
                minWidth: 280
            }}
        >
            <h3 style={{ margin: '0 0 12px 0', color: '#6366f1' }}>{title} (RAG - NoRAG)</h3>
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px 0' }}>
                Negative hallucination = RAG better | Positive grounding = RAG better
            </p>

            <div style={{ display: 'grid', gap: 8 }}>
                <DeltaRow
                    label="Hallucination"
                    value={comparison.hallucinationDelta}
                    format="percent"
                    invertColor
                />
                <DeltaRow label="Grounding" value={comparison.groundingDelta} format="percent" />
                <DeltaRow label="Claim Density" value={comparison.claimDensityDelta} format="decimal" />
                <DeltaRow label="Confidence" value={comparison.confidenceDelta} format="percent" />
            </div>
        </div>
    );
}

function DeltaRow({
    label,
    value,
    format,
    invertColor
}: {
    label: string;
    value: number;
    format: 'percent' | 'decimal';
    invertColor?: boolean;
}) {
    const isPositive = value > 0;
    const isNegative = value < 0;

    let color = '#888';
    if (invertColor) {
        color = isNegative ? '#10b981' : isPositive ? '#ef4444' : '#888';
    } else {
        color = isPositive ? '#10b981' : isNegative ? '#ef4444' : '#888';
    }

    const sign = isPositive ? '+' : '';
    const formatted =
        format === 'percent' ? `${sign}${(value * 100).toFixed(1)}%` : `${sign}${value.toFixed(4)}`;

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#aaa' }}>{label}</span>
            <span style={{ fontWeight: 600, color }}>{formatted}</span>
        </div>
    );
}
