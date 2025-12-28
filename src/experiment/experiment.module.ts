import { Module } from '@nestjs/common';
import { ExperimentService } from './experiment.service';
import { DataModule } from '../data/data.module';
import { RagModule } from '../rag/rag.module';
import { ClaimModule } from '../claim/claim.module';
import { HallucinationModule } from '../hallucination/hallucination.module';
import { EvaluationModule } from 'src/evaluation/evaluation.module';

@Module({
    imports: [DataModule, RagModule, ClaimModule, HallucinationModule, EvaluationModule],
    providers: [ExperimentService],
    exports: [ExperimentService]
})
export class ExperimentModule {}
