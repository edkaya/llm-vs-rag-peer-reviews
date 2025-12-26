import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VectorStoreService } from '../embedding/vector-store.service';
import { EmbeddingService } from '../embedding/embedding.service';

export interface NLIScores {
    entailment: number;
    neutral: number;
    contradiction: number;
}

export interface NLIResult {
    claim: string;
    verdict: 'SUPPORTED' | 'CONTRADICTED' | 'UNVERIFIABLE';
    scores: NLIScores;
    evidenceChunk: string;
    isHallucination: boolean;
}

interface PipelineResult {
    label: string;
    score: number;
}

type TextClassificationPipeline = (input: string) => Promise<PipelineResult[]>;

@Injectable()
export class NLIService implements OnModuleInit {
    private pipeline: TextClassificationPipeline | null = null;
    private modelName: string;
    private logger = new Logger(NLIService.name);
    private isModelLoaded = false;

    constructor(
        private configService: ConfigService,
        private vectorStoreService: VectorStoreService,
        private embeddingService: EmbeddingService
    ) {
        this.modelName = this.configService.get<string>('models.nli', 'Xenova/nli-deberta-v3-small');
    }

    async onModuleInit() {
        await this.loadModel();
    }

    private async loadModel(): Promise<void> {
        if (this.isModelLoaded) return;

        this.logger.log(`Loading NLI model: ${this.modelName}...`);
        const { pipeline } = await import('@xenova/transformers');
        this.pipeline = (await pipeline('text-classification', this.modelName)) as TextClassificationPipeline;
        this.isModelLoaded = true;
        this.logger.log('NLI model loaded successfully');
    }

    private async runNLI(premise: string, hypothesis: string): Promise<NLIScores> {
        await this.loadModel();

        if (!this.pipeline) {
            throw new Error('NLI pipeline not loaded');
        }

        // NLI models expect input in format: "premise</s></s>hypothesis" or similar
        const input = `${premise}</s></s>${hypothesis}`;
        const result = await this.pipeline(input);

        // Parse the result - format varies by model but typically returns label scores
        const scores: NLIScores = { entailment: 0, neutral: 0, contradiction: 0 };

        for (const item of result) {
            const label = item.label.toLowerCase();
            if (label.includes('entail')) scores.entailment = item.score;
            else if (label.includes('neutral')) scores.neutral = item.score;
            else if (label.includes('contradict')) scores.contradiction = item.score;
        }

        return scores;
    }

    private classifyVerdict(scores: NLIScores): 'SUPPORTED' | 'CONTRADICTED' | 'UNVERIFIABLE' {
        const threshold = 0.5;

        if (scores.entailment > threshold && scores.entailment > scores.contradiction) {
            return 'SUPPORTED';
        } else if (scores.contradiction > threshold && scores.contradiction > scores.entailment) {
            return 'CONTRADICTED';
        }
        return 'UNVERIFIABLE';
    }

    async detectHallucination(claim: string, paperId: string): Promise<NLIResult> {
        // 1. Embed the claim first
        const claimEmbedding = await this.embeddingService.embedChunk(claim);

        // 2. Retrieve relevant chunks using the embedding
        const chunks = await this.vectorStoreService.search(claimEmbedding, paperId, 5);

        if (chunks.length === 0) {
            return {
                claim,
                verdict: 'UNVERIFIABLE',
                scores: { entailment: 0, neutral: 1, contradiction: 0 },
                evidenceChunk: '',
                isHallucination: true
            };
        }

        // 3. Run NLI on each chunk and find the best supporting evidence
        let bestResult: { scores: NLIScores; chunk: string } = {
            scores: { entailment: 0, neutral: 1, contradiction: 0 },
            chunk: ''
        };

        for (const chunk of chunks) {
            const scores = await this.runNLI(chunk.content, claim);

            // Keep the chunk with highest entailment (or highest contradiction if no entailment)
            if (
                scores.entailment > bestResult.scores.entailment ||
                (scores.entailment === bestResult.scores.entailment &&
                    scores.contradiction > bestResult.scores.contradiction)
            ) {
                bestResult = { scores, chunk: chunk.content };
            }
        }

        const verdict = this.classifyVerdict(bestResult.scores);

        return {
            claim,
            verdict,
            scores: bestResult.scores,
            evidenceChunk: bestResult.chunk,
            isHallucination: verdict !== 'SUPPORTED'
        };
    }

    async detectHallucinationsBatch(claims: string[], paperId: string): Promise<NLIResult[]> {
        const results: NLIResult[] = [];
        for (const claim of claims) {
            const result = await this.detectHallucination(claim, paperId);
            results.push(result);
        }
        return results;
    }
}
