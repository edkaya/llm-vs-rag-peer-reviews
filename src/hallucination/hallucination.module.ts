import { Module } from '@nestjs/common';
import { NLIService } from './nli.service';
import { LLMJudgeService } from './llm-judge.service';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
    imports: [EmbeddingModule],
    providers: [NLIService, LLMJudgeService],
    exports: [NLIService, LLMJudgeService]
})
export class HallucinationModule {}
