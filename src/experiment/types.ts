import { ReviewMetrics } from '../evaluation/types';
import { NLIScores } from '../hallucination/nli.service';

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
    hallucinationDelta: number; // RAG - NoRAG (negative = RAG better)
    groundingDelta: number; // RAG - NoRAG (positive = RAG better)
    claimDensityDelta: number; // RAG - NoRAG
    confidenceDelta: number; // RAG - NoRAG
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
