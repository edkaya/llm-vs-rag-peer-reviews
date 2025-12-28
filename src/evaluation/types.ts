export interface VerdictCounts {
    supported: number;
    partiallySupported: number;
    notSupported: number;
    contradicted: number;
}

export interface ReviewMetrics {
    hallucinationRate: number; // (NOT_SUP + CONTRA) / Total
    groundingScore: number; // (SUP + 0.5*PARTIAL) / Total
    claimDensity: number; // Claims / Word Count
    avgConfidence: number; // Mean(confidence)
    // Raw counts for transparency
    totalClaims: number;
    reviewWordCount: number;
    verdictCounts: VerdictCounts;
}
