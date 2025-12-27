export interface VerdictCounts {
    supported: number;
    partiallySupported: number;
    notSupported: number;
    contradicted: number;
}

export interface ReviewMetrics {
    // Core metrics
    hallucinationRate: number; // (NOT_SUP + CONTRA) / Total
    groundingScore: number; // (SUP + 0.5*PARTIAL) / Total
    claimDensity: number; // Claims / Word Count
    avgConfidence: number; // Mean(confidence)

    // Raw counts for transparency
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

    comparison: {
        hallucinationDelta: number; // RAG - NoRAG (negative = RAG better)
        groundingDelta: number; // RAG - NoRAG (positive = RAG better)
        claimDensityDelta: number; // RAG - NoRAG
        confidenceDelta: number; // RAG - NoRAG
    };
}

export interface BatchExperimentResult {
    experimentId: string;
    timestamp: string;
    totalPapers: number;
    results: PaperExperimentResult[];

    aggregated: {
        rag: {
            avgHallucinationRate: number;
            avgGroundingScore: number;
            avgClaimDensity: number;
            avgConfidence: number;
        };
        noRag: {
            avgHallucinationRate: number;
            avgGroundingScore: number;
            avgClaimDensity: number;
            avgConfidence: number;
        };
        deltas: {
            hallucinationRate: number;
            groundingScore: number;
            claimDensity: number;
            confidence: number;
        };
    };
}
