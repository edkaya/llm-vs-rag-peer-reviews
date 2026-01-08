import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { embedMany, embed } from 'ai';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';

@Injectable()
export class EmbeddingService {
    private model: string;
    private openai: OpenAIProvider;

    constructor(private configService: ConfigService) {
        this.model = this.configService.get<string>('models.embedding', '');
        this.openai = createOpenAI({
            apiKey: this.configService.get<string>('apiKeys.openai', '')
        });
    }

    // process single chunk
    async embedChunk(chunk: string): Promise<number[]> {
        const { embedding } = await embed({
            model: this.openai.embedding(this.model),
            value: chunk
        });
        return embedding;
    }

    // process multiple chunks with batches not to exceed token limits
    async embedChunks(chunks: string[], batchSize = 100): Promise<number[][]> {
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const { embeddings } = await embedMany({
                model: this.openai.embedding(this.model),
                values: batch
            });
            allEmbeddings.push(...embeddings);
        }

        return allEmbeddings;
    }
}
