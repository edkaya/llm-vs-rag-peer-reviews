import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService } from '../embedding/vector-store.service';
import { ChunkingService } from '../data/chunking.service';
import { GenerationService } from '../generation/generation.service';
import { Paper } from '../data/types';
import { SYSTEM_PROMPTS } from '../generation/prompts';

const RETRIEVAL_QUERIES = [
    'main contributions and novelty of this research',
    'methodology and experimental setup',
    'results, findings and evaluation',
    'limitations and weaknesses'
];

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

    async retrieveContext(paperId: string): Promise<string> {
        const allChunks: string[] = [];

        for (const query of RETRIEVAL_QUERIES) {
            const queryVector = await this.embeddingService.embedChunk(query);
            const results = await this.vectorStoreService.search(queryVector, paperId, this.topK);
            const chunkTexts = results.map((r) => r.content);
            allChunks.push(...chunkTexts);
        }

        // Deduplicate while preserving order
        const uniqueChunks = [...new Set(allChunks)];
        return uniqueChunks.join('\n\n---\n\n');
    }

    async generateReviewWithRag(paper: Paper): Promise<string> {
        const context = await this.retrieveContext(paper.id);

        const prompt = `Review the following research paper based on these key excerpts from the paper:

=== KEY EXCERPTS ===
${context}

=== PAPER INFORMATION ===
TITLE: ${paper.title}

ABSTRACT: ${paper.abstract}

Please provide a comprehensive peer review covering:
1. Summary of the paper
2. Strengths
3. Weaknesses
4. Detailed comments and suggestions`;

        return this.generationService.generate(prompt, SYSTEM_PROMPTS.reviewer);
    }

    async generateReviewWithoutRag(paper: Paper): Promise<string> {
        const prompt = `Review the following research paper:

=== PAPER INFORMATION ===
TITLE: ${paper.title}

ABSTRACT: ${paper.abstract}

=== FULL CONTENT ===
${paper.fullText}

Please provide a comprehensive peer review covering:
1. Summary of the paper
2. Strengths
3. Weaknesses
4. Detailed comments and suggestions`;

        return this.generationService.generate(prompt, SYSTEM_PROMPTS.reviewer);
    }
}
