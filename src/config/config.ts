export default () => ({
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },

    models: {
        embedding: process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-small',
        generation: process.env.GENERATION_MODEL || 'openai/gpt-5.2',
        claimExtraction: process.env.CLAIM_EXTRACTION_MODEL || 'gpt-4o-mini',
        judge: process.env.JUDGE_MODEL || 'gpt-4o',
        nli: process.env.NLI_MODEL || 'Xenova/nli-deberta-v3-small'
    },

    vectorStore: {
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        collectionName: process.env.QDRANT_COLLECTION_NAME || 'paper_chunks'
    },

    dataset: {
        path: process.env.DATASET_PATH || './data/nlpeer/arr_emnlp',
        maxPapers: parseInt(process.env.MAX_PAPERS ?? '50', 10)
    },

    chunking: {
        chunkSize: parseInt(process.env.CHUNK_SIZE ?? '512', 10),
        chunkOverlap: parseInt(process.env.CHUNK_OVERLAP ?? '64', 10)
    },

    rag: {
        topK: parseInt(process.env.TOP_K ?? '5', 10)
    },

    output: {
        resultsPath: process.env.RESULTS_PATH || './data/results'
    }
});
