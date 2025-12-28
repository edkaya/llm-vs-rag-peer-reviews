import { useState } from 'react';
import { runBatchExperiment } from '../api';
import type { BatchExperimentResult, AggregatedMetrics, PaperExperimentResult, ClaimAnalysis } from '../api';

interface BatchExperimentProps {
    maxPapers: number;
}

export function BatchExperiment({ maxPapers }: BatchExperimentProps) {
    const [count, setCount] = useState(3);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<BatchExperimentResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleRun = async () => {
        setRunning(true);
        setError(null);
        setResult(null);
        setProgress(0);

        // Simulate progress (since we don't have real-time updates from backend)
        const progressInterval = setInterval(() => {
            setProgress((prev) => Math.min(prev + 100 / (count * 60), 95));
        }, 1000);

        try {
            const res = await runBatchExperiment(count);
            setResult(res);
            setProgress(100);
        } catch (err) {
            setError('Batch experiment failed. Check console for details.');
            console.error(err);
        } finally {
            clearInterval(progressInterval);
            setRunning(false);
        }
    };

    return (
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: 8, padding: 20 }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: 20 }}>Batch Experiment</h2>
            <p style={{ margin: '0 0 16px 0', color: '#888', fontSize: 14 }}>
                Run experiments on multiple papers and view aggregated metrics
            </p>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                <label style={{ color: '#aaa' }}>
                    Number of papers:
                    <select
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                        disabled={running}
                        style={{
                            marginLeft: 8,
                            padding: '8px 12px',
                            backgroundColor: '#252525',
                            color: '#fff',
                            border: '1px solid #333',
                            borderRadius: 4,
                            cursor: running ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {Array.from({ length: Math.min(maxPapers, 20) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </label>

                <button
                    onClick={handleRun}
                    disabled={running}
                    style={{
                        padding: '10px 24px',
                        backgroundColor: running ? '#444' : '#8b5cf6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: running ? 'not-allowed' : 'pointer'
                    }}
                >
                    {running ? 'Running...' : 'Run Batch Experiment'}
                </button>
            </div>

            {running && (
                <div style={{ marginBottom: 16 }}>
                    <div
                        style={{
                            height: 8,
                            backgroundColor: '#333',
                            borderRadius: 4,
                            overflow: 'hidden'
                        }}
                    >
                        <div
                            style={{
                                width: `${progress}%`,
                                height: '100%',
                                backgroundColor: '#8b5cf6',
                                transition: 'width 0.5s'
                            }}
                        />
                    </div>
                    <p style={{ margin: '8px 0 0 0', color: '#888', fontSize: 13 }}>
                        Processing {count} papers... This may take several minutes.
                    </p>
                </div>
            )}

            {error && (
                <div
                    style={{
                        padding: 12,
                        backgroundColor: '#ef444422',
                        borderRadius: 6,
                        color: '#ef4444',
                        fontSize: 13,
                        marginBottom: 16
                    }}
                >
                    {error}
                </div>
            )}

            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Summary header */}
                    <div
                        style={{
                            padding: 16,
                            backgroundColor: '#252525',
                            borderRadius: 6,
                            borderLeft: '3px solid #8b5cf6'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#8b5cf6' }}>
                                    Batch Results: {result.totalPapers} Papers
                                </h3>
                                <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: 12 }}>
                                    Experiment ID: {result.experimentId.slice(0, 8)}... |{' '}
                                    {new Date(result.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Aggregated metrics */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <AggregatedMetricsCard
                            title="RAG (Aggregated)"
                            metrics={result.aggregated.rag}
                            variant="rag"
                        />
                        <AggregatedMetricsCard
                            title="NoRAG (Aggregated)"
                            metrics={result.aggregated.noRag}
                            variant="norag"
                        />
                        <AggregatedDeltaCard deltas={result.aggregated.deltas} />
                    </div>

                    {/* Individual paper results */}
                    <div>
                        <h4 style={{ margin: '0 0 12px 0', color: '#aaa' }}>Individual Paper Results</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {result.results.map((paper, idx) => (
                                <PaperResultRow key={paper.paperId} paper={paper} index={idx} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AggregatedMetricsCard({
    title,
    metrics,
    variant
}: {
    title: string;
    metrics: AggregatedMetrics;
    variant: 'rag' | 'norag';
}) {
    const borderColor = variant === 'rag' ? '#10b981' : '#f59e0b';

    return (
        <div
            style={{
                border: `2px solid ${borderColor}`,
                borderRadius: 8,
                padding: 16,
                backgroundColor: '#1e1e1e',
                minWidth: 240,
                flex: 1
            }}
        >
            <h3 style={{ margin: '0 0 12px 0', color: borderColor }}>{title}</h3>
            <div style={{ display: 'grid', gap: 8 }}>
                <MetricRow
                    label="Avg Hallucination"
                    value={`${(metrics.avgHallucinationRate * 100).toFixed(1)}%`}
                    color={metrics.avgHallucinationRate > 0.2 ? '#ef4444' : '#10b981'}
                />
                <MetricRow
                    label="Avg Grounding"
                    value={`${(metrics.avgGroundingScore * 100).toFixed(1)}%`}
                    color={metrics.avgGroundingScore > 0.7 ? '#10b981' : '#f59e0b'}
                />
                <MetricRow label="Avg Claim Density" value={metrics.avgClaimDensity.toFixed(4)} />
                <MetricRow label="Avg Confidence" value={`${(metrics.avgConfidence * 100).toFixed(1)}%`} />
            </div>
        </div>
    );
}

function AggregatedDeltaCard({
    deltas
}: {
    deltas: { hallucinationRate: number; groundingScore: number; claimDensity: number; confidence: number };
}) {
    return (
        <div
            style={{
                border: '2px solid #6366f1',
                borderRadius: 8,
                padding: 16,
                backgroundColor: '#1e1e1e',
                minWidth: 240,
                flex: 1
            }}
        >
            <h3 style={{ margin: '0 0 12px 0', color: '#6366f1' }}>Avg Delta (RAG - NoRAG)</h3>
            <p style={{ fontSize: 11, color: '#888', margin: '0 0 12px 0' }}>
                Negative hallucination = RAG better
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
                <DeltaRow label="Hallucination" value={deltas.hallucinationRate} format="percent" invertColor />
                <DeltaRow label="Grounding" value={deltas.groundingScore} format="percent" />
                <DeltaRow label="Claim Density" value={deltas.claimDensity} format="decimal" />
                <DeltaRow label="Confidence" value={deltas.confidence} format="percent" />
            </div>
        </div>
    );
}

function PaperResultRow({
    paper,
    index
}: {
    paper: PaperExperimentResult;
    index: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'rag' | 'norag'>('rag');
    const delta = paper.comparison.hallucinationDelta;
    const ragBetter = delta < 0;

    return (
        <div style={{ backgroundColor: '#252525', borderRadius: 6, overflow: 'hidden' }}>
            {/* Header row - clickable */}
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                    gap: 16,
                    padding: 12,
                    alignItems: 'center',
                    fontSize: 13,
                    cursor: 'pointer'
                }}
            >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#666', marginRight: 8 }}>#{index + 1}</span>
                    {paper.paperTitle}
                </div>
                <div>
                    <span style={{ color: '#10b981' }}>RAG: </span>
                    <span>{(paper.rag.metrics.hallucinationRate * 100).toFixed(1)}%</span>
                </div>
                <div>
                    <span style={{ color: '#f59e0b' }}>NoRAG: </span>
                    <span>{(paper.noRag.metrics.hallucinationRate * 100).toFixed(1)}%</span>
                </div>
                <div style={{ color: ragBetter ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {delta > 0 ? '+' : ''}
                    {(delta * 100).toFixed(1)}%
                </div>
                <div style={{ color: '#666', fontSize: 16 }}>{expanded ? '▼' : '▶'}</div>
            </div>

            {/* Expanded content */}
            {expanded && (
                <div style={{ padding: '0 12px 12px 12px', borderTop: '1px solid #333' }}>
                    {/* Tab buttons */}
                    <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
                        <button
                            onClick={() => setActiveTab('rag')}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: activeTab === 'rag' ? '#10b98122' : 'transparent',
                                color: activeTab === 'rag' ? '#10b981' : '#888',
                                border: `1px solid ${activeTab === 'rag' ? '#10b981' : '#444'}`,
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 12
                            }}
                        >
                            RAG Review ({paper.rag.claims.length} claims)
                        </button>
                        <button
                            onClick={() => setActiveTab('norag')}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: activeTab === 'norag' ? '#f59e0b22' : 'transparent',
                                color: activeTab === 'norag' ? '#f59e0b' : '#888',
                                border: `1px solid ${activeTab === 'norag' ? '#f59e0b' : '#444'}`,
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 12
                            }}
                        >
                            NoRAG Review ({paper.noRag.claims.length} claims)
                        </button>
                    </div>

                    {/* Review content */}
                    <ReviewSection
                        review={activeTab === 'rag' ? paper.rag.review : paper.noRag.review}
                        claims={activeTab === 'rag' ? paper.rag.claims : paper.noRag.claims}
                        variant={activeTab}
                    />
                </div>
            )}
        </div>
    );
}

function ReviewSection({
    review,
    claims,
    variant
}: {
    review: string;
    claims: ClaimAnalysis[];
    variant: 'rag' | 'norag';
}) {
    const [showFullReview, setShowFullReview] = useState(false);
    const borderColor = variant === 'rag' ? '#10b981' : '#f59e0b';
    const truncatedReview = review.length > 500 ? review.slice(0, 500) + '...' : review;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Review text */}
            <div
                style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: 6,
                    padding: 12,
                    borderLeft: `3px solid ${borderColor}`
                }}
            >
                <h5 style={{ margin: '0 0 8px 0', color: borderColor, fontSize: 13 }}>Generated Review</h5>
                <div
                    style={{
                        whiteSpace: 'pre-wrap',
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: '#ccc',
                        maxHeight: showFullReview ? 'none' : 150,
                        overflow: 'hidden'
                    }}
                >
                    {showFullReview ? review : truncatedReview}
                </div>
                {review.length > 500 && (
                    <button
                        onClick={() => setShowFullReview(!showFullReview)}
                        style={{
                            marginTop: 8,
                            padding: '4px 8px',
                            backgroundColor: 'transparent',
                            color: borderColor,
                            border: `1px solid ${borderColor}`,
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 11
                        }}
                    >
                        {showFullReview ? 'Show less' : 'Show full review'}
                    </button>
                )}
            </div>

            {/* Claims list */}
            <div
                style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: 6,
                    padding: 12
                }}
            >
                <h5 style={{ margin: '0 0 8px 0', color: '#aaa', fontSize: 13 }}>
                    Extracted Claims ({claims.length})
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                    {claims.map((claim, idx) => (
                        <ClaimItem key={idx} claim={claim} index={idx} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ClaimItem({ claim, index }: { claim: ClaimAnalysis; index: number }) {
    const verdictColors: Record<string, string> = {
        SUPPORTED: '#10b981',
        PARTIALLY_SUPPORTED: '#3b82f6',
        NOT_SUPPORTED: '#f59e0b',
        CONTRADICTED: '#ef4444'
    };
    const color = verdictColors[claim.verdict] || '#888';

    return (
        <div
            style={{
                padding: 8,
                backgroundColor: '#252525',
                borderRadius: 4,
                borderLeft: `3px solid ${color}`,
                fontSize: 12
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#666' }}>#{index + 1}</span>
                <span
                    style={{
                        backgroundColor: color + '22',
                        color: color,
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600
                    }}
                >
                    {claim.verdict}
                </span>
            </div>
            <div style={{ color: '#ddd', marginBottom: 4 }}>{claim.text}</div>
            <div style={{ color: '#888', fontSize: 11, fontStyle: 'italic' }}>{claim.explanation}</div>
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
