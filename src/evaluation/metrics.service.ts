import { Injectable } from '@nestjs/common';
import { LLMJudgeResult } from '../hallucination/llm-judge.service';
import { ReviewMetrics, VerdictCounts } from './types';

@Injectable()
export class MetricsService {
    /**
     * Calculate all metrics for a single review
     *
     * @param judgeResults - Array of LLM Judge verdicts for each claim
     * @param reviewText - The generated review text
     * @returns ReviewMetrics with all 4 core metrics + raw counts
     */
    calculateMetrics(judgeResults: LLMJudgeResult[], reviewText: string): ReviewMetrics {
        const totalClaims = judgeResults.length;
        const reviewWordCount = this.countWords(reviewText);

        // Count verdicts
        const verdictCounts = this.countVerdicts(judgeResults);

        // Handle edge case: no claims
        if (totalClaims === 0) {
            return {
                hallucinationRate: 0,
                groundingScore: 0,
                claimDensity: 0,
                avgConfidence: 0,
                totalClaims: 0,
                reviewWordCount,
                verdictCounts
            };
        }

        // 1. Hallucination Rate = (NOT_SUPPORTED + CONTRADICTED) / Total
        const hallucinationRate = (verdictCounts.notSupported + verdictCounts.contradicted) / totalClaims;

        // 2. Grounding Score = (SUPPORTED + 0.5 * PARTIALLY_SUPPORTED) / Total
        const groundingScore = (verdictCounts.supported + 0.5 * verdictCounts.partiallySupported) / totalClaims;

        // 3. Claim Density = Total Claims / Word Count
        const claimDensity = reviewWordCount > 0 ? totalClaims / reviewWordCount : 0;

        // 4. Average Confidence = Mean of all confidence scores
        const avgConfidence = this.calculateAverageConfidence(judgeResults);

        return {
            hallucinationRate: this.round(hallucinationRate),
            groundingScore: this.round(groundingScore),
            claimDensity: this.round(claimDensity, 4),
            avgConfidence: this.round(avgConfidence),
            totalClaims,
            reviewWordCount,
            verdictCounts
        };
    }

    /**
     * Compare metrics between RAG and NoRAG reviews
     *
     * Delta interpretation:
     * - hallucinationDelta: negative = RAG is better (fewer hallucinations)
     * - groundingDelta: positive = RAG is better (more grounded)
     * - claimDensityDelta: no inherent "better", just difference
     * - confidenceDelta: positive = RAG claims are more confidently verified
     */
    compareMetrics(
        ragMetrics: ReviewMetrics,
        noRagMetrics: ReviewMetrics
    ): {
        hallucinationDelta: number;
        groundingDelta: number;
        claimDensityDelta: number;
        confidenceDelta: number;
    } {
        return {
            hallucinationDelta: this.round(ragMetrics.hallucinationRate - noRagMetrics.hallucinationRate),
            groundingDelta: this.round(ragMetrics.groundingScore - noRagMetrics.groundingScore),
            claimDensityDelta: this.round(ragMetrics.claimDensity - noRagMetrics.claimDensity, 4),
            confidenceDelta: this.round(ragMetrics.avgConfidence - noRagMetrics.avgConfidence)
        };
    }

    /**
     * Aggregate metrics across multiple papers for batch experiments
     */
    aggregateMetrics(metricsArray: ReviewMetrics[]): {
        avgHallucinationRate: number;
        avgGroundingScore: number;
        avgClaimDensity: number;
        avgConfidence: number;
    } {
        if (metricsArray.length === 0) {
            return {
                avgHallucinationRate: 0,
                avgGroundingScore: 0,
                avgClaimDensity: 0,
                avgConfidence: 0
            };
        }

        const sum = metricsArray.reduce(
            (acc, m) => ({
                hallucinationRate: acc.hallucinationRate + m.hallucinationRate,
                groundingScore: acc.groundingScore + m.groundingScore,
                claimDensity: acc.claimDensity + m.claimDensity,
                avgConfidence: acc.avgConfidence + m.avgConfidence
            }),
            { hallucinationRate: 0, groundingScore: 0, claimDensity: 0, avgConfidence: 0 }
        );

        const count = metricsArray.length;
        return {
            avgHallucinationRate: this.round(sum.hallucinationRate / count),
            avgGroundingScore: this.round(sum.groundingScore / count),
            avgClaimDensity: this.round(sum.claimDensity / count, 4),
            avgConfidence: this.round(sum.avgConfidence / count)
        };
    }

    private countVerdicts(judgeResults: LLMJudgeResult[]): VerdictCounts {
        return {
            supported: judgeResults.filter((r) => r.verdict === 'SUPPORTED').length,
            partiallySupported: judgeResults.filter((r) => r.verdict === 'PARTIALLY_SUPPORTED').length,
            notSupported: judgeResults.filter((r) => r.verdict === 'NOT_SUPPORTED').length,
            contradicted: judgeResults.filter((r) => r.verdict === 'CONTRADICTED').length
        };
    }

    private calculateAverageConfidence(judgeResults: LLMJudgeResult[]): number {
        if (judgeResults.length === 0) return 0;
        const sum = judgeResults.reduce((acc, r) => acc + r.confidence, 0);
        return sum / judgeResults.length;
    }

    private countWords(text: string): number {
        return text
            .trim()
            .split(/\s+/)
            .filter((word) => word.length > 0).length;
    }

    private round(value: number, decimals: number = 3): number {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }
}
