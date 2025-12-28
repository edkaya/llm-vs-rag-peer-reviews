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
        this.logger.log(`Indexing paper: ${paper.id}`);

        const existing = await this.vectorStoreService.countByPaperId(paper.id);
        if (existing > 0) {
            this.logger.log(`Paper ${paper.id} is already indexed with ${existing} chunks. Skipping indexing.`);
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
            this.logger.log(`Human reviews already indexed (${existingCount} chunks). Skipping.`);
            return;
        }

        this.logger.log(`Indexing human reviews from ${papers.length} papers...`);

        const allChunks: Array<{
            id: string;
            paperId: string;
            paperTitle: string;
            paperAbstract: string;
            reviewText: string;
            section: string;
        }> = [];

        // Create chunks from all papers
        for (const paper of papers) {
            if (paper.humanReviews.length === 0) continue;

            for (let reviewIdx = 0; reviewIdx < paper.humanReviews.length; reviewIdx++) {
                const review = paper.humanReviews[reviewIdx];
                const reviewPrefix = `[Reviewer ${reviewIdx + 1}]`;

                const sections = [
                    { name: 'Summary', content: review.paperSummary },
                    { name: 'Strengths', content: review.strengths },
                    { name: 'Weaknesses', content: review.weaknesses },
                    { name: 'Comments', content: review.comments }
                ];

                for (const section of sections) {
                    if (section.content && section.content.trim()) {
                        const chunkIdSource = `${paper.id}_r${reviewIdx}_${section.name.toLowerCase()}`;
                        allChunks.push({
                            id: uuidv5(chunkIdSource, REVIEW_CHUNK_NAMESPACE),
                            paperId: paper.id,
                            paperTitle: paper.title,
                            paperAbstract: paper.abstract,
                            reviewText: `${reviewPrefix} ${section.name}: ${section.content}`,
                            section: section.name.toLowerCase()
                        });
                    }
                }
            }
        }

        this.logger.log(`Created ${allChunks.length} review chunks. Embedding abstracts...`);

        // Embed paper abstracts (not review text!) - this is what we search against
        const abstracts = allChunks.map((c) => c.paperAbstract);
        const vectors = await this.embeddingService.embedChunks(abstracts);

        // Store in human_reviews collection
        const points = allChunks.map((chunk, i) => ({
            id: chunk.id,
            vector: vectors[i],
            payload: {
                paperId: chunk.paperId,
                paperTitle: chunk.paperTitle,
                reviewText: chunk.reviewText,
                section: chunk.section
            }
        }));

        await this.vectorStoreService.upsertHumanReviewsBatch(points);
        this.logger.log(`Indexed ${allChunks.length} human review chunks from ${papers.length} papers`);
    }

    // Retrieve reviews from SIMILAR papers (excluding the target paper)
    async retrieveCrossPaperReviewContext(paper: Paper): Promise<string> {
        // Embed the target paper's abstract to find similar papers
        const queryVector = await this.embeddingService.embedChunk(paper.abstract);

        // Search human_reviews collection, excluding this paper's reviews
        const results = await this.vectorStoreService.searchHumanReviewsExcluding(queryVector, paper.id, this.topK);

        if (results.length === 0) {
            this.logger.warn(`No cross-paper reviews found for paper ${paper.id}`);
            return '';
        }

        // Format retrieved reviews with source paper info
        const formattedReviews = results.map((r) => `[From similar paper: "${r.paperTitle}"]\n${r.reviewText}`);

        // Deduplicate and join
        const uniqueReviews = [...new Set(formattedReviews)];
        return uniqueReviews.join('\n\n---\n\n');
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
