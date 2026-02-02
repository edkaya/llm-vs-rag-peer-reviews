// src/stats/stats.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

type TTestResult = {
    n: number;
    meanNoRag: number;
    meanRag: number;
    meanDelta: number; // rag - norag
    t: number;
    df: number;
    p: number;
};

@Injectable()
export class StatsService {
    private readonly csvPath = path.join(process.cwd(), 'results', 'results_2026-01-09_0e9a191a.csv');

    async runPairedTTests() {
        const records = this.readCsv(this.csvPath);
        if (!records.length) {
            return { error: `CSV is empty: ${this.csvPath}` };
        }

        const pairs: Record<string, [string, string]> = {
            llm_judge_hr: ['llm_norag_hallucination_rate', 'llm_rag_hallucination_rate'],
            nli_hr: ['nli_norag_hallucination_rate', 'nli_rag_hallucination_rate'],
            llm_judge_cd: ['llm_norag_claim_density', 'llm_rag_claim_density'],
            nli_cd: ['nli_norag_claim_density', 'nli_rag_claim_density'],
            llm_judge_ac: ['llm_norag_avg_confidence', 'llm_rag_avg_confidence'],
            nli_ac: ['nli_norag_avg_confidence', 'nli_rag_avg_confidence']
        };

        const out: Record<string, TTestResult> = {};
        for (const [name, [noRagCol, ragCol]] of Object.entries(pairs)) {
            out[name] = this.pairedTTest(records, noRagCol, ragCol);
        }

        // Write results to CSV
        const outputPath = this.writeTTestResultsCsv(out);

        return {
            csv: this.csvPath,
            outputCsv: outputPath,
            alpha: 0.05,
            note: 'Paired t-test uses per-row paired samples; meanDelta = mean(RAG - NoRAG).',
            results: out
        };
    }

    private writeTTestResultsCsv(results: Record<string, TTestResult>): string {
        const header = 'metric,n,mean_norag,mean_rag,mean_delta,t,df,p,significant';
        const rows = Object.entries(results).map(([name, r]) => {
            const significant = r.p < 0.05 ? 'yes' : 'no';
            return `${name},${r.n},${r.meanNoRag},${r.meanRag},${r.meanDelta},${r.t},${r.df},${r.p},${significant}`;
        });

        const csvContent = [header, ...rows].join('\n');
        const outputPath = path.join(process.cwd(), 'results', 'ttest_results.csv');
        fs.writeFileSync(outputPath, csvContent, 'utf8');
        return outputPath;
    }

    private readCsv(csvPath: string): any[] {
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV not found: ${csvPath}`);
        }
        const content = fs.readFileSync(csvPath, 'utf8');
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        // Exclude AGGREGATED row
        return records.filter((r: any) => r.paper_id !== 'AGGREGATED');
    }

    private pairedTTest(records: any[], noRagCol: string, ragCol: string): TTestResult {
        const x: number[] = [];
        const y: number[] = [];

        for (const r of records) {
            const a = Number(r[noRagCol]);
            const b = Number(r[ragCol]);
            if (Number.isFinite(a) && Number.isFinite(b)) {
                x.push(a);
                y.push(b);
            }
        }

        const n = x.length;
        if (n < 2) {
            return { n, meanNoRag: NaN, meanRag: NaN, meanDelta: NaN, t: NaN, df: n - 1, p: NaN };
        }

        // differences d_i = y_i - x_i
        const d = y.map((val, i) => val - x[i]);
        const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

        const meanNoRag = mean(x);
        const meanRag = mean(y);
        const meanDelta = mean(d);

        // sample std of d
        const df = n - 1;
        const varD = d.reduce((s, v) => s + Math.pow(v - meanDelta, 2), 0) / df;
        const sdD = Math.sqrt(varD);

        // t-stat
        const se = sdD / Math.sqrt(n);
        const t = se === 0 ? 0 : meanDelta / se;

        // two-sided p-value via Student's t CDF
        const p = 2 * (1 - this.tCdf(Math.abs(t), df));

        return { n, meanNoRag, meanRag, meanDelta, t, df, p };
    }

    /**
     * Student t CDF approximation using the regularized incomplete beta function.
     * Implemented to avoid pulling heavy math libs.
     */
    private tCdf(t: number, v: number): number {
        // For t>=0
        // CDF = 1 - 0.5 * I_{v/(v+t^2)}(v/2, 1/2)
        const x = v / (v + t * t);
        const ib = this.regularizedIncompleteBeta(x, v / 2, 0.5);
        return 1 - 0.5 * ib;
    }

    // --- Beta function helpers (lightweight, good enough for stats reporting) ---

    private regularizedIncompleteBeta(x: number, a: number, b: number): number {
        // Continued fraction approximation (Numerical Recipes style)
        const bt =
            x === 0 || x === 1
                ? 0
                : Math.exp(
                      this.logGamma(a + b) - this.logGamma(a) - this.logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
                  );

        if (x < (a + 1) / (a + b + 2)) {
            return (bt * this.betaCf(x, a, b)) / a;
        } else {
            return 1 - (bt * this.betaCf(1 - x, b, a)) / b;
        }
    }

    private betaCf(x: number, a: number, b: number): number {
        const MAXIT = 200;
        const EPS = 3e-7;
        const FPMIN = 1e-30;

        let qab = a + b;
        let qap = a + 1;
        let qam = a - 1;
        let c = 1;
        let d = 1 - (qab * x) / qap;
        if (Math.abs(d) < FPMIN) d = FPMIN;
        d = 1 / d;
        let h = d;

        for (let m = 1; m <= MAXIT; m++) {
            let m2 = 2 * m;

            let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < FPMIN) d = FPMIN;
            c = 1 + aa / c;
            if (Math.abs(c) < FPMIN) c = FPMIN;
            d = 1 / d;
            h *= d * c;

            aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < FPMIN) d = FPMIN;
            c = 1 + aa / c;
            if (Math.abs(c) < FPMIN) c = FPMIN;
            d = 1 / d;
            const del = d * c;
            h *= del;

            if (Math.abs(del - 1) < EPS) break;
        }
        return h;
    }

    private logGamma(z: number): number {
        // Lanczos approximation
        const p = [
            676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
            -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
        ];
        if (z < 0.5) {
            return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - this.logGamma(1 - z);
        }
        z -= 1;
        let x = 0.99999999999980993;
        for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
        const t = z + p.length - 0.5;
        return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    }
}
