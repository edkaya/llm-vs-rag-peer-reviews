import { Module } from '@nestjs/common';
import { ChunkingService } from './chunking.service';
import { DatasetLoaderService } from './dataset-loader.service';

@Module({
    providers: [DatasetLoaderService, ChunkingService],
    exports: [DatasetLoaderService, ChunkingService]
})
export class DataModule {}
