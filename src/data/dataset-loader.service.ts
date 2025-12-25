import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Paper, Review, Section, NLPeerNode, NLPeerReview, NLPeerMeta } from './types';

@Injectable()
export class DatasetLoaderService {
    private readonly logger = new Logger(DatasetLoaderService.name);
    private datasetPath: string;
    private maxPapers: number;

    constructor(private configService: ConfigService) {
        this.datasetPath = this.configService.get<string>('dataset.path', '');
        this.maxPapers = this.configService.get<number>('dataset.maxPapers', 0);
    }

    loadPapers(): Paper[] {
        const papers: Paper[] = [];
        const folders = fs
            .readdirSync(this.datasetPath, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
            .map((dirent) => dirent.name);

        let count = 0;
        for (const folder of folders) {
            if (count >= this.maxPapers) break;

            const v1Path = path.join(this.datasetPath, folder, 'v1');
            if (!fs.existsSync(v1Path)) continue;

            const paper = this.loadPaper(folder, v1Path);
            if (paper && paper.humanReviews.length > 0) {
                papers.push(paper);
                count++;
            }
        }

        this.logger.log(`Loaded ${papers.length} papers with reviews`);
        return papers;
    }

    private loadPaper(id: string, v1Path: string): Paper | null {
        try {
            // Load meta
            const metaPath = path.join(v1Path, 'meta.json');
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as NLPeerMeta;

            // Load paper content
            const itgPath = path.join(v1Path, 'paper.itg.json');
            const itgData = JSON.parse(fs.readFileSync(itgPath, 'utf-8')) as { nodes: NLPeerNode[] };
            const { sections, fullText } = this.parseNodes(itgData.nodes);

            // Load reviews
            const reviewsPath = path.join(v1Path, 'reviews.json');
            let humanReviews: Review[] = [];
            if (fs.existsSync(reviewsPath)) {
                const reviewsData = JSON.parse(fs.readFileSync(reviewsPath, 'utf-8')) as NLPeerReview[];
                humanReviews = this.parseReviews(reviewsData);
            }

            return {
                id,
                title: meta.title || '',
                abstract: meta.abstract || '',
                fullText,
                sections,
                humanReviews
            };
        } catch (error) {
            this.logger.warn(`Failed to load paper ${id}: ${error}`);
            return null;
        }
    }

    private parseNodes(nodes: NLPeerNode[]): { sections: Section[]; fullText: string } {
        const sections: Section[] = [];
        let currentSection: Section | null = null;
        const allText: string[] = [];

        for (const node of nodes) {
            if (node.ntype === 'heading') {
                if (currentSection && currentSection.content.trim()) {
                    sections.push(currentSection);
                }
                currentSection = { heading: node.content, content: '' };
            } else if (node.ntype === 'paragraph' || node.ntype === 'abstract') {
                allText.push(node.content);
                if (currentSection) {
                    currentSection.content += node.content + '\n\n';
                }
            }
        }

        // Push last section
        if (currentSection && currentSection.content.trim()) {
            sections.push(currentSection);
        }

        return { sections, fullText: allText.join('\n\n') };
    }

    private parseReviews(reviews: NLPeerReview[]): Review[] {
        return reviews.map((r, i) => ({
            id: r.rid || `review-${i}`,
            paperSummary: r.report?.paper_summary || '',
            strengths: r.report?.summary_of_strengths || '',
            weaknesses: r.report?.summary_of_weaknesses || '',
            comments: r.report?.comments_suggestions_and_typos || '',
            scores: this.normalizeScores(r.scores)
        }));
    }

    private normalizeScores(scores: Record<string, number | string>): Record<string, number> {
        const normalized: Record<string, number> = {};
        for (const [key, value] of Object.entries(scores)) {
            if (typeof value === 'number') {
                normalized[key] = value;
            }
        }
        return normalized;
    }
}
