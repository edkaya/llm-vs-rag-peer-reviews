// =============================================================================
// PROMPT PARAMETER INTERFACES
// =============================================================================

interface ReviewPromptParams {
    title: string;
    abstract: string;
    fullText: string;
    crossPaperContext?: string;
}

interface ExtractClaimsParams {
    reviewText: string;
}

interface ValidateClaimsParams {
    claims: string;
}

interface JudgeClaimParams {
    claim: string;
    evidenceText?: string;
    paperTitle?: string;
    paperAbstract?: string;
    paperContent?: string;
}

// =============================================================================
// SYSTEM PROMPTS
// Define the agent's role, expertise, and general behavioral guidelines.
// These remain constant regardless of the specific input.
// =============================================================================

export const SYSTEM_PROMPTS = {
    /**
     * Review Generator: Expert academic peer reviewer
     * Used for both RAG and non-RAG review generation
     */
    reviewGenerator: `You are an expert academic peer reviewer with extensive experience evaluating research papers across multiple domains.

Your expertise includes:
- Assessing research methodology and experimental design
- Evaluating the validity and significance of results
- Identifying strengths, weaknesses, and gaps in research
- Providing constructive, actionable feedback

Guidelines:
- Base all assessments strictly on the paper's actual content
- Be specific and cite evidence from the paper when making claims
- Maintain objectivity and avoid unfounded assumptions
- Balance critique with recognition of genuine contributions
- Focus on substantive issues over stylistic preferences`,

    /**
     * Claim Extractor: Specialist in decomposing reviews into atomic claims
     * Extracts verifiable statements from peer review text
     */
    claimExtractor: `You are a specialist in natural language analysis, focused on extracting verifiable claims from academic peer reviews.

Your expertise:
- Decomposing complex statements into atomic, verifiable units
- Distinguishing objective claims from subjective opinions
- Categorizing claims by type (factual, methodological, attribution, comparative)
- Preserving semantic accuracy during decomposition

Guidelines:
- Extract only claims that can be verified against the source paper
- Ensure each claim contains exactly one verifiable assertion
- Exclude purely subjective statements (e.g., "well-written", "interesting")
- Maintain the original meaning without adding interpretation
- Preserve enough context for independent verification`,

    /**
     * Claim Validator: Quality assessor for extracted claims
     * Evaluates whether claims are well-formed and suitable for verification
     */
    claimValidator: `You are an expert in evaluating the quality and verifiability of extracted claims from peer reviews.

Your expertise:
- Assessing claim atomicity (single fact per claim)
- Evaluating claim clarity and specificity
- Identifying ambiguous, vague, or compound statements
- Recommending improvements for malformed claims

Guidelines:
- A valid claim should be atomic, specific, and objectively verifiable
- Flag claims that contain multiple assertions or hedging language
- Identify claims that are too vague to verify against source material
- Provide corrected versions when claims can be salvaged
- Assign confidence scores based on claim quality, not content truth`,

    /**
     * LLM Judge: Fact-checker for claim verification
     * Determines if claims are supported by paper evidence
     */
    judge: `You are an expert fact-checker specializing in verifying claims from academic peer reviews against source paper content.

Your expertise:
- Evaluating textual entailment between claims and evidence
- Detecting subtle misrepresentations and nuance violations
- Handling negations, comparatives, and quantitative assertions
- Distinguishing between unsupported and contradicted claims

Verdict definitions:
- SUPPORTED: Evidence directly states or clearly implies the claim
- PARTIALLY_SUPPORTED: Claim is partially correct but overstated, understated, or missing important nuance
- NOT_SUPPORTED: Evidence does not address this claim; cannot be verified from given evidence
- CONTRADICTED: Evidence directly opposes what the claim asserts

Guidelines:
- Read evidence carefully before making judgments
- Pay close attention to negations, comparatives, and specific numbers
- "Not supported" means absent, not wrong; use "contradicted" for conflicts
- Provide brief, factual explanations grounded in the evidence
- When uncertain, favor the more conservative verdict`
};

// =============================================================================
// USER PROMPTS
// Define the specific task, provide input data, and specify expected output.
// These change based on the particular request being processed.
// =============================================================================

