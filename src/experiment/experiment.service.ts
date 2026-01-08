import { Injectable, Logger } from '@nestjs/common';
import {
    PaperExperimentResult,
    ClaimAnalysis,
    BatchExperimentResult,
    ClaimPipelineStats,
    ReviewAnalysis
} from './types';
import { Paper } from '../data/types';
import { DatasetLoaderService } from 'src/data/dataset-loader.service';
import { RagService } from 'src/rag/rag.service';
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

        // Compare metrics for both detection methods
        const llmJudgeComparison = this.metricsService.compareMetrics(
            ragAnalysis.llmJudgeMetrics,
            noRagAnalysis.llmJudgeMetrics
        );
        const nliComparison = this.metricsService.compareMetrics(ragAnalysis.nliMetrics, noRagAnalysis.nliMetrics);

        this.logger.log('Experiment complete!');
        this.logger.log('=== LLM Judge Results ===');
        this.logger.log(`RAG Hallucination Rate: ${ragAnalysis.llmJudgeMetrics.hallucinationRate}`);
        this.logger.log(`NoRAG Hallucination Rate: ${noRagAnalysis.llmJudgeMetrics.hallucinationRate}`);
        this.logger.log(`Delta: ${llmJudgeComparison.hallucinationDelta} (negative = RAG better)`);
        this.logger.log('=== NLI Results ===');
        this.logger.log(`RAG Hallucination Rate: ${ragAnalysis.nliMetrics.hallucinationRate}`);
        this.logger.log(`NoRAG Hallucination Rate: ${noRagAnalysis.nliMetrics.hallucinationRate}`);
        this.logger.log(`Delta: ${nliComparison.hallucinationDelta} (negative = RAG better)`);

        const result: PaperExperimentResult = {
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
            comparison: {
                llmJudge: llmJudgeComparison,
                nli: nliComparison
            }
        };

        // Export to CSV
        const csvPath = this.csvExportService.exportSingleResultToCsv(result);
        this.logger.log(`Single experiment result exported to CSV: ${csvPath}`);

        return result;
    }

    async runBatchExperiment(count: string): Promise<BatchExperimentResult> {
        const numPapers = Math.min(parseInt(count, 10), 75);
        this.logger.log(`Preparing to run batch experiment on ${numPapers} papers...`);

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

                // Compare metrics for both detection methods
                const llmJudgeComparison = this.metricsService.compareMetrics(
                    ragAnalysis.llmJudgeMetrics,
                    noRagAnalysis.llmJudgeMetrics
                );
                const nliComparison = this.metricsService.compareMetrics(
                    ragAnalysis.nliMetrics,
                    noRagAnalysis.nliMetrics
                );

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
                    comparison: {
                        llmJudge: llmJudgeComparison,
                        nli: nliComparison
                    }
                });

                this.logger.log(
                    `Paper ${i + 1} complete: LLM-Judge RAG=${ragAnalysis.llmJudgeMetrics.hallucinationRate}, NoRAG=${noRagAnalysis.llmJudgeMetrics.hallucinationRate}`
                );
            } catch (error) {
                this.logger.error(`Failed to process paper ${i}: ${error}`);
                // Continue with next paper
            }
        }

        // Aggregate metrics across all papers for both detection methods
        // LLM Judge metrics
        const llmJudgeRagMetrics = results.map((r) => r.rag.llmJudgeMetrics);
        const llmJudgeNoRagMetrics = results.map((r) => r.noRag.llmJudgeMetrics);
        const aggregatedLlmJudgeRag = this.metricsService.aggregateMetrics(llmJudgeRagMetrics);
        const aggregatedLlmJudgeNoRag = this.metricsService.aggregateMetrics(llmJudgeNoRagMetrics);

        // NLI metrics
        const nliRagMetrics = results.map((r) => r.rag.nliMetrics);
        const nliNoRagMetrics = results.map((r) => r.noRag.nliMetrics);
        const aggregatedNliRag = this.metricsService.aggregateMetrics(nliRagMetrics);
        const aggregatedNliNoRag = this.metricsService.aggregateMetrics(nliNoRagMetrics);

        const round = (v: number, d = 3) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

        const aggregated = {
            llmJudge: {
                rag: aggregatedLlmJudgeRag,
                noRag: aggregatedLlmJudgeNoRag,
                deltas: {
                    hallucinationRate: round(
                        aggregatedLlmJudgeRag.avgHallucinationRate - aggregatedLlmJudgeNoRag.avgHallucinationRate
                    ),
                    groundingScore: round(
                        aggregatedLlmJudgeRag.avgGroundingScore - aggregatedLlmJudgeNoRag.avgGroundingScore
                    ),
                    claimDensity: round(
                        aggregatedLlmJudgeRag.avgClaimDensity - aggregatedLlmJudgeNoRag.avgClaimDensity,
                        4
                    ),
                    confidence: round(aggregatedLlmJudgeRag.avgConfidence - aggregatedLlmJudgeNoRag.avgConfidence)
                }
            },
            nli: {
                rag: aggregatedNliRag,
                noRag: aggregatedNliNoRag,
                deltas: {
                    hallucinationRate: round(
                        aggregatedNliRag.avgHallucinationRate - aggregatedNliNoRag.avgHallucinationRate
                    ),
                    groundingScore: round(aggregatedNliRag.avgGroundingScore - aggregatedNliNoRag.avgGroundingScore),
                    claimDensity: round(aggregatedNliRag.avgClaimDensity - aggregatedNliNoRag.avgClaimDensity, 4),
                    confidence: round(aggregatedNliRag.avgConfidence - aggregatedNliNoRag.avgConfidence)
                }
            }
        };

        this.logger.log('\n=== Batch Experiment Complete ===');
        this.logger.log(`Processed ${results.length}/${numPapers} papers successfully`);
        this.logger.log('=== LLM Judge Aggregated ===');
        this.logger.log(`Avg RAG Hallucination Rate: ${aggregatedLlmJudgeRag.avgHallucinationRate}`);
        this.logger.log(`Avg NoRAG Hallucination Rate: ${aggregatedLlmJudgeNoRag.avgHallucinationRate}`);
        this.logger.log(`Delta: ${aggregated.llmJudge.deltas.hallucinationRate} (negative = RAG better)`);
        this.logger.log('=== NLI Aggregated ===');
        this.logger.log(`Avg RAG Hallucination Rate: ${aggregatedNliRag.avgHallucinationRate}`);
        this.logger.log(`Avg NoRAG Hallucination Rate: ${aggregatedNliNoRag.avgHallucinationRate}`);
        this.logger.log(`Delta: ${aggregated.nli.deltas.hallucinationRate} (negative = RAG better)`);

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

    // Helper method to run the full analysis pipeline with dual detection
    private async runAnalysisPipeline(paper: Paper, useRag: boolean): Promise<ReviewAnalysis> {
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

        // Run BOTH hallucination detectors on the same claims
        const claimTexts = finalClaims.map((c) => c.text);

        // Run LLM Judge
        this.logger.log('Running LLM Judge hallucination detection...');
        const judgeResults = await this.llmJudgeService.detectHallucination(claimTexts, paper.id);

        // Run NLI
        this.logger.log('Running NLI hallucination detection...');
        const nliResults = await this.nliService.detectHallucinationsBatch(claimTexts, paper.id);

        // Build claim analysis array with both detection results
        const claims: ClaimAnalysis[] = finalClaims.map((claim, idx) => ({
            text: claim.text,
            category: claim.category,
            llmJudge: {
                verdict: judgeResults[idx].verdict,
                confidence: judgeResults[idx].confidence,
                explanation: judgeResults[idx].explanation
            },
            nli: {
                verdict: nliResults[idx].verdict,
                scores: nliResults[idx].scores
            }
        }));

        // Calculate metrics for both detection methods
        const llmJudgeMetrics = this.metricsService.calculateMetrics(judgeResults, review);
        const nliMetrics = this.metricsService.calculateMetricsFromNLI(nliResults, review);

        this.logger.log(
            `LLM Judge: hallucination=${llmJudgeMetrics.hallucinationRate}, grounding=${llmJudgeMetrics.groundingScore}`
        );
        this.logger.log(`NLI: hallucination=${nliMetrics.hallucinationRate}, grounding=${nliMetrics.groundingScore}`);

        // Claim pipeline stats
        const claimStats: ClaimPipelineStats = {
            extractedCount: extractedClaims.claims.length,
            validatedCount: finalClaims.length,
            correctedCount
        };

        return { review, claims, llmJudgeMetrics, nliMetrics, claimStats };
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
        // const paper = this.papers.find((p) => p.id === paperId)!;
        const result = await this.llmJudgeService.detectSingleHallucination(claim, paperId);
        return result;
    }

    // Test Embedding Similarity for hallucination detection
    async testEmbeddingSimilarity(paperId: string, claim: string) {
        const result = await this.embeddingSimilarityService.detectHallucination(claim, paperId);
        return result;
    }

    // Compare all three hallucination detection methods on the same claim
    async compareAllHallucinationMethods(paperId: string, claim: string) {
        // const paper = this.papers.find((p) => p.id === paperId)!;
        const [embeddingResult, nliResult, judgeResult] = await Promise.all([
            this.embeddingSimilarityService.detectHallucination(claim, paperId),
            this.nliService.detectHallucination(claim, paperId),
            this.llmJudgeService.detectSingleHallucination(claim, paperId)
        ]);

        return {
            claim: claim,
            paperId: paperId,
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
