import { Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';

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

    async upsert() {
        // Implementation for upserting vectors into the collection
    }

    async search() {
        // Implementation for searching vectors in the collection
    }
}
