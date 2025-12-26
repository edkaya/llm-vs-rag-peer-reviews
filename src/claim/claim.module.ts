import { Module } from '@nestjs/common';
import { ClaimExtractionService } from './claim-extraction.service';
import { ClaimValidationService } from './claim-validation.service';

@Module({
    providers: [ClaimValidationService, ClaimExtractionService],
    exports: [ClaimValidationService, ClaimExtractionService]
})
export class ClaimModule {}
