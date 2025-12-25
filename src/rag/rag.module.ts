import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { DataModule } from '../data/data.module';
import { GenerationModule } from 'src/generation/gemeration.module';

@Module({
    imports: [EmbeddingModule, DataModule, GenerationModule],
    providers: [RagService],
    exports: [RagService]
})
export class RagModule {}
