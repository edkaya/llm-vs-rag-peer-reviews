import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { GenerationModule } from './generation/gemeration.module';

@Module({
    imports: [AppConfigModule, EmbeddingModule, GenerationModule],
    controllers: [],
    providers: []
})
export class AppModule {}
