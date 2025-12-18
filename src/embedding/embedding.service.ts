import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { embedMany } from 'ai';

@Injectable()
export class EmbeddingService {
    private model: string;

    constructor(private configService: ConfigService) {
        this.model = this.configService.get<string>('models.embedding', '');
    }

    async embedChunks(chunks: string[]): Promise<number[][]> {
        const { embeddings } = await embedMany({
            model: this.model,
            values: chunks
        });
        return embeddings;
    }
}
