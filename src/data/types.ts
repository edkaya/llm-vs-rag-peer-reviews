export interface Paper {
    id: string;
    title: string;
    abstract: string;
    content: string;
    sections: Section[];
    humanReviews: Review[];
}

export interface Section {
    title: string;
    content: string;
}

export interface Review {
    id: string;
    content: string;
    scores?: Record<string, number>;
}

export interface Chunk {
    id: string;
    paperId: string;
    text: string;
    section?: string;
    index: number;
}
