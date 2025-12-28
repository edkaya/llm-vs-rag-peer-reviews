import type { ClaimAnalysis } from '../api';

interface ClaimsListProps {
    claims: ClaimAnalysis[];
    title: string;
}

const verdictColors: Record<string, string> = {
    SUPPORTED: '#10b981',
    PARTIALLY_SUPPORTED: '#3b82f6',
    NOT_SUPPORTED: '#f59e0b',
    CONTRADICTED: '#ef4444'
};

export function ClaimsList({ claims, title }: ClaimsListProps) {
    return (
        <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#ccc' }}>{title}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {claims.map((claim, idx) => (
                    <ClaimItem key={idx} claim={claim} index={idx + 1} />
                ))}
            </div>
        </div>
    );
}

function ClaimItem({ claim, index }: { claim: ClaimAnalysis; index: number }) {
    const color = verdictColors[claim.verdict] || '#888';

    return (
        <div
            style={{
                backgroundColor: '#252525',
                borderRadius: 6,
                padding: 12,
                borderLeft: `3px solid ${color}`
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#888' }}>
                    #{index} | {claim.category}
                </span>
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color,
                        backgroundColor: color + '22',
                        padding: '2px 6px',
                        borderRadius: 4
                    }}
                >
                    {claim.verdict} ({(claim.confidence * 100).toFixed(0)}%)
                </span>
            </div>
            <p style={{ margin: '8px 0 4px 0', fontSize: 14, color: '#ddd' }}>{claim.text}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#888', fontStyle: 'italic' }}>
                {claim.explanation}
            </p>
        </div>
    );
}
