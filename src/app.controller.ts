import { Controller, Get, Query, Logger, Body, Post } from '@nestjs/common';
import { DatasetLoaderService } from './data/dataset-loader.service';
import { RagService } from './rag/rag.service';
import { ClaimExtractionService } from './claim/claim-extraction.service';
import { ClaimValidationService } from './claim/claim-validation.service';
import { NLIService } from './hallucination/nli.service';
import { LLMJudgeService } from './hallucination/llm-judge.service';
import { EmbeddingSimilarityService } from './hallucination/embedding-similarity.service';
import { MetricsService } from './evaluation/metrics.service';
import { Paper } from './data/types';
import { PaperExperimentResult, ClaimAnalysis, ReviewMetrics } from './evaluation/types';

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);
    private papers: Paper[] = [];

    constructor(
        private datasetLoaderService: DatasetLoaderService,
        private ragService: RagService,
        private claimExtractionService: ClaimExtractionService,
        private claimValidationService: ClaimValidationService,
        private nliService: NLIService,
        private llmJudgeService: LLMJudgeService,
        private embeddingSimilarityService: EmbeddingSimilarityService,
        private metricsService: MetricsService
    ) {}

    // Full pipeline: load → index → generate RAG review
    @Get('pipeline/rag')
    async runRagPipeline(@Query('index') index: string = '0') {
        // 1. Load papers if not loaded
        if (this.papers.length === 0) {
            this.logger.log('Loading papers...');
            this.papers = this.datasetLoaderService.loadPapers();
        }
        this.logger.log('Indexing all human reviews for cross-paper RAG...');
        await this.ragService.indexAllHumanReviews(this.papers);
        this.logger.log('Human reviews indexing complete.');

        const i = parseInt(index, 10);
        if (i >= this.papers.length) {
            return { error: `Index ${i} out of range. Loaded ${this.papers.length} papers.` };
        }

        const paper = this.papers[i];

        // 2. Index the paper
        this.logger.log(`Indexing paper: ${paper.title}`);
        await this.ragService.indexPaper(paper);

        // 3. Generate review with RAG
        this.logger.log('Generating review with RAG...');
        const generatedReview = await this.ragService.generateReviewWithRag(paper);
        this.logger.log('Review generation complete with RAG.');
        return {
            title: paper.title,
            abstract: paper.abstract,
            generatedReview,
            humanReviews: paper.humanReviews
        };
    }

    // Full pipeline: load → generate review WITHOUT RAG
    @Get('pipeline/no-rag')
    async runNoRagPipeline(@Query('index') index: string = '0') {
        // 1. Load papers if not loaded
        if (this.papers.length === 0) {
            this.logger.log('Loading papers...');
            this.papers = this.datasetLoaderService.loadPapers();
        }

        const i = parseInt(index, 10);
        if (i >= this.papers.length) {
            return { error: `Index ${i} out of range. Loaded ${this.papers.length} papers.` };
        }

        const paper = this.papers[i];

        // 2. Generate review without RAG (full paper in context)
        this.logger.log('Generating review without RAG...');
        const generatedReview = await this.ragService.generateReviewWithoutRag(paper);

        return {
            title: paper.title,
            abstract: paper.abstract,
            generatedReview,
            humanReviews: paper.humanReviews
        };
    }

    // List loaded papers
    @Get('papers')
    listPapers() {
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

    // Full pipeline with claims: generate review → extract claims → validate claims
    @Get('pipeline/claims')
    async runClaimsPipeline(@Query('index') index: string = '0', @Query('useRag') useRag: string = 'true') {
        // 1. Load papers if not loaded
        if (this.papers.length === 0) {
            this.logger.log('Loading papers...');
            this.papers = this.datasetLoaderService.loadPapers();
        }

        const i = parseInt(index, 10);
        if (i >= this.papers.length) {
            return { error: `Index ${i} out of range. Loaded ${this.papers.length} papers.` };
        }

        const paper = this.papers[i];
        const withRag = useRag === 'true';

        // 2. Generate review (with or without RAG)
        let generatedReview: string;
        if (withRag) {
            this.logger.log(`Indexing paper: ${paper.title}`);
            await this.ragService.indexPaper(paper);
            this.logger.log('Generating review with RAG...');
            generatedReview = await this.ragService.generateReviewWithRag(paper);
        } else {
            this.logger.log('Generating review without RAG...');
            generatedReview = await this.ragService.generateReviewWithoutRag(paper);
        }

        // 3. Extract claims from the generated review
        this.logger.log('Extracting claims from review...');
        const extractedClaims = await this.claimExtractionService.extractClaims(generatedReview);
        this.logger.log(`Extracted ${extractedClaims.claims.length} claims`);

        // 4. Validate the extracted claims
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
                useRag: withRag,
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

    // Test claim extraction only (with custom review text)
    @Post('claims/extract')
    async testClaimExtraction(@Body('review') reviewText?: string) {
        if (!reviewText) {
            return {
                error: 'Please provide review text via ?review=...',
                example: '/claims/extract?review=The paper presents a novel approach to NLP.'
            };
        }

        const extractedClaims = await this.claimExtractionService.extractClaims(reviewText);

        return {
            input: reviewText,
            claims: extractedClaims
        };
    }

    // Full pipeline with hallucination detection
    @Get('pipeline/hallucination')
    async runHallucinationPipeline(@Query('index') index: string = '0', @Query('useRag') useRag: string = 'true') {
        // 1. Load papers if not loaded
        if (this.papers.length === 0) {
            this.logger.log('Loading papers...');
            this.papers = this.datasetLoaderService.loadPapers();
        }

        const i = parseInt(index, 10);
        if (i >= this.papers.length) {
            return { error: `Index ${i} out of range. Loaded ${this.papers.length} papers.` };
        }

        const paper = this.papers[i];
        const withRag = useRag === 'true';

        // 2. Index the paper (needed for both RAG generation and NLI verification)
        this.logger.log(`Indexing paper: ${paper.title}`);
        await this.ragService.indexPaper(paper);

        // 3. Generate review (with or without RAG)
        let generatedReview: string;
        if (withRag) {
            this.logger.log('Generating review with RAG...');
            generatedReview = await this.ragService.generateReviewWithRag(paper);
        } else {
            this.logger.log('Generating review without RAG...');
            generatedReview = await this.ragService.generateReviewWithoutRag(paper);
        }

        // 4. Extract claims from the generated review
        this.logger.log('Extracting claims from review...');
        const extractedClaims = await this.claimExtractionService.extractClaims(generatedReview);
        this.logger.log(`Extracted ${extractedClaims.claims.length} claims`);

        // 5. Run NLI-based hallucination detection on each claim
        this.logger.log('Running hallucination detection via NLI...');
        const claimTexts = extractedClaims.claims.map((c) => c.text);
        const nliResults = await this.nliService.detectHallucinationsBatch(claimTexts, paper.id);

        // 6. Calculate summary statistics
        const supported = nliResults.filter((r) => r.verdict === 'SUPPORTED').length;
        const contradicted = nliResults.filter((r) => r.verdict === 'CONTRADICTED').length;
        const unverifiable = nliResults.filter((r) => r.verdict === 'UNVERIFIABLE').length;
        const hallucinationRate = (contradicted + unverifiable) / nliResults.length;

        this.logger.log(
            `Hallucination detection complete: ${supported} supported, ${contradicted} contradicted, ${unverifiable} unverifiable`
        );

        return {
            paper: {
                id: paper.id,
                title: paper.title,
                abstract: paper.abstract
            },
            pipeline: {
                useRag: withRag,
                generatedReview
            },
            claims: extractedClaims.claims.map((claim, idx) => ({
                ...claim,
                nli: nliResults[idx]
            })),
            summary: {
                totalClaims: nliResults.length,
                supported,
                contradicted,
                unverifiable,
                hallucinationRate: Math.round(hallucinationRate * 100) / 100
            }
        };
    }

    // Test NLI on a single claim against a paper
    @Post('nli/test')
    async testNLI(@Body('claim') claim: string, @Query('paperId') paperId: string) {
        if (!claim || !paperId) {
            return {
                error: 'Please provide claim and paperId query parameters',
                example: '/nli/test?claim=The paper uses transformer architecture&paperId=abc123'
            };
        }

        const result = await this.nliService.detectHallucination(claim, paperId);
        return result;
    }

    // Test LLM Judge on a single claim against a paper
    @Post('judge/test')
    async testLLMJudge(@Body('claim') claim: string, @Query('paperId') paperId: string) {
        if (!claim || !paperId) {
            return {
                error: 'Please provide claim in body and paperId query parameter',
                example: 'POST /judge/test?paperId=abc123 with body {"claim": "..."}'
            };
        }

        const result = await this.llmJudgeService.detectSingleHallucination(claim, paperId);
        return result;
    }

    // Full pipeline with LLM Judge hallucination detection
    @Get('pipeline/judge')
    async runJudgePipeline(@Query('index') index: string = '0', @Query('useRag') useRag: string = 'true') {
        // 1. Load papers if not loaded
        if (this.papers.length === 0) {
            this.logger.log('Loading papers...');
            this.papers = this.datasetLoaderService.loadPapers();
        }

        const i = parseInt(index, 10);
        if (i >= this.papers.length) {
            return { error: `Index ${i} out of range. Loaded ${this.papers.length} papers.` };
        }

        const paper = this.papers[i];
        const withRag = useRag === 'true';

        // 2. Index the paper (needed for both RAG generation and evidence retrieval)
        this.logger.log(`Indexing paper: ${paper.title}`);
        await this.ragService.indexPaper(paper);

        // 3. Generate review (with or without RAG)
        let generatedReview: string;
        if (withRag) {
            this.logger.log('Generating review with RAG...');
            generatedReview = await this.ragService.generateReviewWithRag(paper);
        } else {
            this.logger.log('Generating review without RAG...');
            generatedReview = await this.ragService.generateReviewWithoutRag(paper);
        }

        // 4. Extract claims from the generated review
        this.logger.log('Extracting claims from review...');
        const extractedClaims = await this.claimExtractionService.extractClaims(generatedReview);
        this.logger.log(`Extracted ${extractedClaims.claims.length} claims`);

        // 5. Run LLM Judge hallucination detection on each claim
        this.logger.log('Running hallucination detection via LLM Judge...');
        const claimTexts = extractedClaims.claims.map((c) => c.text);
        const judgeResults = await this.llmJudgeService.detectHallucination(claimTexts, paper.id);

        // 6. Calculate summary statistics
        const supported = judgeResults.filter((r) => r.verdict === 'SUPPORTED').length;
        const partiallySupported = judgeResults.filter((r) => r.verdict === 'PARTIALLY_SUPPORTED').length;
        const notSupported = judgeResults.filter((r) => r.verdict === 'NOT_SUPPORTED').length;
        const contradicted = judgeResults.filter((r) => r.verdict === 'CONTRADICTED').length;
        const hallucinationRate = (notSupported + contradicted) / judgeResults.length;

        this.logger.log(
            `LLM Judge complete: ${supported} supported, ${partiallySupported} partial, ${notSupported} not supported, ${contradicted} contradicted`
        );

        return {
            paper: {
                id: paper.id,
                title: paper.title,
                abstract: paper.abstract
            },
            pipeline: {
                useRag: withRag,
                generatedReview
            },
            claims: extractedClaims.claims.map((claim, idx) => ({
                ...claim,
                judge: judgeResults[idx]
            })),
            summary: {
                totalClaims: judgeResults.length,
                supported,
                partiallySupported,
                notSupported,
                contradicted,
                hallucinationRate: Math.round(hallucinationRate * 100) / 100
            }
        };
    }

    // Test Embedding Similarity on a single claim against a paper
    @Post('embedding/test')
    async testEmbeddingSimilarity(@Body('claim') claim: string, @Query('paperId') paperId: string) {
        if (!claim || !paperId) {
            return {
                error: 'Please provide claim in body and paperId query parameter',
                example: 'POST /embedding/test?paperId=abc123 with body {"claim": "..."}'
            };
        }

        const result = await this.embeddingSimilarityService.detectHallucination(claim, paperId);
        return result;
    }

    // Compare all three hallucination detection methods on the same claim
    @Post('compare/test')
    async compareAllMethods(@Body('claim') claim: string, @Query('paperId') paperId: string) {
        if (!claim || !paperId) {
            return {
                error: 'Please provide claim in body and paperId query parameter',
                example: 'POST /compare/test?paperId=abc123 with body {"claim": "..."}'
            };
        }

        const [embeddingResult, nliResult, judgeResult] = await Promise.all([
            this.embeddingSimilarityService.detectHallucination(claim, paperId),
            this.nliService.detectHallucination(claim, paperId),
            this.llmJudgeService.detectSingleHallucination(claim, paperId)
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

    // Run full experiment on a single paper: Cross-Paper RAG vs NoRAG with metrics
    @Get('experiment/single')
    async runSingleExperiment(@Query('index') index: string = '0'): Promise<PaperExperimentResult> {
        // 1. Load papers and index all human reviews (once)
        if (this.papers.length === 0) {
            this.logger.log('Loading papers...');
            this.papers = this.datasetLoaderService.loadPapers();
        }

        const i = parseInt(index, 10);
        if (i >= this.papers.length) {
            throw new Error(`Index ${i} out of range. Loaded ${this.papers.length} papers.`);
        }
        // Index all human reviews for cross-paper RAG (one-time)
        this.logger.log('Indexing all human reviews for cross-paper RAG...');
        await this.ragService.indexAllHumanReviews(this.papers);

        const paper = this.papers[i];
        this.logger.log(`Starting experiment for paper: ${paper.title}`);

        // 2. Index the paper (needed for hallucination detection)
        this.logger.log('Indexing paper...');
        await this.ragService.indexPaper(paper);

        // 3. Run Cross-Paper RAG pipeline
        this.logger.log('=== Running Cross-Paper RAG Pipeline ===');
        const ragAnalysis = await this.runAnalysisPipeline(paper, true);

        // 4. Run NoRAG pipeline
        this.logger.log('=== Running NoRAG Pipeline ===');
        const noRagAnalysis = await this.runAnalysisPipeline(paper, false);

        // 5. Compare metrics
        const comparison = this.metricsService.compareMetrics(ragAnalysis.metrics, noRagAnalysis.metrics);

        this.logger.log('Experiment complete!');
        this.logger.log(`RAG Hallucination Rate: ${ragAnalysis.metrics.hallucinationRate}`);
        this.logger.log(`NoRAG Hallucination Rate: ${noRagAnalysis.metrics.hallucinationRate}`);
        this.logger.log(`Delta: ${comparison.hallucinationDelta} (negative = RAG better)`);

        return {
            paperId: paper.id,
            paperTitle: paper.title,
            timestamp: new Date().toISOString(),
            rag: ragAnalysis,
            noRag: noRagAnalysis,
            humanReviews: paper.humanReviews.map(
                (r) =>
                    `**Summary:** ${r.paperSummary}\n\n**Strengths:** ${r.strengths}\n\n**Weaknesses:** ${r.weaknesses}\n\n**Comments:** ${r.comments}`
            ),
            comparison
        };
    }

    // Helper method to run the full analysis pipeline for a single mode
    private async runAnalysisPipeline(
        paper: Paper,
        useRag: boolean
    ): Promise<{ review: string; claims: ClaimAnalysis[]; metrics: ReviewMetrics }> {
        // 1. Generate review based on mode
        let review: string;
        if (useRag) {
            review = await this.ragService.generateReviewWithRag(paper);
        } else {
            review = await this.ragService.generateReviewWithoutRag(paper);
        }

        this.logger.log(`Generated review (${review.split(/\s+/).length} words)`);

        // 2. Extract claims
        const extractedClaims = await this.claimExtractionService.extractClaims(review);
        this.logger.log(`Extracted ${extractedClaims.claims.length} claims`);

        // 3. Validate claims (filter invalid, use corrected text where available)
        const validatedClaims = await this.claimValidationService.validateClaims(extractedClaims);

        // Build list of claim texts: use correctedText if available, otherwise original text
        // Only include claims that are valid OR have a corrected version
        const processedClaims = validatedClaims.validatedClaims
            .filter((c) => c.validation.isValid || c.validation.correctedText)
            .map((c) => ({
                text: c.validation.correctedText || c.text,
                category: c.category,
                wasValidated: c.validation.isValid,
                wasCorrected: !!c.validation.correctedText && !c.validation.isValid
            }));

        this.logger.log(
            `Validation: ${validatedClaims.validatedClaims.length} → ${processedClaims.length} claims ` +
                `(${processedClaims.filter((c) => c.wasCorrected).length} corrected)`
        );

        // 4. Run LLM Judge on validated/corrected claims
        const claimTexts = processedClaims.map((c) => c.text);
        const judgeResults = await this.llmJudgeService.detectHallucination(claimTexts, paper.id);

        // 5. Build claim analysis array
        const claims: ClaimAnalysis[] = processedClaims.map((claim, idx) => ({
            text: claim.text,
            category: claim.category,
            verdict: judgeResults[idx].verdict,
            confidence: judgeResults[idx].confidence,
            explanation: judgeResults[idx].explanation
        }));

        // 6. Calculate metrics
        const metrics = this.metricsService.calculateMetrics(judgeResults, review);

        return { review, claims, metrics };
    }
}
