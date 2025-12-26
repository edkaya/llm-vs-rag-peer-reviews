import { Injectable, Logger } from '@nestjs/common';
import { AnthropicProvider, createAnthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { ExtractedClaims } from './claim-extraction.service';

const ValidationResultSchema = z.object({
    validatedClaims: z.array(
        z.object({
            text: z.string().describe('The original claim text'),
            category: z.enum(['factual', 'methodological', 'attribution', 'comparative']),
            originalSentence: z.string().describe('The original sentence from the review'),
            validation: z.object({
                isValid: z.boolean().describe('Whether the claim is well-formed and verifiable'),
                score: z.number().min(0).max(1).describe('Confidence score from 0 to 1'),
                issues: z.array(z.string()).describe('List of issues: not_atomic, subjective, ambiguous, incomplete'),
                correctedText: z.string().optional().describe('Corrected claim text if issues were found')
            })
        })
    )
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
// not used rn, but could be useful
export type ValidatedClaim = ValidationResult['validatedClaims'][number];

@Injectable()
export class ClaimValidationService {
    private model: string;
    private anthropic: AnthropicProvider;
    private logger = new Logger(ClaimValidationService.name);

    constructor(private configService: ConfigService) {
        this.model = this.configService.get<string>('models.claimValidation', '');
        this.anthropic = createAnthropic({
            apiKey: this.configService.get<string>('apiKeys.anthropic', '')
        });
        this.logger.log(`Using claim validation model: ${this.model}`);
    }

    async validateClaims(extractedClaims: ExtractedClaims, systemPrompt: string): Promise<ValidationResult> {
        const claimsJson = JSON.stringify(extractedClaims.claims, null, 2);

        const { experimental_output } = await generateText({
            model: this.anthropic(this.model),
            providerOptions: {
                anthropic: {
                    effort: 'high'
                } satisfies AnthropicProviderOptions
            },
            experimental_output: Output.object({ schema: ValidationResultSchema }),
            system: systemPrompt,
            prompt: claimsJson
        });

        if (!experimental_output) {
            this.logger.warn('Failed to validate claims, returning empty array');
            return { validatedClaims: [] };
        }

        const validCount = experimental_output.validatedClaims.filter((c) => c.validation.isValid).length;
        this.logger.log(`Validated ${experimental_output.validatedClaims.length} claims, ${validCount} valid`);

        return experimental_output;
    }
}
