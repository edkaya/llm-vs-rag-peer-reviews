import { Module } from '@nestjs/common';
import { NLIService } from './nli.service';
import { LLMJudgeService } from './llm-judge.service';
import { EmbeddingSimilarityService } from './embedding-similarity.service';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
    imports: [EmbeddingModule],
    providers: [NLIService, LLMJudgeService, EmbeddingSimilarityService],
    exports: [NLIService, LLMJudgeService, EmbeddingSimilarityService]
})
export class HallucinationModule {}
