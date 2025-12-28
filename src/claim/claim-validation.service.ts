import { Injectable, Logger } from '@nestjs/common';
// import { AnthropicProvider, createAnthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { createOpenAI, OpenAIProvider, OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { ExtractedClaims } from './claim-extraction.service';
import { SYSTEM_PROMPTS, USER_PROMPTS } from 'src/shared/prompts';

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
    private openai: OpenAIProvider;
    private logger = new Logger(ClaimValidationService.name);

    constructor(private configService: ConfigService) {
        this.model = this.configService.get<string>('models.claimValidation', '');
        this.openai = createOpenAI({
            apiKey: this.configService.get<string>('apiKeys.openai', '')
        });
        this.logger.log(`Using claim validation model: ${this.model}`);
    }

    async validateClaims(extractedClaims: ExtractedClaims): Promise<ValidationResult> {
        const claims = JSON.stringify(extractedClaims.claims, null, 2);
        const userPrompt = USER_PROMPTS.validateClaims({ claims });

        // Reasoning models do not have temp and topP settings in openAI
        // We use here gpt-5-mini, which is a reasoning model
        try {
            const { experimental_output } = await generateText({
                model: this.openai(this.model),
                providerOptions: {
                    openai: {
                        reasoningEffort: 'high',
                        textVerbosity: 'low'
                    } satisfies OpenAIResponsesProviderOptions
                },
                experimental_output: Output.object({ schema: ValidationResultSchema }),
                system: SYSTEM_PROMPTS.claimValidator,
                prompt: userPrompt
            });

            if (!experimental_output) {
                this.logger.warn('Failed to validate claims, returning empty array');
                return { validatedClaims: [] };
            }

            const validCount = experimental_output.validatedClaims.filter((c) => c.validation.isValid).length;
            this.logger.log(`Validated ${experimental_output.validatedClaims.length} claims, ${validCount} valid`);

            return experimental_output;
        } catch (error: unknown) {
            // Handle case where LLM returns malformed response
            if (error && typeof error === 'object' && 'value' in error) {
                const errorValue = (error as { value: { validatedClaims: unknown } }).value;
                if (errorValue?.validatedClaims && typeof errorValue.validatedClaims === 'string') {
                    try {
                        const parsedClaims = JSON.parse(
                            errorValue.validatedClaims
                        ) as ValidationResult['validatedClaims'];
                        this.logger.warn('LLM returned validatedClaims as string, parsed manually');
                        return { validatedClaims: parsedClaims };
                    } catch {
                        this.logger.error('Failed to parse stringified validatedClaims');
                    }
                }
            }

            // Fallback: return original claims as "valid" to avoid blocking the pipeline
            this.logger.error(`Claim validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.logger.warn('Falling back to treating all claims as valid');
            return {
                validatedClaims: extractedClaims.claims.map((claim) => ({
                    ...claim,
                    validation: {
                        isValid: true,
                        score: 0.5,
                        issues: ['validation_skipped']
                    }
                }))
            };
        }
    }
}
