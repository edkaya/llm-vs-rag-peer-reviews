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

export interface NLIScores {
    entailment: number;
    neutral: number;
    contradiction: number;
}

export interface LLMJudgeClaimResult {
    verdict: string;
    confidence: number;
    explanation: string;
}

export interface NLIClaimResult {
    verdict: string;
    scores: NLIScores;
}

export interface ClaimAnalysis {
    text: string;
    category: string;
    llmJudge: LLMJudgeClaimResult;
    nli: NLIClaimResult;
}

export interface ClaimPipelineStats {
    extractedCount: number;
    validatedCount: number;
    correctedCount: number;
}

export interface ReviewAnalysis {
    review: string;
    claims: ClaimAnalysis[];
    llmJudgeMetrics: ReviewMetrics;
    nliMetrics: ReviewMetrics;
    claimStats: ClaimPipelineStats;
}

export interface MetricDeltas {
    hallucinationDelta: number;
    groundingDelta: number;
    claimDensityDelta: number;
    confidenceDelta: number;
}

export interface PaperExperimentResult {
    paperId: string;
    paperTitle: string;
    paperAbstract: string;
    timestamp: string;
    rag: ReviewAnalysis;
    noRag: ReviewAnalysis;
    humanReviews: string[];
    comparison: {
        llmJudge: MetricDeltas;
        nli: MetricDeltas;
    };
}

export interface AggregatedMetrics {
    avgHallucinationRate: number;
    avgGroundingScore: number;
    avgClaimDensity: number;
    avgConfidence: number;
}

export interface AggregatedDeltas {
    hallucinationRate: number;
    groundingScore: number;
    claimDensity: number;
    confidence: number;
}

export interface BatchExperimentResult {
    experimentId: string;
    timestamp: string;
    totalPapers: number;
    results: PaperExperimentResult[];
    aggregated: {
        llmJudge: {
            rag: AggregatedMetrics;
            noRag: AggregatedMetrics;
            deltas: AggregatedDeltas;
        };
        nli: {
            rag: AggregatedMetrics;
            noRag: AggregatedMetrics;
            deltas: AggregatedDeltas;
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
