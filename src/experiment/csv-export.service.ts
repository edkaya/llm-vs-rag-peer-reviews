import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PaperExperimentResult, BatchExperimentResult } from '../experiment/types';

@Injectable()
export class CsvExportService {
    private readonly logger = new Logger(CsvExportService.name);
    private resultsPath: string;

    constructor(private configService: ConfigService) {
        this.resultsPath = this.configService.get<string>('output.resultsPath', './results');
        this.ensureResultsDirectory();
    }

    private ensureResultsDirectory(): void {
        if (!fs.existsSync(this.resultsPath)) {
            fs.mkdirSync(this.resultsPath, { recursive: true });
            this.logger.log(`Created results directory: ${this.resultsPath}`);
        }
    }

    /**
     * Export batch experiment results to CSV with dual detection metrics
     */
    exportBatchResultsToCsv(batchResult: BatchExperimentResult): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `results_${timestamp}_${batchResult.experimentId.slice(0, 8)}.csv`;
        const filepath = path.join(this.resultsPath, filename);

        // CSV headers with dual detection columns
        const headers = [
            'paper_id',
            'paper_title',
            'paper_abstract',
            'review_norag',
            'review_rag',
            'human_reviews',
            // Claim stats (shared - same claims used for both detectors)
            'norag_claims_extracted',
            'norag_claims_validated',
            'norag_claims_corrected',
            'rag_claims_extracted',
            'rag_claims_validated',
            'rag_claims_corrected',
            // LLM Judge - NoRAG metrics
            'llm_norag_hallucination_rate',
            'llm_norag_grounding_score',
            'llm_norag_claim_density',
            'llm_norag_avg_confidence',
            'llm_norag_supported',
            'llm_norag_partially_supported',
            'llm_norag_not_supported',
            'llm_norag_contradicted',
            // LLM Judge - RAG metrics
            'llm_rag_hallucination_rate',
            'llm_rag_grounding_score',
            'llm_rag_claim_density',
            'llm_rag_avg_confidence',
            'llm_rag_supported',
            'llm_rag_partially_supported',
            'llm_rag_not_supported',
            'llm_rag_contradicted',
            // LLM Judge - Deltas
            'llm_hallucination_delta',
            'llm_grounding_delta',
            'llm_claim_density_delta',
            'llm_confidence_delta',
            // NLI - NoRAG metrics
            'nli_norag_hallucination_rate',
            'nli_norag_grounding_score',
            'nli_norag_claim_density',
            'nli_norag_avg_confidence',
            'nli_norag_supported',
            'nli_norag_partially_supported',
            'nli_norag_not_supported',
            'nli_norag_contradicted',
            // NLI - RAG metrics
            'nli_rag_hallucination_rate',
            'nli_rag_grounding_score',
            'nli_rag_claim_density',
            'nli_rag_avg_confidence',
            'nli_rag_supported',
            'nli_rag_partially_supported',
            'nli_rag_not_supported',
            'nli_rag_contradicted',
            // NLI - Deltas
            'nli_hallucination_delta',
            'nli_grounding_delta',
            'nli_claim_density_delta',
            'nli_confidence_delta'
        ];

