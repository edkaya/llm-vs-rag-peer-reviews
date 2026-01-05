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
     * Export batch experiment results to CSV
     */
    exportBatchResultsToCsv(batchResult: BatchExperimentResult): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `results_${timestamp}_${batchResult.experimentId.slice(0, 8)}.csv`;
        const filepath = path.join(this.resultsPath, filename);

        // CSV headers
        const headers = [
            'paper_id',
            'paper_title',
            'paper_abstract',
            'review_norag',
            'review_rag',
            'human_reviews',
            // NoRAG metrics
            'norag_hallucination_rate',
            'norag_grounding_score',
            'norag_claim_density',
            'norag_avg_confidence',
            // NoRAG claim stats
            'norag_claims_extracted',
            'norag_claims_validated',
            'norag_claims_corrected',
            // NoRAG verdict counts
            'norag_supported',
            'norag_partially_supported',
            'norag_not_supported',
            'norag_contradicted',
            // RAG metrics
            'rag_hallucination_rate',
            'rag_grounding_score',
            'rag_claim_density',
            'rag_avg_confidence',
            // RAG claim stats
            'rag_claims_extracted',
            'rag_claims_validated',
            'rag_claims_corrected',
            // RAG verdict counts
            'rag_supported',
            'rag_partially_supported',
            'rag_not_supported',
            'rag_contradicted',
            // Deltas
            'hallucination_delta',
            'grounding_delta',
            'claim_density_delta',
            'confidence_delta'
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
                // NoRAG metrics
                this.formatDecimal(result.noRag.metrics.hallucinationRate),
                this.formatDecimal(result.noRag.metrics.groundingScore),
                this.formatDecimal(result.noRag.metrics.claimDensity),
                this.formatDecimal(result.noRag.metrics.avgConfidence),
                // NoRAG claim stats
                result.noRag.claimStats.extractedCount.toString(),
                result.noRag.claimStats.validatedCount.toString(),
                result.noRag.claimStats.correctedCount.toString(),
                // NoRAG verdict counts
                result.noRag.metrics.verdictCounts.supported.toString(),
                result.noRag.metrics.verdictCounts.partiallySupported.toString(),
                result.noRag.metrics.verdictCounts.notSupported.toString(),
                result.noRag.metrics.verdictCounts.contradicted.toString(),
                // RAG metrics
                this.formatDecimal(result.rag.metrics.hallucinationRate),
                this.formatDecimal(result.rag.metrics.groundingScore),
                this.formatDecimal(result.rag.metrics.claimDensity),
                this.formatDecimal(result.rag.metrics.avgConfidence),
                // RAG claim stats
                result.rag.claimStats.extractedCount.toString(),
                result.rag.claimStats.validatedCount.toString(),
                result.rag.claimStats.correctedCount.toString(),
                // RAG verdict counts
                result.rag.metrics.verdictCounts.supported.toString(),
                result.rag.metrics.verdictCounts.partiallySupported.toString(),
                result.rag.metrics.verdictCounts.notSupported.toString(),
                result.rag.metrics.verdictCounts.contradicted.toString(),
                // Deltas
                this.formatDecimal(result.comparison.hallucinationDelta),
                this.formatDecimal(result.comparison.groundingDelta),
                this.formatDecimal(result.comparison.claimDensityDelta),
                this.formatDecimal(result.comparison.confidenceDelta)
            ];
            rows.push(row.join(','));
        }

        // Add aggregated metrics row (empty cells for non-aggregatable fields)
        const aggregatedRow = [
            'AGGREGATED',
            '', // paper_title
            '', // paper_abstract
            '', // review_norag
            '', // review_rag
            '', // human_reviews
            // NoRAG metrics (aggregated)
            this.formatDecimal(batchResult.aggregated.noRag.avgHallucinationRate),
            this.formatDecimal(batchResult.aggregated.noRag.avgGroundingScore),
            this.formatDecimal(batchResult.aggregated.noRag.avgClaimDensity),
            this.formatDecimal(batchResult.aggregated.noRag.avgConfidence),
            // NoRAG claim stats (sum across all papers)
            this.sumField(batchResult.results, (r) => r.noRag.claimStats.extractedCount).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.claimStats.validatedCount).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.claimStats.correctedCount).toString(),
            // NoRAG verdict counts (sum)
            this.sumField(batchResult.results, (r) => r.noRag.metrics.verdictCounts.supported).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.metrics.verdictCounts.partiallySupported).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.metrics.verdictCounts.notSupported).toString(),
            this.sumField(batchResult.results, (r) => r.noRag.metrics.verdictCounts.contradicted).toString(),
            // RAG metrics (aggregated)
            this.formatDecimal(batchResult.aggregated.rag.avgHallucinationRate),
            this.formatDecimal(batchResult.aggregated.rag.avgGroundingScore),
            this.formatDecimal(batchResult.aggregated.rag.avgClaimDensity),
            this.formatDecimal(batchResult.aggregated.rag.avgConfidence),
            // RAG claim stats (sum)
            this.sumField(batchResult.results, (r) => r.rag.claimStats.extractedCount).toString(),
            this.sumField(batchResult.results, (r) => r.rag.claimStats.validatedCount).toString(),
            this.sumField(batchResult.results, (r) => r.rag.claimStats.correctedCount).toString(),
            // RAG verdict counts (sum)
            this.sumField(batchResult.results, (r) => r.rag.metrics.verdictCounts.supported).toString(),
            this.sumField(batchResult.results, (r) => r.rag.metrics.verdictCounts.partiallySupported).toString(),
            this.sumField(batchResult.results, (r) => r.rag.metrics.verdictCounts.notSupported).toString(),
            this.sumField(batchResult.results, (r) => r.rag.metrics.verdictCounts.contradicted).toString(),
            // Deltas
            this.formatDecimal(batchResult.aggregated.deltas.hallucinationRate),
            this.formatDecimal(batchResult.aggregated.deltas.groundingScore),
            this.formatDecimal(batchResult.aggregated.deltas.claimDensity),
            this.formatDecimal(batchResult.aggregated.deltas.confidence)
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
     * Export single experiment result to CSV
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
            // NoRAG metrics
            'norag_hallucination_rate',
            'norag_grounding_score',
            'norag_claim_density',
            'norag_avg_confidence',
            // NoRAG claim stats
            'norag_claims_extracted',
            'norag_claims_validated',
            'norag_claims_corrected',
            // NoRAG verdict counts
            'norag_supported',
            'norag_partially_supported',
            'norag_not_supported',
            'norag_contradicted',
            // RAG metrics
            'rag_hallucination_rate',
            'rag_grounding_score',
            'rag_claim_density',
            'rag_avg_confidence',
            // RAG claim stats
            'rag_claims_extracted',
            'rag_claims_validated',
            'rag_claims_corrected',
            // RAG verdict counts
            'rag_supported',
            'rag_partially_supported',
            'rag_not_supported',
            'rag_contradicted',
            // Deltas
            'hallucination_delta',
            'grounding_delta',
            'claim_density_delta',
            'confidence_delta'
        ];

        const row = [
            this.escapeCsvField(result.paperId),
            this.escapeCsvField(result.paperTitle),
            this.escapeCsvField(result.paperAbstract),
            this.escapeCsvField(result.noRag.review),
            this.escapeCsvField(result.rag.review),
            this.escapeCsvField(result.humanReviews.join(' | ')),
            // NoRAG metrics
            this.formatDecimal(result.noRag.metrics.hallucinationRate),
            this.formatDecimal(result.noRag.metrics.groundingScore),
            this.formatDecimal(result.noRag.metrics.claimDensity),
            this.formatDecimal(result.noRag.metrics.avgConfidence),
            // NoRAG claim stats
            result.noRag.claimStats.extractedCount.toString(),
            result.noRag.claimStats.validatedCount.toString(),
            result.noRag.claimStats.correctedCount.toString(),
            // NoRAG verdict counts
            result.noRag.metrics.verdictCounts.supported.toString(),
            result.noRag.metrics.verdictCounts.partiallySupported.toString(),
            result.noRag.metrics.verdictCounts.notSupported.toString(),
            result.noRag.metrics.verdictCounts.contradicted.toString(),
            // RAG metrics
            this.formatDecimal(result.rag.metrics.hallucinationRate),
            this.formatDecimal(result.rag.metrics.groundingScore),
            this.formatDecimal(result.rag.metrics.claimDensity),
            this.formatDecimal(result.rag.metrics.avgConfidence),
            // RAG claim stats
            result.rag.claimStats.extractedCount.toString(),
            result.rag.claimStats.validatedCount.toString(),
            result.rag.claimStats.correctedCount.toString(),
            // RAG verdict counts
            result.rag.metrics.verdictCounts.supported.toString(),
            result.rag.metrics.verdictCounts.partiallySupported.toString(),
            result.rag.metrics.verdictCounts.notSupported.toString(),
            result.rag.metrics.verdictCounts.contradicted.toString(),
            // Deltas
            this.formatDecimal(result.comparison.hallucinationDelta),
            this.formatDecimal(result.comparison.groundingDelta),
            this.formatDecimal(result.comparison.claimDensityDelta),
            this.formatDecimal(result.comparison.confidenceDelta)
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
