import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v5 as uuidv5 } from 'uuid';
import { Chunk } from './types';

// Custom namespace UUID for generating deterministic chunk IDs
const CHUNK_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

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
                id: uuidv5(`${paperId}-${index}`, CHUNK_NAMESPACE),
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
        return allChunks.map((chunk, i) => ({
            ...chunk,
            index: i,
            id: uuidv5(`${paperId}-${i}`, CHUNK_NAMESPACE)
        }));
    }
}
