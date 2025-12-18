// Document chunk for vector storage
export interface DocumentChunk {
    id: string;
    paperId: string;
    sectionName: string;
    content: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
}

// Search result from vector store
export interface SearchResult {
    id: string;
    score: number;
    content: string;
    paperId: string;
    sectionName: string;
    metadata?: Record<string, unknown>;
}