        // Build CSV rows from experiment results
        const rows: string[] = [];
        for (const result of batchResult.results) {
            const row = [
                this.escapeCsvField(result.paperId),
                this.escapeCsvField(result.paperTitle),
                this.escapeCsvField(result.paperAbstract),
                this.escapeCsvField(result.noRag.review),
                this.escapeCsvField(result.rag.review),
                this.escapeCsvField(result.humanReviews.join(' | ')),
                // Claim stats (shared)
                result.noRag.claimStats.extractedCount.toString(),
                result.noRag.claimStats.validatedCount.toString(),
                result.noRag.claimStats.correctedCount.toString(),
                result.rag.claimStats.extractedCount.toString(),
                result.rag.claimStats.validatedCount.toString(),
                result.rag.claimStats.correctedCount.toString(),
                // LLM Judge - NoRAG metrics
                this.formatDecimal(result.noRag.llmJudgeMetrics.hallucinationRate),
                this.formatDecimal(result.noRag.llmJudgeMetrics.groundingScore),
                this.formatDecimal(result.noRag.llmJudgeMetrics.claimDensity),
                this.formatDecimal(result.noRag.llmJudgeMetrics.avgConfidence),
                result.noRag.llmJudgeMetrics.verdictCounts.supported.toString(),
                result.noRag.llmJudgeMetrics.verdictCounts.partiallySupported.toString(),
                result.noRag.llmJudgeMetrics.verdictCounts.notSupported.toString(),
                result.noRag.llmJudgeMetrics.verdictCounts.contradicted.toString(),
                // LLM Judge - RAG metrics
                this.formatDecimal(result.rag.llmJudgeMetrics.hallucinationRate),
                this.formatDecimal(result.rag.llmJudgeMetrics.groundingScore),
                this.formatDecimal(result.rag.llmJudgeMetrics.claimDensity),
                this.formatDecimal(result.rag.llmJudgeMetrics.avgConfidence),
                result.rag.llmJudgeMetrics.verdictCounts.supported.toString(),
                result.rag.llmJudgeMetrics.verdictCounts.partiallySupported.toString(),
                result.rag.llmJudgeMetrics.verdictCounts.notSupported.toString(),
                result.rag.llmJudgeMetrics.verdictCounts.contradicted.toString(),
                // LLM Judge - Deltas
                this.formatDecimal(result.comparison.llmJudge.hallucinationDelta),
                this.formatDecimal(result.comparison.llmJudge.groundingDelta),
                this.formatDecimal(result.comparison.llmJudge.claimDensityDelta),
                this.formatDecimal(result.comparison.llmJudge.confidenceDelta),
                // NLI - NoRAG metrics
                this.formatDecimal(result.noRag.nliMetrics.hallucinationRate),
                this.formatDecimal(result.noRag.nliMetrics.groundingScore),
                this.formatDecimal(result.noRag.nliMetrics.claimDensity),
                this.formatDecimal(result.noRag.nliMetrics.avgConfidence),
                result.noRag.nliMetrics.verdictCounts.supported.toString(),
                result.noRag.nliMetrics.verdictCounts.partiallySupported.toString(),
                result.noRag.nliMetrics.verdictCounts.notSupported.toString(),
                result.noRag.nliMetrics.verdictCounts.contradicted.toString(),
                // NLI - RAG metrics
                this.formatDecimal(result.rag.nliMetrics.hallucinationRate),
                this.formatDecimal(result.rag.nliMetrics.groundingScore),
                this.formatDecimal(result.rag.nliMetrics.claimDensity),
                this.formatDecimal(result.rag.nliMetrics.avgConfidence),
                result.rag.nliMetrics.verdictCounts.supported.toString(),
                result.rag.nliMetrics.verdictCounts.partiallySupported.toString(),
                result.rag.nliMetrics.verdictCounts.notSupported.toString(),
                result.rag.nliMetrics.verdictCounts.contradicted.toString(),
                // NLI - Deltas
                this.formatDecimal(result.comparison.nli.hallucinationDelta),
                this.formatDecimal(result.comparison.nli.groundingDelta),
                this.formatDecimal(result.comparison.nli.claimDensityDelta),
                this.formatDecimal(result.comparison.nli.confidenceDelta)
            ];
            rows.push(row.join(','));
        }

