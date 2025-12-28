# LLM vs RAG Peer Reviews

A research system for comparing **LLM-only** vs **RAG-augmented** peer review generation, with automated hallucination detection and metrics analysis.

## Overview

This project investigates whether augmenting LLMs with Retrieval-Augmented Generation (RAG) reduces hallucinations in AI-generated peer reviews. The system:

1. **Generates peer reviews** for research papers using both RAG and non-RAG approaches
2. **Extracts claims** from generated reviews
3. **Validates claim quality** using cross-provider LLM validation
4. **Detects hallucinations** by verifying claims against source paper content
5. **Computes metrics** comparing hallucination rates between approaches

### Key Features

- **Cross-Paper RAG**: Retrieves human reviews from similar papers (by abstract similarity) to guide review generation
- **Multi-provider setup**: Uses different LLM providers for different tasks to avoid bias
- **Multiple hallucination detection methods**: LLM Judge, NLI model, and embedding similarity
- **Batch experiments**: Run experiments across multiple papers with aggregated metrics
- **React dashboard**: Visualize experiment results and compare RAG vs NoRAG performance

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Experiment Pipeline                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌────────────┐ │
│  │  Paper   │───▶│   Review     │───▶│   Claim     │───▶│ Hallucin.  │ │
│  │  Input   │    │  Generation  │    │ Extraction  │    │ Detection  │ │
│  └──────────┘    └──────────────┘    └─────────────┘    └────────────┘ │
│       │                │                    │                  │        │
│       │          ┌─────┴─────┐              │            ┌─────┴─────┐  │
│       │          │           │              │            │           │  │
│       ▼          ▼           ▼              ▼            ▼           │  │
│  ┌────────┐  ┌──────┐   ┌────────┐   ┌──────────┐   ┌────────┐      │  │
│  │ Qdrant │  │ RAG  │   │ NoRAG  │   │Validation│   │ LLM    │      │  │
│  │ Vector │  │Review│   │ Review │   │ (OpenAI) │   │ Judge  │      │  │
│  │  Store │  └──────┘   └────────┘   └──────────┘   └────────┘      │  │
│  └────────┘                                                          │  │
│                                                                      │  │
│                              ┌────────────────────────────────────┐  │  │
│                              │         Metrics Service            │◀─┘  │
│                              │  • Hallucination Rate              │     │
│                              │  • Grounding Score                 │     │
│                              │  • Claim Density                   │     │
│                              └────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
llm-vs-rag-peer-reviews/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root NestJS module
│   ├── app.controller.ts          # API endpoints
│   │
│   ├── claim/                     # Claim extraction & validation
│   │   ├── claim-extraction.service.ts   # Extract claims from reviews (Anthropic)
│   │   ├── claim-validation.service.ts   # Validate claim quality (OpenAI)
│   │   └── claim.module.ts
│   │
│   ├── config/                    # Configuration management
│   │   ├── config.ts              # Environment config schema
│   │   └── config.module.ts
│   │
│   ├── data/                      # Dataset handling
│   │   ├── dataset-loader.service.ts    # Load papers from dataset
│   │   ├── chunking.service.ts          # Chunk papers for embeddings
│   │   ├── types.ts                     # Paper, Review types
│   │   └── data.module.ts
│   │
│   ├── embedding/                 # Vector embeddings
│   │   ├── embedding.service.ts         # Generate embeddings (OpenAI)
│   │   ├── vector-store.service.ts      # Qdrant vector operations
│   │   └── embedding.module.ts
│   │
│   ├── evaluation/                # Metrics computation
│   │   ├── metrics.service.ts           # Calculate review metrics
│   │   ├── types.ts                     # Metric type definitions
│   │   └── evaluation.module.ts
│   │
│   ├── experiment/                # Experiment orchestration
│   │   ├── experiment.service.ts        # Run single/batch experiments
│   │   ├── types.ts                     # Experiment result types
│   │   └── experiment.module.ts
│   │
│   ├── generation/                # Review generation
│   │   ├── generation.service.ts        # Generate reviews (OpenAI)
│   │   └── generation.module.ts
│   │
│   ├── hallucination/             # Hallucination detection
│   │   ├── llm-judge.service.ts         # LLM-based verdict (Anthropic)
│   │   ├── nli.service.ts               # NLI model inference
│   │   ├── embedding-similarity.service.ts  # Embedding-based detection
│   │   └── hallucination.module.ts
│   │
│   ├── rag/                       # RAG implementation
│   │   ├── rag.service.ts               # Cross-paper RAG retrieval
│   │   └── rag.module.ts
│   │
│   └── shared/
│       └── prompts.ts             # System & user prompts
│
├── frontend/                      # React dashboard
│   ├── src/
│   │   ├── App.tsx                # Main app component
│   │   ├── api.ts                 # API client functions
│   │   └── components/
│   │       ├── BatchExperiment.tsx    # Batch experiment UI
│   │       ├── PaperSelector.tsx      # Paper selection
│   │       ├── ReviewPanel.tsx        # Review display
│   │       ├── ClaimsList.tsx         # Claims visualization
│   │       ├── MetricsCard.tsx        # Metrics display
│   │       └── ComparisonCard.tsx     # RAG vs NoRAG comparison
│   └── package.json
│
├── dataset/                       # Research papers dataset
│   └── {paper_id}/
│       └── v1/
│           ├── meta.json          # Paper metadata
│           ├── paper.itg.json     # Paper content
│           └── reviews.json       # Human reviews
│
├── docker-compose.yml             # Qdrant database
├── .env.example                   # Environment template
└── package.json
```

## Prerequisites

- **Node.js** >= 18.x
- **Docker** (for Qdrant vector database)
- **API Keys**:
  - OpenAI API key
  - Anthropic API key

## Installation

### 1. Clone and install dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
# Copy example config
cp .env.example .env

# Edit with your API keys
nano .env
```

