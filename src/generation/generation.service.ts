import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText } from 'ai';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';

@Injectable()
export class GenerationService {
    private model: string;
    private openai: OpenAIProvider;

    constructor(private configService: ConfigService) {
        this.model = this.configService.get<string>('models.generation', '');
        this.openai = createOpenAI({
            apiKey: this.configService.get<string>('openai.apiKey', '')
        });
    }

    async generate(context: string, systemPrompt: string): Promise<string> {
        const { text } = await generateText({
            model: this.openai(this.model),
            system: systemPrompt,
            prompt: context
        });
        return text;
    }
}
