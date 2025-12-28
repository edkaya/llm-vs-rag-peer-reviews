import { Injectable, Logger } from '@nestjs/common';
import { AnthropicProvider, createAnthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { SYSTEM_PROMPTS, USER_PROMPTS } from 'src/shared/prompts';

const ClaimSchema = z.object({
    claims: z.array(
        z.object({
            text: z.string().describe('The atomic, verifiable claim'),
            category: z.enum(['factual', 'methodological', 'attribution', 'comparative']),
            originalSentence: z.string().describe('The sentence from the review this claim was extracted from')
        })
    )
});

export type ExtractedClaims = z.infer<typeof ClaimSchema>;

@Injectable()
export class ClaimExtractionService {
    private model: string;
    private anthropic: AnthropicProvider;
    private logger = new Logger(ClaimExtractionService.name);

    constructor(private configService: ConfigService) {
        this.model = this.configService.get<string>('models.claimExtraction', '');
        this.anthropic = createAnthropic({
            apiKey: this.configService.get<string>('apiKeys.anthropic', '')
        });
        this.logger.log(`Using claim extraction model: ${this.model}`);
    }

    async extractClaims(reviewText: string): Promise<ExtractedClaims> {
        try {
            const { experimental_output } = await generateText({
                model: this.anthropic(this.model),
                // providerOptions: {
                //     anthropic: {
                //         effort: 'high'
                //         // thinking: { type: 'enabled', budgetTokens: 15000 }
                //     } satisfies AnthropicProviderOptions
                // },
                experimental_output: Output.object({ schema: ClaimSchema }),
                system: SYSTEM_PROMPTS.claimExtractor,
                prompt: USER_PROMPTS.extractClaims({ reviewText }),
                temperature: 0.0
            });

            if (!experimental_output) {
                this.logger.warn('Failed to extract claims, returning empty array');
                return { claims: [] };
            }
            return experimental_output;
        } catch (error: unknown) {
            // Handle case where LLM returns claims as a string instead of array
            if (error && typeof error === 'object' && 'value' in error) {
                const errorValue = (error as { value: { claims: unknown } }).value;
                if (errorValue?.claims && typeof errorValue.claims === 'string') {
                    try {
                        const parsedClaims = JSON.parse(errorValue.claims);
                        this.logger.warn('LLM returned claims as string, parsed manually');
                        return { claims: parsedClaims };
                    } catch {
                        this.logger.error('Failed to parse stringified claims');
                    }
                }
            }
            this.logger.error(`Claim extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { claims: [] };
        }
    }
}
