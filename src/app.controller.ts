import { Controller, Get, Query, Body, Post } from '@nestjs/common';
import { PaperExperimentResult, BatchExperimentResult } from './experiment/types';
import { ExperimentService } from './experiment/experiment.service';
import { StatsService } from './experiment/stats.service';
@Controller()
export class AppController {
    constructor(
        private experimentService: ExperimentService,
        private statsService: StatsService
    ) {}

    // ##############################################################
    // --------------------- MAIN API ENDPOINTS ---------------------
    // ##############################################################

    // List loaded papers
    @Get('papers')
    listPapers() {
        return this.experimentService.getAllPapers();
    }

    // Run experiment on a single paper
    @Get('experiment/single')
    async runSingleExperiment(@Query('index') paperIndex: string = '0'): Promise<PaperExperimentResult> {
        return this.experimentService.runSingleExperiment(paperIndex);
    }

    // Run experiment on multiple papers
    @Get('experiment/batch')
    async runBatchExperiment(@Query('count') numberOfPapers: string = '3'): Promise<BatchExperimentResult> {
        return this.experimentService.runBatchExperiment(numberOfPapers);
    }
    // ##############################################################

    // ##############################################################
    // --------------------- TEST ENDPOINTS -------------------------
    // ##############################################################

    // Test claim extraction with review text
    @Post('claims/extract')
    async testClaimExtraction(@Body('review') reviewText?: string) {
        if (!reviewText) {
            return {
                error: 'Please provide review text via body'
            };
        }
        return this.experimentService.testClaimExtraction(reviewText);
    }

    // Test NLI on a single claim against a paper (Hallucination Detection)
    @Post('nli/test')
    async testNLI(@Query('paperId') paperId: string, @Body('claim') claim: string) {
        if (!claim || !paperId) {
            return {
                error: 'Please provide claim (body) and paperId (query param)'
            };
        }
        return this.experimentService.testNLI(paperId, claim);
    }

    // Test LLM Judge on a single claim against a paper (Hallucination Detection)
    @Post('judge/test')
    async testLLMJudge(@Query('paperId') paperId: string, @Body('claim') claim: string) {
        if (!claim || !paperId) {
            return {
                error: 'Please provide claim (body) and paperId (query param)'
            };
        }
        return this.experimentService.testLLMJudge(paperId, claim);
    }

    // Test Embedding Similarity on a single claim against a paper (Hallucination Detection)
    @Post('embedding/test')
    async testEmbeddingSimilarity(@Query('paperId') paperId: string, @Body('claim') claim: string) {
        if (!claim || !paperId) {
            return {
                error: 'Please provide claim (body) and paperId (query param)'
            };
        }
        return this.experimentService.testEmbeddingSimilarity(paperId, claim);
    }

    // Compare all three hallucination detection methods on the same claim
    @Post('compare/test')
    async compareAllMethods(@Query('paperId') paperId: string, @Body('claim') claim: string) {
        if (!claim || !paperId) {
            return {
                error: 'Please provide claim (body) and paperId (query param)'
            };
        }
        return this.experimentService.compareAllHallucinationMethods(paperId, claim);
    }

    // Test pipeline with claim extraction and validation
    @Get('pipeline/claims')
    async runClaimsPipeline(@Query('index') index: string = '0', @Query('useRag') useRag: boolean = true) {
        return this.experimentService.runClaimsPipeline(index, useRag);
    }

    @Get('stats/ttest')
    async pairedTTest() {
        return this.statsService.runPairedTTests();
    }
}
