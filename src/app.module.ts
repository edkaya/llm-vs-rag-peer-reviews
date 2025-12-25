import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { GenerationModule } from './generation/gemeration.module';
import { DataModule } from './data/data.module';

@Module({
    imports: [AppConfigModule, EmbeddingModule, GenerationModule, DataModule],
    controllers: [],
    providers: []
})
export class AppModule {}
