export interface NLPeerNode {
    ix: string;
    content: string;
    ntype: 'title' | 'abstract' | 'heading' | 'paragraph' | 'formula' | 'figure' | 'table';
    meta: { section?: string } | null;
}

export interface NLPeerReviewReport {
    paper_summary: string;
    summary_of_strengths: string;
    summary_of_weaknesses: string;
    comments_suggestions_and_typos: string;
}

export interface NLPeerReview {
    note_id: string;
    rid: string;
    report: NLPeerReviewReport;
    scores: Record<string, number | string>;
}

export interface NLPeerMeta {
    title: string;
    abstract: string;
    authors: string[];
    accepted_at: string;
}

// Application types (normalized)
export interface Paper {
    id: string;
    title: string;
    abstract: string;
    fullText: string;
    sections: Section[];
    humanReviews: Review[];
}

export interface Section {
    heading: string;
    content: string;
}

export interface Review {
    id: string;
    paperSummary: string;
    strengths: string;
    weaknesses: string;
    comments: string;
    scores: Record<string, number>;
}

export interface Chunk {
    id: string;
    paperId: string;
    text: string;
    section?: string;
    index: number;
}
