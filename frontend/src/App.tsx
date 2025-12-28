import { useState, useEffect } from 'react';
import { fetchPapers, runSingleExperiment } from './api';
import type { PaperExperimentResult } from './api';
import { MetricsCard } from './components/MetricsCard';
import { ComparisonCard } from './components/ComparisonCard';
import { ClaimsList } from './components/ClaimsList';
import { ReviewPanel } from './components/ReviewPanel';
import { PaperSelector } from './components/PaperSelector';

function App() {
    const [papers, setPapers] = useState<{ id: string; title: string; abstract: string }[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<PaperExperimentResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'rag' | 'norag' | 'human'>('rag');

    useEffect(() => {
        fetchPapers()
            .then((data) => {
                setPapers(data.papers || []);
                setLoading(false);
            })
            .catch((err) => {
                setError('Failed to load papers. Is the backend running?');
                setLoading(false);
                console.error(err);
            });
    }, []);

    const handleRunExperiment = async () => {
        setRunning(true);
        setError(null);
        setResult(null);

        try {
            const res = await runSingleExperiment(selectedIndex);
            setResult(res);
        } catch (err) {
            setError('Experiment failed. Check console for details.');
            console.error(err);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: '#fff', padding: 24 }}>
            <header style={{ marginBottom: 32 }}>
                <h1 style={{ margin: 0, fontSize: 28 }}>LLM vs RAG Peer Review Evaluation</h1>
                <p style={{ margin: '8px 0 0 0', color: '#888' }}>
                    Compare hallucination rates between RAG-augmented and pure LLM peer reviews
                </p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 24, alignItems: 'start' }}>
                {/* Left sidebar */}
                <div
                    style={{
                        backgroundColor: '#1a1a1a',
                        borderRadius: 8,
                        padding: 20,
                        position: 'sticky',
                        top: 24
                    }}
                >
                    <PaperSelector
                        papers={papers}
                        selectedIndex={selectedIndex}
                        onSelect={setSelectedIndex}
                        loading={loading}
                    />

                    <button
                        onClick={handleRunExperiment}
                        disabled={running || papers.length === 0}
                        style={{
                            width: '100%',
                            marginTop: 20,
                            padding: '12px 20px',
                            backgroundColor: running ? '#444' : '#6366f1',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: running ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {running ? 'Running Experiment...' : 'Run RAG vs NoRAG Experiment'}
                    </button>

                    {running && (
                        <p style={{ marginTop: 12, fontSize: 13, color: '#888', textAlign: 'center' }}>
                            This may take 1-2 minutes...
                        </p>
                    )}

                    {error && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: 12,
                                backgroundColor: '#ef444422',
                                borderRadius: 6,
                                color: '#ef4444',
                                fontSize: 13
                            }}
                        >
                            {error}
                        </div>
                    )}
                </div>

                {/* Main content */}
                <div>
                    {!result && !running && (
                        <div
                            style={{
                                backgroundColor: '#1a1a1a',
                                borderRadius: 8,
                                padding: 40,
                                textAlign: 'center',
                                color: '#666'
                            }}
                        >
                            <p style={{ fontSize: 18 }}>Select a paper and run an experiment to see results</p>
                        </div>
                    )}

                    {running && (
                        <div
                            style={{
                                backgroundColor: '#1a1a1a',
                                borderRadius: 8,
                                padding: 40,
                                textAlign: 'center'
                            }}
                        >
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    border: '4px solid #333',
                                    borderTopColor: '#6366f1',
                                    borderRadius: '50%',
                                    margin: '0 auto 16px',
                                    animation: 'spin 1s linear infinite'
                                }}
                            />
                            <p style={{ color: '#fff', fontSize: 16, fontWeight: 500 }}>Running experiment...</p>
                            <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>This may take 1-2 minutes</p>
                        </div>
                    )}

                    {result && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Paper info */}
                            <div style={{ backgroundColor: '#1a1a1a', borderRadius: 8, padding: 20 }}>
                                <h2 style={{ margin: '0 0 8px 0', fontSize: 18 }}>{result.paperTitle}</h2>
                                <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                                    Experiment run at {new Date(result.timestamp).toLocaleString()}
                                </p>
                            </div>

                            {/* Metrics comparison */}
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <MetricsCard title="RAG Review" metrics={result.rag.metrics} variant="rag" />
                                <MetricsCard title="NoRAG Review" metrics={result.noRag.metrics} variant="norag" />
                                <ComparisonCard comparison={result.comparison} />
                            </div>

                            {/* Tab selector for review details */}
                            <div style={{ backgroundColor: '#1a1a1a', borderRadius: 8, padding: 20 }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                    <TabButton
                                        active={activeTab === 'rag'}
                                        onClick={() => setActiveTab('rag')}
                                        color="#10b981"
                                    >
                                        RAG Review
                                    </TabButton>
                                    <TabButton
                                        active={activeTab === 'norag'}
                                        onClick={() => setActiveTab('norag')}
                                        color="#f59e0b"
                                    >
                                        NoRAG Review
                                    </TabButton>
                                    <TabButton
                                        active={activeTab === 'human'}
                                        onClick={() => setActiveTab('human')}
                                        color="#8b5cf6"
                                    >
                                        Human Reviews ({result.humanReviews.length})
                                    </TabButton>
                                </div>

                                {activeTab === 'rag' && (
                                    <>
                                        <ReviewPanel review={result.rag.review} title="Generated Review (RAG)" />
                                        <ClaimsList claims={result.rag.claims} title="Extracted Claims (RAG)" />
                                    </>
                                )}
                                {activeTab === 'norag' && (
                                    <>
                                        <ReviewPanel review={result.noRag.review} title="Generated Review (NoRAG)" />
                                        <ClaimsList claims={result.noRag.claims} title="Extracted Claims (NoRAG)" />
                                    </>
                                )}
                                {activeTab === 'human' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {result.humanReviews.map((review, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    backgroundColor: '#252525',
                                                    borderRadius: 6,
                                                    padding: 16,
                                                    borderLeft: '3px solid #8b5cf6'
                                                }}
                                            >
                                                <h4 style={{ margin: '0 0 12px 0', color: '#8b5cf6' }}>
                                                    Human Review #{idx + 1}
                                                </h4>
                                                <div
                                                    style={{
                                                        whiteSpace: 'pre-wrap',
                                                        fontSize: 14,
                                                        lineHeight: 1.6,
                                                        color: '#ddd'
                                                    }}
                                                >
                                                    {review}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    color,
    children
}: {
    active: boolean;
    onClick: () => void;
    color: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '8px 16px',
                backgroundColor: active ? color + '22' : 'transparent',
                color: active ? color : '#888',
                border: `1px solid ${active ? color : '#333'}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: active ? 600 : 400
            }}
        >
            {children}
        </button>
    );
}

export default App;
