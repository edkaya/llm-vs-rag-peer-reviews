import { Controller, Get, Query, Logger } from '@nestjs/common';
import { DatasetLoaderService } from './data/dataset-loader.service';
import { RagService } from './rag/rag.service';
import { Paper } from './data/types';

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);
    private papers: Paper[] = [];

    constructor(
        private datasetLoaderService: DatasetLoaderService,
        private ragService: RagService
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
}
