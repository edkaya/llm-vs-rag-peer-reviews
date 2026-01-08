export default () => ({
    apiKeys: {
        openai: process.env.OPENAI_API_KEY || '',
        anthropic: process.env.ANTHROPIC_API_KEY || ''
    },

    models: {
        embedding: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        generation: process.env.GENERATION_MODEL || 'gpt-4.1-2025-04-14',
        claimExtraction: process.env.CLAIM_EXTRACTION_MODEL || 'claude-sonnet-4-5-20250929',
        claimValidation: process.env.CLAIM_VALIDATION_MODEL || 'gpt-5-mini-2025-08-07',
        judge: process.env.JUDGE_MODEL || 'claude-opus-4-5-20251101',
        nli: process.env.NLI_MODEL || 'Xenova/nli-deberta-v3-small'
    },

    vectorStore: {
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        paperCollectionName: process.env.PAPER_COLLECTION_NAME || 'papers',
        reviewCollectionName: process.env.REVIEW_COLLECTION_NAME || 'human_reviews'
    },

    dataset: {
        path: process.env.DATASET_PATH || './dataset',
        maxPapers: parseInt(process.env.MAX_PAPERS ?? '75', 10)
    },

    chunking: {
        chunkSize: parseInt(process.env.CHUNK_SIZE ?? '512', 10),
        chunkOverlap: parseInt(process.env.CHUNK_OVERLAP ?? '64', 10)
    },

    rag: {
        topK: parseInt(process.env.TOP_K ?? '5', 10),
        topKJudge: parseInt(process.env.TOP_K_JUDGE ?? '7', 10)
    },

    nli: {
        entailmentThreshold: parseFloat(process.env.NLI_ENTAILMENT_THRESHOLD ?? '0.7'),
        contradictionThreshold: parseFloat(process.env.NLI_CONTRADICTION_THRESHOLD ?? '0.5')
    },

    output: {
        resultsPath: process.env.RESULTS_PATH || './results'
    }
});
