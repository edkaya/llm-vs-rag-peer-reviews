import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { GenerationModule } from './generation/gemeration.module';
import { DataModule } from './data/data.module';
import { RagModule } from './rag/rag.module';
import { ClaimModule } from './claim/claim.module';
import { AppController } from './app.controller';

@Module({
    imports: [AppConfigModule, EmbeddingModule, GenerationModule, DataModule, RagModule, ClaimModule],
    controllers: [AppController],
    providers: []
})
export class AppModule {}
