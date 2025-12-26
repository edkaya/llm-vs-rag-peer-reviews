import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { VectorStoreService } from '../embedding/vector-store.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { AnthropicProvider, createAnthropic } from '@ai-sdk/anthropic';

const JudgeVerdictSchema = z.object({
    verdict: z.enum(['SUPPORTED', 'PARTIALLY_SUPPORTED', 'NOT_SUPPORTED', 'CONTRADICTED']),
    confidence: z.number().min(0).max(1).describe('Confidence score from 0 to 1'),
    explanation: z.string().describe('Brief explanation for the verdict'),
    relevantQuote: z.string().optional().describe('Quote from evidence that supports the verdict')
});

export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

export interface LLMJudgeResult {
    claim: string;
    verdict: JudgeVerdict['verdict'];
    confidence: number;
    explanation: string;
    relevantQuote?: string;
    evidenceChunks: string[];
    isHallucination: boolean;
}

@Injectable()
export class LLMJudgeService {
    private model: string;
    private anthropic: AnthropicProvider;
    private logger = new Logger(LLMJudgeService.name);

    constructor(
        private configService: ConfigService,
        private vectorStoreService: VectorStoreService,
        private embeddingService: EmbeddingService
    ) {
        this.model = this.configService.get<string>('models.judge', '');
        this.anthropic = createAnthropic({
            apiKey: this.configService.get<string>('apiKeys.anthropic', '')
        });
        this.logger.log(`Using LLM judge model: ${this.model}`);
    }

    async judgeClaimAgainstEvidence(claim: string, evidenceChunks: string[]): Promise<JudgeVerdict> {
        const evidenceText = evidenceChunks.map((chunk, i) => `[Evidence ${i + 1}]:\n${chunk}`).join('\n\n');
        const systemPrompt = `You are an expert fact-checker evaluating claims from academic peer reviews against source paper content.

Your task is to determine if the given claim is supported by the provided evidence from the paper.

Verdict categories:
- SUPPORTED: The claim is fully supported by the evidence. The evidence directly states or clearly implies what the claim asserts.
- PARTIALLY_SUPPORTED: The claim is partially correct but missing nuance, or only some aspects are supported.
- NOT_SUPPORTED: The evidence does not address this claim (neither supports nor contradicts). The claim cannot be verified from the given evidence.
- CONTRADICTED: The evidence directly contradicts the claim. The claim states something opposite to what the evidence says.

Be especially careful with:
- Negations ("not", "does not", "less", "lower")
- Comparatives ("more than", "less than", "better", "worse")
- Specific numbers and statistics
- Attribution of methods or results to specific entities

Provide a brief, factual explanation for your verdict.`;

        const userPrompt = `Claim to verify:
"${claim}"

Evidence from the paper:
${evidenceText}

Evaluate whether the evidence supports, partially supports, contradicts, or does not address this claim.`;

        const { experimental_output } = await generateText({
            model: this.anthropic(this.model),
            experimental_output: Output.object({ schema: JudgeVerdictSchema }),
            system: systemPrompt,
            prompt: userPrompt
        });

        if (!experimental_output) {
            this.logger.warn('Failed to get verdict from LLM judge');
            return {
                verdict: 'NOT_SUPPORTED',
                confidence: 0,
                explanation: 'Failed to evaluate claim'
            };
        }

        return experimental_output;
    }

    async detectHallucination(claim: string, paperId: string): Promise<LLMJudgeResult> {
        // 1. Embed the claim
        const claimEmbedding = await this.embeddingService.embedChunk(claim);

        // 2. Retrieve relevant chunks
        const chunks = await this.vectorStoreService.search(claimEmbedding, paperId, 5);

        if (chunks.length === 0) {
            return {
                claim,
                verdict: 'NOT_SUPPORTED',
                confidence: 1,
                explanation: 'No relevant evidence found in the paper',
                evidenceChunks: [],
                isHallucination: true
            };
        }

        const evidenceChunks = chunks.map((c) => c.content);

        // 3. Ask LLM to judge
        const verdict = await this.judgeClaimAgainstEvidence(claim, evidenceChunks);

        return {
            claim,
            verdict: verdict.verdict,
            confidence: verdict.confidence,
            explanation: verdict.explanation,
            relevantQuote: verdict.relevantQuote,
            evidenceChunks,
            isHallucination: verdict.verdict === 'NOT_SUPPORTED' || verdict.verdict === 'CONTRADICTED'
        };
    }

    async detectHallucinationsBatch(claims: string[], paperId: string): Promise<LLMJudgeResult[]> {
        const results: LLMJudgeResult[] = [];
        for (const claim of claims) {
            const result = await this.detectHallucination(claim, paperId);
            results.push(result);
            this.logger.log(`Judged claim: "${claim.substring(0, 50)}..." → ${result.verdict}`);
        }
        return results;
    }
}
