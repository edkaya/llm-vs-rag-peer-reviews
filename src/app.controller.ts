import { Controller, Get, Query, Logger, Body, Post } from '@nestjs/common';
import { DatasetLoaderService } from './data/dataset-loader.service';
import { RagService } from './rag/rag.service';
import { ClaimExtractionService } from './claim/claim-extraction.service';
import { ClaimValidationService } from './claim/claim-validation.service';
import { NLIService } from './hallucination/nli.service';
import { Paper } from './data/types';

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);
    private papers: Paper[] = [];

    constructor(
        private datasetLoaderService: DatasetLoaderService,
        private ragService: RagService,
        private claimExtractionService: ClaimExtractionService,
        private claimValidationService: ClaimValidationService,
        private nliService: NLIService
    ) {}

    // Full pipeline: load → index → generate RAG review
    @Get('pipeline/rag')
    async runRagPipeline(@Query('index') index: string = '0') {
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

        return this.papers.map((p, i) => ({
            index: i,
            title: p.title,
            sections: p.sections.length,
            humanReviews: p.humanReviews.length
        }));
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
        const extractionPrompt = `You are an expert at analyzing academic peer reviews. Extract all verifiable claims from the following peer review.

For each claim:
- Break compound statements into atomic claims (one fact per claim)
- Identify the category: factual (about the paper content), methodological (about methods/approach), attribution (citing other work), or comparative (comparing to other work)
- Keep the original sentence for reference

Focus on claims that can be verified against the paper content. Skip purely subjective opinions like "the paper is well-written".`;

        const extractedClaims = await this.claimExtractionService.extractClaims(generatedReview, extractionPrompt);
        this.logger.log(`Extracted ${extractedClaims.claims.length} claims`);

        // 4. Validate the extracted claims
        this.logger.log('Validating extracted claims...');
        const validationPrompt = `You are an expert at evaluating the quality of extracted claims from peer reviews.

For each claim, assess:
1. Is it well-formed and verifiable? (not vague or subjective)
2. Is it truly atomic? (single fact, not compound)
3. Is the category correct?
4. Confidence score (0-1) based on quality

If a claim has issues, provide a corrected version when possible.`;

        const validatedClaims = await this.claimValidationService.validateClaims(extractedClaims, validationPrompt);

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

        const extractionPrompt = `You are an expert at analyzing academic peer reviews. Extract all verifiable claims from the following peer review.

For each claim:
- Break compound statements into atomic claims (one fact per claim)
- Identify the category: factual (about the paper content), methodological (about methods/approach), attribution (citing other work), or comparative (comparing to other work)
- Keep the original sentence for reference

Focus on claims that can be verified against the paper content.`;

        const extractedClaims = await this.claimExtractionService.extractClaims(reviewText, extractionPrompt);

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
        const extractionPrompt = `You are an expert at analyzing academic peer reviews. Extract all verifiable claims from the following peer review.

For each claim:
- Break compound statements into atomic claims (one fact per claim)
- Identify the category: factual (about the paper content), methodological (about methods/approach), attribution (citing other work), or comparative (comparing to other work)
- Keep the original sentence for reference

Focus on claims that can be verified against the paper content. Skip purely subjective opinions like "the paper is well-written".`;

        const extractedClaims = await this.claimExtractionService.extractClaims(generatedReview, extractionPrompt);
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
}
