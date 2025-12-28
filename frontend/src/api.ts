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

export interface PapersResponse {
    count: number;
    papers: { id: string; title: string; abstract: string }[];
}

export async function fetchPapers(): Promise<PapersResponse> {
    const res = await fetch(`${API_BASE}/papers`);
    return res.json();
}

export async function runRagPipeline(index: number) {
    const res = await fetch(`${API_BASE}/pipeline/rag?index=${index}`);
    return res.json();
}

export async function runNoRagPipeline(index: number) {
    const res = await fetch(`${API_BASE}/pipeline/no-rag?index=${index}`);
    return res.json();
}

export async function runSingleExperiment(index: number): Promise<PaperExperimentResult> {
    const res = await fetch(`${API_BASE}/experiment/single?index=${index}`);
    return res.json();
}

export async function runJudgePipeline(index: number, useRag: boolean) {
    const res = await fetch(`${API_BASE}/pipeline/judge?index=${index}&useRag=${useRag}`);
    return res.json();
}
