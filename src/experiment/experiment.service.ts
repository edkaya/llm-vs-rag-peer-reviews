import { Injectable, Logger } from '@nestjs/common';
import { PaperExperimentResult, ClaimAnalysis, BatchExperimentResult, ClaimPipelineStats } from './types';
import { Paper } from '../data/types';
import { DatasetLoaderService } from 'src/data/dataset-loader.service';
import { RagService } from 'src/rag/rag.service';
import { ReviewMetrics } from 'src/evaluation/types';
import { ClaimExtractionService } from 'src/claim/claim-extraction.service';
import { ClaimValidationService } from 'src/claim/claim-validation.service';
import { LLMJudgeService } from 'src/hallucination/llm-judge.service';
import { MetricsService } from 'src/evaluation/metrics.service';
import { NLIService } from 'src/hallucination/nli.service';
import { EmbeddingSimilarityService } from 'src/hallucination/embedding-similarity.service';
import { CsvExportService } from './csv-export.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExperimentService {
    private readonly logger = new Logger(ExperimentService.name);
    private papers: Paper[] = [];

    constructor(
        private datasetLoaderService: DatasetLoaderService,
        private ragService: RagService,
        private claimExtractionService: ClaimExtractionService,
        private claimValidationService: ClaimValidationService,
        private llmJudgeService: LLMJudgeService,
        private metricsService: MetricsService,
        private nliService: NLIService,
        private embeddingSimilarityService: EmbeddingSimilarityService,
        private csvExportService: CsvExportService
    ) {}

    getAllPapers() {
        if (this.papers.length === 0) {
            this.papers = this.datasetLoaderService.loadPapers();
        }

        return {
            count: this.papers.length,
            papers: this.papers.map((p) => ({
                id: p.id,
                title: p.title,
                abstract: p.abstract
            }))
        };
    }

    async runSingleExperiment(index: string): Promise<PaperExperimentResult> {
        // Load papers all available papers
        if (this.papers.length === 0) {
            this.logger.log('Loading papers...');
            this.papers = this.datasetLoaderService.loadPapers();
        }

        const i = parseInt(index, 10);
        if (i >= this.papers.length) {
            throw new Error(`Index ${i} out of range. Loaded ${this.papers.length} papers.`);
        }
        // Index all human reviews for RAG
        this.logger.log('Indexing all human reviews for RAG...');
        await this.ragService.indexAllHumanReviews(this.papers);

        const paper = this.papers[i];
        this.logger.log(`Starting experiment for paper: ${paper.title}`);

        // Index the paper (needed for hallucination detection)
        await this.ragService.indexPaper(paper);

        // Run RAG pipeline
        this.logger.log('=== Running RAG Pipeline ===');
        const ragAnalysis = await this.runAnalysisPipeline(paper, true);

        // Run NoRAG pipeline
        this.logger.log('=== Running NoRAG Pipeline ===');
        const noRagAnalysis = await this.runAnalysisPipeline(paper, false);

        // Compare metrics
        const comparison = this.metricsService.compareMetrics(ragAnalysis.metrics, noRagAnalysis.metrics);

        this.logger.log('Experiment complete!');
        this.logger.log(`RAG Hallucination Rate: ${ragAnalysis.metrics.hallucinationRate}`);
        this.logger.log(`NoRAG Hallucination Rate: ${noRagAnalysis.metrics.hallucinationRate}`);
        this.logger.log(`Delta: ${comparison.hallucinationDelta} (negative Delta = RAG better)`);

        const PaperExperimentResult = {
            paperId: paper.id,
            paperTitle: paper.title,
            paperAbstract: paper.abstract,
            timestamp: new Date().toISOString(),
            rag: ragAnalysis,
            noRag: noRagAnalysis,
            humanReviews: paper.humanReviews.map(
                (r) =>
                    `**Summary:** ${r.paperSummary}\n\n**Strengths:** ${r.strengths}\n\n**Weaknesses:** ${r.weaknesses}\n\n**Comments:** ${r.comments}`
            ),
            comparison
        };

        // Export to CSV
        const csvPath = this.csvExportService.exportSingleResultToCsv(PaperExperimentResult);
        this.logger.log(`Single experiment result exported to CSV: ${csvPath}`);

        return PaperExperimentResult;
    }

    async runBatchExperiment(count: string): Promise<BatchExperimentResult> {
        const numPapers = Math.min(parseInt(count, 10), 50);

        // Load papers all available papers
        if (this.papers.length === 0) {
            this.logger.log('Loading papers...');
            this.papers = this.datasetLoaderService.loadPapers();
        }

        if (numPapers > this.papers.length) {
            throw new Error(`Requested ${numPapers} papers but only ${this.papers.length} available.`);
        }

        // Index all human reviews for RAG
        this.logger.log('Indexing all human reviews for RAG...');
        await this.ragService.indexAllHumanReviews(this.papers);

        const experimentId = uuidv4();
        this.logger.log(`Starting batch experiment ${experimentId} for ${numPapers} papers...`);

        const results: PaperExperimentResult[] = [];

        // Run experiment for each paper
        for (let i = 0; i < numPapers; i++) {
            const paper = this.papers[i];
            this.logger.log(`\n=== Paper ${i + 1}/${numPapers}: ${paper.title} ===`);

            try {
                // Index the paper
                await this.ragService.indexPaper(paper);

                // Run both pipelines
                const ragAnalysis = await this.runAnalysisPipeline(paper, true);
                const noRagAnalysis = await this.runAnalysisPipeline(paper, false);

                // Compare metrics
                const comparison = this.metricsService.compareMetrics(ragAnalysis.metrics, noRagAnalysis.metrics);

                results.push({
                    paperId: paper.id,
                    paperTitle: paper.title,
                    paperAbstract: paper.abstract,
                    timestamp: new Date().toISOString(),
                    rag: ragAnalysis,
                    noRag: noRagAnalysis,
                    humanReviews: paper.humanReviews.map(
                        (r) =>
                            `**Summary:** ${r.paperSummary}\n\n**Strengths:** ${r.strengths}\n\n**Weaknesses:** ${r.weaknesses}\n\n**Comments:** ${r.comments}`
                    ),
                    comparison
                });

                this.logger.log(
                    `Paper ${i + 1} complete: RAG=${ragAnalysis.metrics.hallucinationRate}, NoRAG=${noRagAnalysis.metrics.hallucinationRate}`
                );
            } catch (error) {
                this.logger.error(`Failed to process paper ${i}: ${error}`);
                // Continue with next paper
            }
        }

        // Aggregate metrics across all papers
        const ragMetricsArray = results.map((r) => r.rag.metrics);
        const noRagMetricsArray = results.map((r) => r.noRag.metrics);

        const aggregatedRag = this.metricsService.aggregateMetrics(ragMetricsArray);
        const aggregatedNoRag = this.metricsService.aggregateMetrics(noRagMetricsArray);

        const aggregated = {
            rag: aggregatedRag,
            noRag: aggregatedNoRag,
            deltas: {
                hallucinationRate:
                    Math.round((aggregatedRag.avgHallucinationRate - aggregatedNoRag.avgHallucinationRate) * 1000) /
                    1000,
                groundingScore:
                    Math.round((aggregatedRag.avgGroundingScore - aggregatedNoRag.avgGroundingScore) * 1000) / 1000,
                claimDensity:
                    Math.round((aggregatedRag.avgClaimDensity - aggregatedNoRag.avgClaimDensity) * 10000) / 10000,
                confidence: Math.round((aggregatedRag.avgConfidence - aggregatedNoRag.avgConfidence) * 1000) / 1000
            }
        };

        this.logger.log('\n=== Batch Experiment Complete ===');
        this.logger.log(`Processed ${results.length}/${numPapers} papers successfully`);
        this.logger.log(`Avg RAG Hallucination Rate: ${aggregatedRag.avgHallucinationRate}`);
        this.logger.log(`Avg NoRAG Hallucination Rate: ${aggregatedNoRag.avgHallucinationRate}`);
        this.logger.log(`Delta: ${aggregated.deltas.hallucinationRate} (negative Delta = RAG better)`);

        const batchExperimentResult = {
            experimentId,
            timestamp: new Date().toISOString(),
            totalPapers: results.length,
            results,
            aggregated
        };

        // Export to CSV
        const csvPath = this.csvExportService.exportBatchResultsToCsv(batchExperimentResult);
        this.logger.log(`Batch results exported to CSV: ${csvPath}`);

        return batchExperimentResult;
    }

    // Helper method to run the full analysis pipeline
    private async runAnalysisPipeline(
        paper: Paper,
        useRag: boolean
    ): Promise<{ review: string; claims: ClaimAnalysis[]; metrics: ReviewMetrics; claimStats: ClaimPipelineStats }> {
        // Generate review based on mode
        let review: string;
        if (useRag) {
            review = await this.ragService.generateReviewWithRag(paper);
        } else {
            review = await this.ragService.generateReviewWithoutRag(paper);
        }

        this.logger.log(`Review generated for ${useRag ? 'RAG' : 'noRAG'} (${review.split(/\s+/).length} words)`);

        // Extract claims
        const extractedClaims = await this.claimExtractionService.extractClaims(review);
        this.logger.log(`Extracted ${extractedClaims.claims.length} claims`);

        // Validate claims
        const validatedClaims = await this.claimValidationService.validateClaims(extractedClaims);

        // Only include claims that are valid OR have a corrected version
        const finalClaims = validatedClaims.validatedClaims
            .filter((c) => c.validation.isValid || c.validation.correctedText)
            .map((c) => ({
                text: c.validation.correctedText || c.text,
                category: c.category,
                wasValidated: c.validation.isValid,
                wasCorrected: !!c.validation.correctedText && !c.validation.isValid
            }));

        const correctedCount = finalClaims.filter((c) => c.wasCorrected).length;

        this.logger.log(
            `Validation: ${validatedClaims.validatedClaims.length} → ${finalClaims.length} claims ` +
                `(${correctedCount} corrected)`
        );

        // Run LLM Judge on final claims
        const claimTexts = finalClaims.map((c) => c.text);
        const judgeResults = await this.llmJudgeService.detectHallucination(claimTexts, paper);

        // Build claim analysis array
        const claims: ClaimAnalysis[] = finalClaims.map((claim, idx) => ({
            text: claim.text,
            category: claim.category,
            verdict: judgeResults[idx].verdict,
            confidence: judgeResults[idx].confidence,
            explanation: judgeResults[idx].explanation
        }));

        // Calculate metrics
        const metrics = this.metricsService.calculateMetrics(judgeResults, review);

        // Claim pipeline stats
        const claimStats: ClaimPipelineStats = {
            extractedCount: extractedClaims.claims.length,
            validatedCount: finalClaims.length,
            correctedCount
        };

        return { review, claims, metrics, claimStats };
    }

    //  ------------------------------------------------
    //  ######## Methods for testing purposes ##########
    //  ------------------------------------------------

    // Test claim extraction
    async testClaimExtraction(reviewText: string) {
        const extractedClaims = await this.claimExtractionService.extractClaims(reviewText);
        return {
            input: reviewText,
            claims: extractedClaims
        };
    }

    // Test NLI for hallucination detection
    async testNLI(paperId: string, claim: string) {
        const result = await this.nliService.detectHallucination(claim, paperId);
        return result;
    }

    // Test LLM Judge for hallucination detection
    async testLLMJudge(paperId: string, claim: string) {
        const paper = this.papers.find((p) => p.id === paperId)!;
        const result = await this.llmJudgeService.detectSingleHallucination(claim, paper);
        return result;
    }

    // Test Embedding Similarity for hallucination detection
    async testEmbeddingSimilarity(paperId: string, claim: string) {
        const result = await this.embeddingSimilarityService.detectHallucination(claim, paperId);
        return result;
    }

    // Compare all three hallucination detection methods on the same claim
    async compareAllHallucinationMethods(paperId: string, claim: string) {
        const paper = this.papers.find((p) => p.id === paperId)!;
        const [embeddingResult, nliResult, judgeResult] = await Promise.all([
            this.embeddingSimilarityService.detectHallucination(claim, paperId),
            this.nliService.detectHallucination(claim, paperId),
            this.llmJudgeService.detectSingleHallucination(claim, paper)
        ]);

        return {
            claim,
            paperId,
            methods: {
                embeddingSimilarity: {
                    verdict: embeddingResult.verdict,
                    score: embeddingResult.maxSimilarity,
                    isHallucination: embeddingResult.isHallucination
                },
                nli: {
                    verdict: nliResult.verdict,
                    scores: nliResult.scores,
                    isHallucination: nliResult.isHallucination
                },
                llmJudge: {
                    verdict: judgeResult.verdict,
                    confidence: judgeResult.confidence,
                    explanation: judgeResult.explanation,
                    isHallucination: judgeResult.isHallucination
                }
            },
            mostSimilarEvidence: embeddingResult.mostSimilarChunk
        };
    }

    // Test claim extraction and validation pipeline
    async runClaimsPipeline(index: string, useRag: boolean) {
        // Load papers if not loaded
        if (this.papers.length === 0) {
            this.logger.log('Loading papers...');
            this.papers = this.datasetLoaderService.loadPapers();
        }

        const i = parseInt(index, 10);
        if (i >= this.papers.length) {
            return { error: `Index ${i} out of range. Loaded ${this.papers.length} papers.` };
        }

        const paper = this.papers[i];

        // Generate review (with or without RAG)
        let generatedReview: string;
        if (useRag) {
            this.logger.log(`Indexing paper: ${paper.title}`);
            await this.ragService.indexPaper(paper);
            this.logger.log('Generating review with RAG...');
            generatedReview = await this.ragService.generateReviewWithRag(paper);
        } else {
            this.logger.log('Generating review without RAG...');
            generatedReview = await this.ragService.generateReviewWithoutRag(paper);
        }

        // Extract claims from the generated review
        this.logger.log('Extracting claims from review...');
        const extractedClaims = await this.claimExtractionService.extractClaims(generatedReview);
        this.logger.log(`Extracted ${extractedClaims.claims.length} claims`);

        // Validate the extracted claims
        this.logger.log('Validating extracted claims...');
        const validatedClaims = await this.claimValidationService.validateClaims(extractedClaims);
        const validCount = validatedClaims.validatedClaims.filter((c) => c.validation.isValid).length;
        this.logger.log(`Validation complete: ${validCount}/${validatedClaims.validatedClaims.length} valid claims`);

        return {
            paper: {
                title: paper.title,
                abstract: paper.abstract
            },
            pipeline: {
                useRag: useRag,
                generatedReview
            },
            claims: {
                extracted: extractedClaims.claims.length,
                validated: validatedClaims.validatedClaims,
                summary: {
                    total: validatedClaims.validatedClaims.length,
                    valid: validCount,
                    invalid: validatedClaims.validatedClaims.length - validCount
                }
            }
        };
    }
}
