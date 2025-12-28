import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText } from 'ai';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';

@Injectable()
export class GenerationService {
    private model: string;
    private openai: OpenAIProvider;
    private logger = new Logger(GenerationService.name);

    constructor(private configService: ConfigService) {
        this.model = this.configService.get<string>('models.generation', '');
        this.openai = createOpenAI({
            apiKey: this.configService.get<string>('apiKeys.openai', '')
        });
        this.logger.log(`Using generation model: ${this.model}`);
    }

    async generate(context: string, systemPrompt: string): Promise<string> {
        // AI SDK Docs: It is recommended to set either temperature or topP, but not both.
        const { text } = await generateText({
            model: this.openai(this.model),
            system: systemPrompt,
            prompt: context,
            maxOutputTokens: 34000, // ~ 1200 words approx. 30k-34k tokens (~4 token per character according to openai)
            temperature: 0.0
        });
        return text;
    }
}
