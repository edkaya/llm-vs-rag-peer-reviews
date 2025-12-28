const API_BASE = 'http://localhost:3000';

export interface Paper {
    id: string;
    title: string;
    abstract: string;
}

export interface VerdictCounts {
    supported: number;
    partiallySupported: number;
    notSupported: number;
    contradicted: number;
}

export interface ReviewMetrics {
    hallucinationRate: number;
    groundingScore: number;
    claimDensity: number;
    avgConfidence: number;
    totalClaims: number;
    reviewWordCount: number;
    verdictCounts: VerdictCounts;
}

export interface ClaimAnalysis {
    text: string;
    category: string;
    verdict: string;
    confidence: number;
    explanation: string;
}

export interface ReviewAnalysis {
    review: string;
    claims: ClaimAnalysis[];
    metrics: ReviewMetrics;
}

export interface PaperExperimentResult {
    paperId: string;
    paperTitle: string;
    timestamp: string;
    rag: ReviewAnalysis;
    noRag: ReviewAnalysis;
    humanReviews: string[];
    comparison: {
        hallucinationDelta: number;
        groundingDelta: number;
        claimDensityDelta: number;
        confidenceDelta: number;
    };
}

export interface AggregatedMetrics {
    avgHallucinationRate: number;
    avgGroundingScore: number;
    avgClaimDensity: number;
    avgConfidence: number;
}

export interface BatchExperimentResult {
    experimentId: string;
    timestamp: string;
    totalPapers: number;
    results: PaperExperimentResult[];
    aggregated: {
        rag: AggregatedMetrics;
        noRag: AggregatedMetrics;
        deltas: {
            hallucinationRate: number;
            groundingScore: number;
            claimDensity: number;
            confidence: number;
        };
    };
}

export interface PapersResponse {
    count: number;
    papers: { id: string; title: string; abstract: string }[];
}

export async function fetchPapers(): Promise<PapersResponse> {
    const res = await fetch(`${API_BASE}/papers`);
    return res.json();
}

export async function runSingleExperiment(index: number): Promise<PaperExperimentResult> {
    const res = await fetch(`${API_BASE}/experiment/single?index=${index}`);
    return res.json();
}

export async function runBatchExperiment(count: number): Promise<BatchExperimentResult> {
    const res = await fetch(`${API_BASE}/experiment/batch?count=${count}`);
    return res.json();
}
