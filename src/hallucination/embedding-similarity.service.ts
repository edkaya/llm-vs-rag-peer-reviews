import { Injectable, Logger } from '@nestjs/common';
import { VectorStoreService } from '../embedding/vector-store.service';
import { EmbeddingService } from '../embedding/embedding.service';

export interface EmbeddingSimilarityResult {
    claim: string;
    verdict: 'GROUNDED' | 'UNGROUNDED';
    maxSimilarity: number;
    threshold: number;
    mostSimilarChunk: string;
    isHallucination: boolean;
}

@Injectable()
export class EmbeddingSimilarityService {
    private readonly threshold = 0.75; // Similarity threshold for "grounded"
    private logger = new Logger(EmbeddingSimilarityService.name);

    constructor(
        private vectorStoreService: VectorStoreService,
        private embeddingService: EmbeddingService
    ) {}

    async detectHallucination(claim: string, paperId: string): Promise<EmbeddingSimilarityResult> {
        // 1. Embed the claim
        const claimEmbedding = await this.embeddingService.embedChunk(claim);

        // 2. Find most similar chunks from the paper
        const chunks = await this.vectorStoreService.search(claimEmbedding, paperId, 1);

        if (chunks.length === 0) {
            return {
                claim,
                verdict: 'UNGROUNDED',
                maxSimilarity: 0,
                threshold: this.threshold,
                mostSimilarChunk: '',
                isHallucination: true
            };
        }

        // Qdrant returns score as similarity (higher = more similar)
        const maxSimilarity = chunks[0].score;
        const verdict = maxSimilarity >= this.threshold ? 'GROUNDED' : 'UNGROUNDED';

        return {
            claim,
            verdict,
            maxSimilarity: Math.round(maxSimilarity * 1000) / 1000,
            threshold: this.threshold,
            mostSimilarChunk: chunks[0].content,
            isHallucination: verdict === 'UNGROUNDED'
        };
    }

    async detectHallucinationsBatch(claims: string[], paperId: string): Promise<EmbeddingSimilarityResult[]> {
        const results: EmbeddingSimilarityResult[] = [];
        for (const claim of claims) {
            const result = await this.detectHallucination(claim, paperId);
            results.push(result);
            this.logger.log(
                `Embedding similarity: "${claim.substring(0, 50)}..." → ${result.verdict} (${result.maxSimilarity})`
            );
        }
        return results;
    }
}
