import { Module } from '@nestjs/common';
import { NLIService } from './nli.service';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
    imports: [EmbeddingModule],
    providers: [NLIService],
    exports: [NLIService]
})
export class HallucinationModule {}
