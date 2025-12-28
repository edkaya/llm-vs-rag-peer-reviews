import { ReviewMetrics } from '../evaluation/types';

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
