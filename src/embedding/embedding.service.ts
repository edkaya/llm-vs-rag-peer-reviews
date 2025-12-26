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

    // process multiple chunks
    async embedChunks(chunks: string[]): Promise<number[][]> {
        const { embeddings } = await embedMany({
            model: this.openai.embedding(this.model),
            values: chunks
        });
        return embeddings;
    }
}