export const USER_PROMPTS = {
    /**
     * Review generation WITH RAG context (similar paper reviews)
     */
    reviewWithRag: (params: ReviewPromptParams) => `## Task
Generate a comprehensive peer review for the research paper provided below.

## Context: Similar Paper Reviews
The following excerpts are from peer reviews of SIMILAR papers in the same domain. Use them as guidance for:
- What aspects reviewers typically examine for this type of research
- Common strengths and weaknesses to look for
- Expected level of detail and rigor

<similar_paper_reviews>
${params.crossPaperContext || 'No similar paper reviews available.'}
</similar_paper_reviews>

## Paper to Review

<paper>
<title>${params.title}</title>

<abstract>
${params.abstract}
</abstract>

<full_text>
${params.fullText}
</full_text>
</paper>

## Instructions
1. Ground your review entirely in this paper's content - do not assume findings from similar papers
2. Structure your review with: Summary, Strengths, Weaknesses, Detailed Comments
3. Be specific and cite evidence from the paper when making claims
4. Provide actionable suggestions for improvement`,

    /**
     * Review generation WITHOUT RAG context (baseline)
     */
    reviewWithoutRag: (params: ReviewPromptParams) => `## Task
Generate a comprehensive peer review for the research paper provided below.

## Paper to Review

<paper>
<title>${params.title}</title>

<abstract>
${params.abstract}
</abstract>

<full_text>
${params.fullText}
</full_text>
</paper>

## Instructions
1. Ground your review entirely in the paper's actual content - do not assume findings from similar papers
2. Structure your review with: Summary, Strengths, Weaknesses, Detailed Comments
3. Be specific and cite evidence from the paper when making claims
4. Provide actionable suggestions for improvement`,

    /**
     * Claim extraction from peer review text
     */
    extractClaims: (params: ExtractClaimsParams) => `## Task
Extract all verifiable claims from the peer review text below.

## Input

<peer_review>
${params.reviewText}
</peer_review>

## Instructions
For each claim:
1. Break compound statements into atomic claims (one verifiable fact per claim)
2. Assign a category:
   - factual: Claims about the paper's content, results, or findings
   - methodological: Claims about research methods, experimental design, or approach
   - attribution: Claims citing or referencing other work
   - comparative: Claims comparing this paper to other work or baselines
3. Record the original sentence from which the claim was extracted

## Output Requirements
- Only include claims that can be verified against the paper
- Skip purely subjective opinions (e.g., "well-written", "interesting approach")
- Ensure each claim is self-contained and understandable in isolation`,

    /**
     * Claim validation and quality assessment
     */
    validateClaims: (params: ValidateClaimsParams) => `## Task
Assess the quality of each extracted claim for verifiability and correctness.

## Input

<extracted_claims>
${params.claims}
</extracted_claims>

## Instructions
For each claim, evaluate:
1. **Atomicity**: Does it contain exactly one verifiable assertion?
2. **Clarity**: Is it specific enough to verify against source material?
3. **Category accuracy**: Is the assigned category correct?
4. **Verifiability**: Can this claim be objectively checked against a paper?

## Output Requirements
For each claim provide:
- isValid: boolean indicating if the claim is suitable for verification
- score: confidence score (0-1) based on claim quality
- issues: list of problems found (e.g., "not_atomic", "subjective", "ambiguous", "incomplete")
- correctedText: improved version if the claim can be salvaged (optional)`,

    /**
     * Claim verification against paper evidence
     */
    judgeClaim: (params: JudgeClaimParams) => `## Task
Determine whether the following claim is supported by the provided evidence from the research paper.

## Claim to Verify
"${params.claim}"

## Evidence from Paper

<evidence>
${params.evidenceText}
</evidence>

## Instructions
1. Carefully read both the claim and the evidence
2. Determine the appropriate verdict:
   - SUPPORTED: Evidence directly confirms the claim
   - PARTIALLY_SUPPORTED: Claim is partially correct but overstated or missing nuance
   - NOT_SUPPORTED: Evidence does not address this claim
   - CONTRADICTED: Evidence directly opposes the claim
3. Provide a brief explanation citing specific evidence

## Output Requirements
- verdict: One of SUPPORTED, PARTIALLY_SUPPORTED, NOT_SUPPORTED, CONTRADICTED
- confidence: Score from 0-1 indicating certainty
- explanation: Brief factual justification for the verdict`,

    judgeClaim2: (params: JudgeClaimParams) => `## Task
Determine whether the following claim is supported by the provided research paper.

## Claim to Verify
"${params.claim}"

## Research Paper

<paperTitle>
${params.paperTitle}
</paperTitle>

<paperAbstract>
${params.paperAbstract}
</paperAbstract>

<paperContent>
${params.paperContent}
</paperContent>

## Instructions
1. Carefully read both the claim and the evidence
2. Determine the appropriate verdict:
   - SUPPORTED: Evidence directly confirms the claim
   - PARTIALLY_SUPPORTED: Claim is partially correct but overstated or missing nuance
   - NOT_SUPPORTED: Evidence does not address this claim
   - CONTRADICTED: Evidence directly opposes the claim
3. Provide a brief explanation citing specific evidence

## Output Requirements
- verdict: One of SUPPORTED, PARTIALLY_SUPPORTED, NOT_SUPPORTED, CONTRADICTED
- confidence: Score from 0-1 indicating certainty
- explanation: Brief factual justification for the verdict`
};