        // Add aggregated metrics row
        const aggregatedRow = [
            'AGGREGATED',
            '', // paper_title
            '', // paper_abstract
            '', // review_norag
            '', // review_rag
            '', // human_reviews
            // Claim stats (sum)
            this.sumField(batchResult.results, (r) => r.noRag.claimStats.extractedCount).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.claimStats.validatedCount).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.claimStats.correctedCount).toString(),
            this.sumField(batchResult.results, (r) => r.rag.claimStats.extractedCount).toString(),
            this.sumField(batchResult.results, (r) => r.rag.claimStats.validatedCount).toString(),
            this.sumField(batchResult.results, (r) => r.rag.claimStats.correctedCount).toString(),
            // LLM Judge - NoRAG aggregated
            this.formatDecimal(batchResult.aggregated.llmJudge.noRag.avgHallucinationRate),
            this.formatDecimal(batchResult.aggregated.llmJudge.noRag.avgGroundingScore),
            this.formatDecimal(batchResult.aggregated.llmJudge.noRag.avgClaimDensity),
            this.formatDecimal(batchResult.aggregated.llmJudge.noRag.avgConfidence),
            this.sumField(batchResult.results, (r) => r.noRag.llmJudgeMetrics.verdictCounts.supported).toString(),
            this.sumField(
                batchResult.results,
                (r) => r.noRag.llmJudgeMetrics.verdictCounts.partiallySupported
            ).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.llmJudgeMetrics.verdictCounts.notSupported).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.llmJudgeMetrics.verdictCounts.contradicted).toString(),
            // LLM Judge - RAG aggregated
            this.formatDecimal(batchResult.aggregated.llmJudge.rag.avgHallucinationRate),
            this.formatDecimal(batchResult.aggregated.llmJudge.rag.avgGroundingScore),
            this.formatDecimal(batchResult.aggregated.llmJudge.rag.avgClaimDensity),
            this.formatDecimal(batchResult.aggregated.llmJudge.rag.avgConfidence),
            this.sumField(batchResult.results, (r) => r.rag.llmJudgeMetrics.verdictCounts.supported).toString(),
            this.sumField(
                batchResult.results,
                (r) => r.rag.llmJudgeMetrics.verdictCounts.partiallySupported
            ).toString(),
            this.sumField(batchResult.results, (r) => r.rag.llmJudgeMetrics.verdictCounts.notSupported).toString(),
            this.sumField(batchResult.results, (r) => r.rag.llmJudgeMetrics.verdictCounts.contradicted).toString(),
            // LLM Judge - Deltas aggregated
            this.formatDecimal(batchResult.aggregated.llmJudge.deltas.hallucinationRate),
            this.formatDecimal(batchResult.aggregated.llmJudge.deltas.groundingScore),
            this.formatDecimal(batchResult.aggregated.llmJudge.deltas.claimDensity),
            this.formatDecimal(batchResult.aggregated.llmJudge.deltas.confidence),
            // NLI - NoRAG aggregated
            this.formatDecimal(batchResult.aggregated.nli.noRag.avgHallucinationRate),
            this.formatDecimal(batchResult.aggregated.nli.noRag.avgGroundingScore),
            this.formatDecimal(batchResult.aggregated.nli.noRag.avgClaimDensity),
            this.formatDecimal(batchResult.aggregated.nli.noRag.avgConfidence),
            this.sumField(batchResult.results, (r) => r.noRag.nliMetrics.verdictCounts.supported).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.nliMetrics.verdictCounts.partiallySupported).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.nliMetrics.verdictCounts.notSupported).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.nliMetrics.verdictCounts.contradicted).toString(),
            // NLI - RAG aggregated
            this.formatDecimal(batchResult.aggregated.nli.rag.avgHallucinationRate),
            this.formatDecimal(batchResult.aggregated.nli.rag.avgGroundingScore),
            this.formatDecimal(batchResult.aggregated.nli.rag.avgClaimDensity),
            this.formatDecimal(batchResult.aggregated.nli.rag.avgConfidence),
            this.sumField(batchResult.results, (r) => r.rag.nliMetrics.verdictCounts.supported).toString(),
            this.sumField(batchResult.results, (r) => r.rag.nliMetrics.verdictCounts.partiallySupported).toString(),
            this.sumField(batchResult.results, (r) => r.rag.nliMetrics.verdictCounts.notSupported).toString(),
            this.sumField(batchResult.results, (r) => r.rag.nliMetrics.verdictCounts.contradicted).toString(),
            // NLI - Deltas aggregated
            this.formatDecimal(batchResult.aggregated.nli.deltas.hallucinationRate),
            this.formatDecimal(batchResult.aggregated.nli.deltas.groundingScore),
            this.formatDecimal(batchResult.aggregated.nli.deltas.claimDensity),
            this.formatDecimal(batchResult.aggregated.nli.deltas.confidence)
        ];
        rows.push(aggregatedRow.join(','));

        // Write to file
        const csvContent = [headers.join(','), ...rows].join('\n');
        fs.writeFileSync(filepath, csvContent, 'utf-8');
        this.logger.log(`Batch results exported to: ${filepath}`);

        return filepath;
    }

    private sumField(results: PaperExperimentResult[], getter: (r: PaperExperimentResult) => number): number {
        return results.reduce((sum, r) => sum + getter(r), 0);
    }

    /**
     * Export single experiment result to CSV with dual detection metrics
     */
    exportSingleResultToCsv(result: PaperExperimentResult): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `results_${timestamp}_${result.paperId.slice(0, 8)}.csv`;
        const filepath = path.join(this.resultsPath, filename);

        const headers = [
            'paper_id',
            'paper_title',
            'paper_abstract',
            'review_norag',
            'review_rag',
            'human_reviews',
            // Claim stats
            'norag_claims_extracted',
            'norag_claims_validated',
            'norag_claims_corrected',
            'rag_claims_extracted',
            'rag_claims_validated',
            'rag_claims_corrected',
            // LLM Judge - NoRAG metrics
            'llm_norag_hallucination_rate',
            'llm_norag_grounding_score',
            'llm_norag_claim_density',
            'llm_norag_avg_confidence',
            'llm_norag_supported',
            'llm_norag_partially_supported',
            'llm_norag_not_supported',
            'llm_norag_contradicted',
            // LLM Judge - RAG metrics
            'llm_rag_hallucination_rate',
            'llm_rag_grounding_score',
            'llm_rag_claim_density',
            'llm_rag_avg_confidence',
            'llm_rag_supported',
            'llm_rag_partially_supported',
            'llm_rag_not_supported',
            'llm_rag_contradicted',
            // LLM Judge - Deltas
            'llm_hallucination_delta',
            'llm_grounding_delta',
            'llm_claim_density_delta',
            'llm_confidence_delta',
            // NLI - NoRAG metrics
            'nli_norag_hallucination_rate',
            'nli_norag_grounding_score',
            'nli_norag_claim_density',
            'nli_norag_avg_confidence',
            'nli_norag_supported',
            'nli_norag_partially_supported',
            'nli_norag_not_supported',
            'nli_norag_contradicted',
            // NLI - RAG metrics
            'nli_rag_hallucination_rate',
            'nli_rag_grounding_score',
            'nli_rag_claim_density',
            'nli_rag_avg_confidence',
            'nli_rag_supported',
            'nli_rag_partially_supported',
            'nli_rag_not_supported',
            'nli_rag_contradicted',
            // NLI - Deltas
            'nli_hallucination_delta',
            'nli_grounding_delta',
            'nli_claim_density_delta',
            'nli_confidence_delta'
        ];

        const row = [
            this.escapeCsvField(result.paperId),
            this.escapeCsvField(result.paperTitle),
            this.escapeCsvField(result.paperAbstract),
            this.escapeCsvField(result.noRag.review),
            this.escapeCsvField(result.rag.review),
            this.escapeCsvField(result.humanReviews.join(' | ')),
            // Claim stats
            result.noRag.claimStats.extractedCount.toString(),
            result.noRag.claimStats.validatedCount.toString(),
            result.noRag.claimStats.correctedCount.toString(),
            result.rag.claimStats.extractedCount.toString(),
            result.rag.claimStats.validatedCount.toString(),
            result.rag.claimStats.correctedCount.toString(),
            // LLM Judge - NoRAG metrics
            this.formatDecimal(result.noRag.llmJudgeMetrics.hallucinationRate),
            this.formatDecimal(result.noRag.llmJudgeMetrics.groundingScore),
            this.formatDecimal(result.noRag.llmJudgeMetrics.claimDensity),
            this.formatDecimal(result.noRag.llmJudgeMetrics.avgConfidence),
            result.noRag.llmJudgeMetrics.verdictCounts.supported.toString(),
            result.noRag.llmJudgeMetrics.verdictCounts.partiallySupported.toString(),
            result.noRag.llmJudgeMetrics.verdictCounts.notSupported.toString(),
            result.noRag.llmJudgeMetrics.verdictCounts.contradicted.toString(),
            // LLM Judge - RAG metrics
            this.formatDecimal(result.rag.llmJudgeMetrics.hallucinationRate),
            this.formatDecimal(result.rag.llmJudgeMetrics.groundingScore),
            this.formatDecimal(result.rag.llmJudgeMetrics.claimDensity),
            this.formatDecimal(result.rag.llmJudgeMetrics.avgConfidence),
            result.rag.llmJudgeMetrics.verdictCounts.supported.toString(),
            result.rag.llmJudgeMetrics.verdictCounts.partiallySupported.toString(),
            result.rag.llmJudgeMetrics.verdictCounts.notSupported.toString(),
            result.rag.llmJudgeMetrics.verdictCounts.contradicted.toString(),
            // LLM Judge - Deltas
            this.formatDecimal(result.comparison.llmJudge.hallucinationDelta),
            this.formatDecimal(result.comparison.llmJudge.groundingDelta),
            this.formatDecimal(result.comparison.llmJudge.claimDensityDelta),
            this.formatDecimal(result.comparison.llmJudge.confidenceDelta),
            // NLI - NoRAG metrics
            this.formatDecimal(result.noRag.nliMetrics.hallucinationRate),
            this.formatDecimal(result.noRag.nliMetrics.groundingScore),
            this.formatDecimal(result.noRag.nliMetrics.claimDensity),
            this.formatDecimal(result.noRag.nliMetrics.avgConfidence),
            result.noRag.nliMetrics.verdictCounts.supported.toString(),
            result.noRag.nliMetrics.verdictCounts.partiallySupported.toString(),
            result.noRag.nliMetrics.verdictCounts.notSupported.toString(),
            result.noRag.nliMetrics.verdictCounts.contradicted.toString(),
            // NLI - RAG metrics
            this.formatDecimal(result.rag.nliMetrics.hallucinationRate),
            this.formatDecimal(result.rag.nliMetrics.groundingScore),
            this.formatDecimal(result.rag.nliMetrics.claimDensity),
            this.formatDecimal(result.rag.nliMetrics.avgConfidence),
            result.rag.nliMetrics.verdictCounts.supported.toString(),
            result.rag.nliMetrics.verdictCounts.partiallySupported.toString(),
            result.rag.nliMetrics.verdictCounts.notSupported.toString(),
            result.rag.nliMetrics.verdictCounts.contradicted.toString(),
            // NLI - Deltas
            this.formatDecimal(result.comparison.nli.hallucinationDelta),
            this.formatDecimal(result.comparison.nli.groundingDelta),
            this.formatDecimal(result.comparison.nli.claimDensityDelta),
            this.formatDecimal(result.comparison.nli.confidenceDelta)
        ];

        const csvContent = [headers.join(','), row.join(',')].join('\n');
        fs.writeFileSync(filepath, csvContent, 'utf-8');
        this.logger.log(`Single result exported to: ${filepath}`);

        return filepath;
    }

    /**
     * Format decimal values to ensure proper number format (e.g., 0.141 instead of 14.1)
     * Divides by 100 if value appears to be a percentage (> 1)
     */
    private formatDecimal(value: number): string {
        // If value is greater than 1, it's likely stored as percentage (e.g., 14.1 instead of 0.141)
        const normalized = value > 1 ? value / 100 : value;
        return normalized.toString();
    }

    /**
     * Escape CSV fields containing commas, quotes, or newlines
     */
    private escapeCsvField(field: string): string {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    }
}
