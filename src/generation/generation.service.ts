import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText } from 'ai';
import { SYSTEM_PROMPTS } from './prompts';

@Injectable()
export class GenerationService {
    private model: string;

    constructor(private configService: ConfigService) {
        this.model = this.configService.get<string>('models.generation', '');
    }

    async generate(context: string): Promise<string> {
        const { text } = await generateText({
            model: this.model,
            system: SYSTEM_PROMPTS.reviewer,
            prompt: context
        });
        return text;
    }
}
