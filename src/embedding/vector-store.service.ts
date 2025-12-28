import { Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';

export interface SearchResult {
    id: string;
    score: number;
    content: string;
    paperId: string;
    sectionName: string;
}

export interface HumanReviewSearchResult {
    id: string;
    score: number;
    paperId: string;
    paperTitle: string;
    reviewText: string;
    section: string;
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
    private client: QdrantClient;
    private paperCollectionName: string;
    private humanCollectionName: string;

    constructor(private configService: ConfigService) {
        const url = this.configService.get<string>('vectorStore.url', '');
        this.client = new QdrantClient({ url });
        this.paperCollectionName = this.configService.get<string>('vectorStore.paperCollectionName', '');
        this.humanCollectionName = this.configService.get<string>('vectorStore.reviewCollectionName', '');
    }

    async onModuleInit() {
        await this.ensureCollection();
        await this.ensureHumanReviewsCollection();
    }

    private async ensureCollection() {
        const collections = await this.client.getCollections();
        const collectionExists = collections.collections.some(
            (collection) => collection.name === this.paperCollectionName
        );

        if (!collectionExists) {
            await this.client.createCollection(this.paperCollectionName, {
                vectors: {
                    size: 1536,
                    distance: 'Cosine'
                }
            });
        }
    }

    async upsert(id: string, vector: number[], payload: Record<string, unknown>): Promise<void> {
        await this.client.upsert(this.paperCollectionName, {
            points: [{ id, vector, payload }]
        });
    }

    async upsertBatch(
        points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>
    ): Promise<void> {
        await this.client.upsert(this.paperCollectionName, { points });
    }

    async search(vector: number[], paperId: string, limit: number): Promise<SearchResult[]> {
        const results = await this.client.search(this.paperCollectionName, {
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

    async countByPaperId(paperId: string): Promise<number> {
        const result = await this.client.count(this.paperCollectionName, {
            filter: {
                must: [{ key: 'paperId', match: { value: paperId } }]
            },
            exact: true
        });
        return result.count;
    }

    private async ensureHumanReviewsCollection() {
        const collections = await this.client.getCollections();
        const collectionExists = collections.collections.some(
            (collection) => collection.name === this.humanCollectionName
        );

        if (!collectionExists) {
            await this.client.createCollection(this.humanCollectionName, {
                vectors: {
                    size: 1536,
                    distance: 'Cosine'
                }
            });
        }
    }

    async upsertHumanReviewsBatch(
        points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>
    ): Promise<void> {
        await this.client.upsert(this.humanCollectionName, { points });
    }

    async searchHumanReviewsExcluding(
        vector: number[],
        excludePaperId: string,
        limit: number
    ): Promise<HumanReviewSearchResult[]> {
        const results = await this.client.search(this.humanCollectionName, {
            vector,
            limit,
            filter: {
                must_not: [{ key: 'paperId', match: { value: excludePaperId } }]
            },
            with_payload: true
        });

        return results.map((r) => ({
            id: r.id as string,
            score: r.score,
            paperId: ((r.payload as Record<string, unknown>)?.paperId as string) || '',
            paperTitle: ((r.payload as Record<string, unknown>)?.paperTitle as string) || '',
            reviewText: ((r.payload as Record<string, unknown>)?.reviewText as string) || '',
            section: ((r.payload as Record<string, unknown>)?.section as string) || ''
        }));
    }

    async countHumanReviews(): Promise<number> {
        const result = await this.client.count(this.humanCollectionName, {
            exact: true
        });
        return result.count;
    }
}
