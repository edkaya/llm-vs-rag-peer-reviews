import { Injectable, Logger } from '@nestjs/common';
import { AnthropicProvider, createAnthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';
import { z } from 'zod';

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

    async extractClaims(reviewText: string, systemPrompt: string): Promise<ExtractedClaims> {
        const { experimental_output } = await generateText({
            model: this.anthropic(this.model),
            providerOptions: {
                anthropic: {
                    thinking: { type: 'enabled', budgetTokens: 15000 }
                } satisfies AnthropicProviderOptions
            },
            experimental_output: Output.object({ schema: ClaimSchema }),
            system: systemPrompt,
            prompt: reviewText
        });

        if (!experimental_output) {
            this.logger.warn('Failed to extract claims, returning empty array');
            return { claims: [] };
        }
        return experimental_output;
    }
}