Required environment variables:

```env
# API Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Models (recommended configuration)
GENERATION_MODEL=gpt-5-2025-08-07
CLAIM_EXTRACTION_MODEL=claude-sonnet-4-5-20250514
CLAIM_VALIDATION_MODEL=gpt-5-mini-2025-08-07
JUDGE_MODEL=claude-opus-4-5-20251101

# Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=paper_chunks

# Dataset
DATASET_PATH=./dataset
MAX_PAPERS=75
```

### 3. Start Qdrant database

```bash
docker compose up -d
```

### 4. Start the application

```bash
# Start backend (port 3000)
npm run start:dev

# In another terminal, start frontend (port 5173)
cd frontend && npm run dev
```

## API Endpoints

### Main Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/papers` | List all loaded papers |
| `GET` | `/experiment/single?index=0` | Run experiment on single paper |
| `GET` | `/experiment/batch?count=3` | Run batch experiment on N papers |

### Test Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/claims/extract` | Test claim extraction |
| `POST` | `/nli/test?paperId=X` | Test NLI hallucination detection |
| `POST` | `/judge/test?paperId=X` | Test LLM Judge |
| `POST` | `/embedding/test?paperId=X` | Test embedding similarity |
| `POST` | `/compare/test?paperId=X` | Compare all detection methods |
| `GET` | `/pipeline/claims?index=0` | Run claims pipeline |

## Testing the API

### List available papers

```bash
curl http://localhost:3000/papers
```

### Run single experiment

```bash
# Run experiment on first paper (index 0)
curl http://localhost:3000/experiment/single?index=0
```

### Run batch experiment

```bash
# Run experiment on 5 papers
curl http://localhost:3000/experiment/batch?count=5
```

### Test claim extraction

```bash
curl -X POST http://localhost:3000/claims/extract \
  -H "Content-Type: application/json" \
  -d '{
    "review": "The paper presents a novel approach to neural network pruning. The authors achieve 95% compression with only 2% accuracy loss on ImageNet."
  }'
```

### Test LLM Judge

```bash
# Get a paper ID first from /papers endpoint
curl -X POST "http://localhost:3000/judge/test?paperId=PAPER_ID_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "claim": "The model achieves 95% accuracy on the test set."
  }'
```

### Compare all hallucination methods

```bash
curl -X POST "http://localhost:3000/compare/test?paperId=PAPER_ID_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "claim": "The proposed method outperforms all baselines."
  }'
```

## Metrics

The system computes the following metrics for each generated review:

| Metric | Formula | Description |
|--------|---------|-------------|
| **Hallucination Rate** | `(NOT_SUPPORTED + CONTRADICTED) / Total` | Percentage of ungrounded claims |
| **Grounding Score** | `(SUPPORTED + 0.5×PARTIAL) / Total` | How well claims are supported |
| **Claim Density** | `Claims / Word Count` | Claims per word in review |
| **Avg Confidence** | `Mean(confidence scores)` | Average LLM confidence |

### Verdict Categories

- **SUPPORTED**: Claim fully supported by paper evidence
- **PARTIALLY_SUPPORTED**: Claim partially correct but missing nuance
- **NOT_SUPPORTED**: Evidence doesn't address the claim
- **CONTRADICTED**: Evidence directly opposes the claim

## Model Configuration

The system uses different models for different tasks to avoid provider bias:

| Task | Provider | Recommended Model | Reasoning |
|------|----------|-------------------|-----------|
| Review Generation | OpenAI | GPT-5 | Creative text generation |
| Claim Extraction | Anthropic | Claude Sonnet 4.5 | Structured output accuracy |
| Claim Validation | OpenAI | GPT-5 Mini | Cross-provider validation |
| LLM Judge | Anthropic | Claude Opus 4.5 | Deep reasoning for verdicts |

## Dataset

This project uses the **NLPeer** dataset, a multi-domain corpus of peer reviews for NLP research.

**Repository**: [https://github.com/UKPLab/nlpeer](https://github.com/UKPLab/nlpeer)

## License

UNLICENSED - Private research project
