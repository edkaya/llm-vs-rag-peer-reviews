import { Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';
import { SearchResult } from '../shared/types';

@Injectable()
export class VectorStoreService implements OnModuleInit {
    private client: QdrantClient;
    private collectionName: string;

    constructor(private configService: ConfigService) {
        const url = this.configService.get<string>('vectorStore.url', '');
        this.client = new QdrantClient({ url });
        this.collectionName = this.configService.get<string>('vectorStore.collectionName', '');
    }

    async onModuleInit() {
        await this.ensureCollection();
    }

    private async ensureCollection() {
        const collections = await this.client.getCollections();
        const collectionExists = collections.collections.some((collection) => collection.name === this.collectionName);

        if (!collectionExists) {
            await this.client.createCollection(this.collectionName, {
                vectors: {
                    size: 1536,
                    distance: 'Cosine'
                }
            });
        }
    }

    async upsert(id: string, vector: number[], payload: Record<string, unknown>): Promise<void> {
        await this.client.upsert(this.collectionName, {
            points: [{ id, vector, payload }]
        });
    }

    async upsertBatch(
        points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>
    ): Promise<void> {
        await this.client.upsert(this.collectionName, { points });
    }

    async search(vector: number[], paperId: string, limit: number): Promise<SearchResult[]> {
        const results = await this.client.search(this.collectionName, {
            vector,
            limit,
            filter: {
                must: [{ key: 'paperId', match: { value: paperId } }]
            },
            with_payload: true
        });

        return results.map((r) => ({
            id: r.id as string,
            score: r.score,
            content: ((r.payload as Record<string, unknown>)?.text as string) || '',
            paperId: ((r.payload as Record<string, unknown>)?.paperId as string) || '',
            sectionName: ((r.payload as Record<string, unknown>)?.section as string) || ''
        }));
    }
}
