import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v5 as uuidv5 } from 'uuid';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService } from '../embedding/vector-store.service';
import { ChunkingService } from '../data/chunking.service';
import { GenerationService } from '../generation/generation.service';
import { Paper } from '../data/types';
import { USER_PROMPTS, SYSTEM_PROMPTS } from '../shared/prompts';

// Namespace UUID for generating deterministic review chunk IDs
const REVIEW_CHUNK_NAMESPACE = '7ca7b810-9dad-11d1-80b4-00c04fd430c9';

@Injectable()
export class RagService {
    private readonly logger = new Logger(RagService.name);
    private topK: number;

    constructor(
        private configService: ConfigService,
        private embeddingService: EmbeddingService,
        private vectorStoreService: VectorStoreService,
        private chunkingService: ChunkingService,
        private generationService: GenerationService
    ) {
        this.topK = this.configService.get<number>('rag.topK', 5);
    }

    async indexPaper(paper: Paper): Promise<void> {
        this.logger.log(`Indexing paper: ${paper.title} (ID: ${paper.id})`);

        const existing = await this.vectorStoreService.countByPaperId(paper.id);
        if (existing > 0) {
            this.logger.log(`Paper ${paper.title} is already indexed with ${existing} chunks. Skipping indexing.`);
            return;
        }

        // Convert sections to format expected by chunking service
        const sectionsForChunking = paper.sections.map((s) => ({
            title: s.heading,
            content: s.content
        }));

        const chunks = this.chunkingService.chunkPaper(paper.id, sectionsForChunking);
        const texts = chunks.map((c) => c.text);

        // Embed all chunks
        const vectors = await this.embeddingService.embedChunks(texts);

        // Store in vector DB
        const points = chunks.map((chunk, i) => ({
            id: chunk.id,
            vector: vectors[i],
            payload: {
                paperId: chunk.paperId,
                text: chunk.text,
                section: chunk.section || '',
                index: chunk.index
            }
        }));

        await this.vectorStoreService.upsertBatch(points);
        this.logger.log(`Indexed ${chunks.length} chunks for paper ${paper.id}`);
    }

    async indexAllHumanReviews(papers: Paper[]): Promise<void> {
        const existingCount = await this.vectorStoreService.countHumanReviews();
        if (existingCount > 0) {
            this.logger.log(`Human reviews already indexed (${existingCount} reviews). Skipping.`);
            return;
        }

        this.logger.log(`Indexing human reviews from ${papers.length} papers...`);

        const allReviews: Array<{
            id: string;
            paperId: string;
            paperTitle: string;
            paperAbstract: string;
            reviewText: string;
        }> = [];

        // Store each complete review as one chunk (not split by section)
        for (const paper of papers) {
            if (paper.humanReviews.length === 0) continue;

            for (let reviewIdx = 0; reviewIdx < paper.humanReviews.length; reviewIdx++) {
                const review = paper.humanReviews[reviewIdx];

                // Combine all sections into one complete review
                const fullReviewText = [
                    review.paperSummary && `Summary: ${review.paperSummary}`,
                    review.strengths && `Strengths: ${review.strengths}`,
                    review.weaknesses && `Weaknesses: ${review.weaknesses}`,
                    review.comments && `Comments: ${review.comments}`
                ]
                    .filter(Boolean)
                    .join('\n\n');

                if (fullReviewText.trim()) {
                    allReviews.push({
                        id: uuidv5(`${paper.id}_review_${reviewIdx}`, REVIEW_CHUNK_NAMESPACE),
                        paperId: paper.id,
                        paperTitle: paper.title,
                        paperAbstract: paper.abstract,
                        reviewText: `[Reviewer ${reviewIdx + 1}]\n${fullReviewText}`
                    });
                }
            }
        }

        this.logger.log(`Created ${allReviews.length} complete reviews. Embedding abstracts...`);

        // Embed paper abstracts (not review text!) - this is what we search against
        const abstracts = allReviews.map((r) => r.paperAbstract);
        const vectors = await this.embeddingService.embedChunks(abstracts);

        // Store in human_reviews collection
        const points = allReviews.map((review, i) => ({
            id: review.id,
            vector: vectors[i],
            payload: {
                paperId: review.paperId,
                paperTitle: review.paperTitle,
                paperAbstract: review.paperAbstract,
                reviewText: review.reviewText
            }
        }));

        await this.vectorStoreService.upsertHumanReviewsBatch(points);
        this.logger.log(`Indexed ${allReviews.length} complete human reviews from ${papers.length} papers`);
    }

    // Retrieve reviews from SIMILAR papers (excluding the target paper)
    async retrieveCrossPaperReviewContext(paper: Paper): Promise<string> {
        // Embed the target paper's abstract to find similar papers
        const queryVector = await this.embeddingService.embedChunk(paper.abstract);

        try {
            // Search human_reviews collection, excluding this paper's reviews
            const results = await this.vectorStoreService.searchHumanReviewsExcluding(queryVector, paper.id, this.topK);

            if (results.length === 0) {
                this.logger.warn(`No cross-paper reviews found for paper ${paper.id}`);
                return '';
            }

            // Format retrieved reviews with source paper info and abstract
            const formattedReviews = results.map(
                (r) => `[From similar paper: "${r.paperTitle}"]\nAbstract: ${r.paperAbstract}\n\n${r.reviewText}`
            );

            // Deduplicate and join
            const uniqueReviews = [...new Set(formattedReviews)];
            return uniqueReviews.join('\n\n---\n\n');
        } catch (error) {
            this.logger.error(`Error retrieving cross-paper reviews for paper ${paper.id}: ${error}`);
            return 'No cross-paper review context available.';
        }
    }

    async generateReviewWithRag(paper: Paper): Promise<string> {
        const crossPaperContext = await this.retrieveCrossPaperReviewContext(paper);
        const userPrompt = USER_PROMPTS.reviewWithRag({
            title: paper.title,
            abstract: paper.abstract,
            fullText: paper.fullText,
            crossPaperContext
        });
        const systemPrompt = SYSTEM_PROMPTS.reviewGenerator;
        return this.generationService.generate(userPrompt, systemPrompt);
    }

    async generateReviewWithoutRag(paper: Paper): Promise<string> {
        const userPrompt = USER_PROMPTS.reviewWithoutRag({
            title: paper.title,
            abstract: paper.abstract,
            fullText: paper.fullText
        });
        const systemPrompt = SYSTEM_PROMPTS.reviewGenerator;
        return this.generationService.generate(userPrompt, systemPrompt);
    }
}
