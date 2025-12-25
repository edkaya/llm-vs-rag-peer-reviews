import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chunk } from './types';

@Injectable()
export class ChunkingService {
    private chunkSize: number;
    private chunkOverlap: number;

    constructor(private configService: ConfigService) {
        this.chunkSize = this.configService.get<number>('chunking.chunkSize', 500);
        this.chunkOverlap = this.configService.get<number>('chunking.chunkOverlap', 50);
    }

    chunkText(paperId: string, text: string, section?: string): Chunk[] {
        const chunks: Chunk[] = [];
        const words = text.split(/\s+/);

        let index = 0;
        let start = 0;

        while (start < words.length) {
            const end = Math.min(start + this.chunkSize, words.length);
            const chunkText = words.slice(start, end).join(' ');

            chunks.push({
                id: `${paperId}-${index}`,
                paperId,
                text: chunkText,
                section,
                index
            });

            index++;
            start += this.chunkSize - this.chunkOverlap;
        }

        return chunks;
    }

    chunkPaper(paperId: string, sections: Array<{ title: string; content: string }>): Chunk[] {
        const allChunks: Chunk[] = [];

        for (const section of sections) {
            const sectionChunks = this.chunkText(paperId, section.content, section.title);
            allChunks.push(...sectionChunks);
        }
        return allChunks.map((chunk, i) => ({ ...chunk, index: i, id: `${paperId}-${i}` }));
    }
}
