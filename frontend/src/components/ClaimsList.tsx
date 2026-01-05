import type { ClaimAnalysis } from '../api';

interface ClaimsListProps {
    claims: ClaimAnalysis[];
    title: string;
}

const verdictColors: Record<string, string> = {
    SUPPORTED: '#10b981',
    PARTIALLY_SUPPORTED: '#3b82f6',
    NOT_SUPPORTED: '#f59e0b',
    CONTRADICTED: '#ef4444',
    UNVERIFIABLE: '#f59e0b'
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
    const llmColor = verdictColors[claim.llmJudge.verdict] || '#888';
    const nliColor = verdictColors[claim.nli.verdict] || '#888';

    return (
        <div
            style={{
                backgroundColor: '#252525',
                borderRadius: 6,
                padding: 12
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#888' }}>
                    #{index} | {claim.category}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                    <span
                        style={{
                            backgroundColor: '#8b5cf622',
                            color: '#8b5cf6',
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 600
                        }}
                    >
                        LLM
                    </span>
                    <span
                        style={{
                            backgroundColor: llmColor + '22',
                            color: llmColor,
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 600
                        }}
                    >
                        {claim.llmJudge.verdict}
                    </span>
                    <span style={{ color: '#444' }}>|</span>
                    <span
                        style={{
                            backgroundColor: '#ec489922',
                            color: '#ec4899',
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 600
                        }}
                    >
                        NLI
                    </span>
                    <span
                        style={{
                            backgroundColor: nliColor + '22',
                            color: nliColor,
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 600
                        }}
                    >
                        {claim.nli.verdict}
                    </span>
                </div>
            </div>
            <p style={{ margin: '8px 0 8px 0', fontSize: 14, color: '#ddd' }}>{claim.text}</p>

            {/* LLM Judge details */}
            <div style={{ marginBottom: 6, paddingLeft: 8, borderLeft: `2px solid ${llmColor}` }}>
                <div style={{ color: '#8b5cf6', fontSize: 10, fontWeight: 600, marginBottom: 2 }}>
                    LLM Judge (conf: {(claim.llmJudge.confidence * 100).toFixed(0)}%)
                </div>
                <div style={{ color: '#aaa', fontSize: 11, fontStyle: 'italic' }}>
                    {claim.llmJudge.explanation}
                </div>
            </div>

            {/* NLI details */}
            <div style={{ paddingLeft: 8, borderLeft: `2px solid ${nliColor}` }}>
                <div style={{ color: '#ec4899', fontSize: 10, fontWeight: 600, marginBottom: 2 }}>
                    NLI (E: {(claim.nli.scores.entailment * 100).toFixed(0)}% | N:{' '}
                    {(claim.nli.scores.neutral * 100).toFixed(0)}% | C:{' '}
                    {(claim.nli.scores.contradiction * 100).toFixed(0)}%)
                </div>
            </div>
        </div>
    );
}
