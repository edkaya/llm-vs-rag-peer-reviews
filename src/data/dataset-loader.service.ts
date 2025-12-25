import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Paper, Review, Section } from './types';

@Injectable()
export class DatasetLoaderService {
    private datasetPath: string;
    private maxPapers: number;

    constructor(private configService: ConfigService) {
        this.datasetPath = this.configService.get<string>('dataset.path', '');
        this.maxPapers = this.configService.get<number>('dataset.maxPapers', 0);
    }

    loadPapers(): Paper[] {
        const papers: Paper[] = [];
        const files = fs.readdirSync(this.datasetPath);

        for (const file of files.slice(0, this.maxPapers)) {
            if (file.endsWith('.json')) {
                const filePath = path.join(this.datasetPath, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                const paper = this.parsePaper(data);
                if (paper) papers.push(paper);
            }
        }

        return papers;
    }

    private parsePaper(data: Record<string, unknown>): Paper | null {
        // TODO
        return null;
    }

    private parseSections(data: Record<string, unknown>): Section[] {
        // TODO
        return [];
    }

    private parseReviews(data: Record<string, unknown>): Review[] {
        // TODO
        return [];
    }
}
