import type { ChatLLM, ChatMessage, LLM } from './types.js';
import { silentLogger, type Logger } from './logger.js';

export interface OpenAIClientsConfig {
    apiKey?: string;
    baseURL?: string;
    actorModel: string;  // e.g., "gpt-5-mini"
    judgeModel: string;  // e.g., "gpt-5-mini"
    temperature?: number;
    maxTokens?: number;
}

/** Minimal OpenAI client (global fetch). Responses API for actor; Chat Completions for judge. */
export function makeOpenAIClients(cfg: OpenAIClientsConfig, logger: Logger = silentLogger): { actorLLM: LLM; chatLLM: ChatLLM } {
    const base = cfg.baseURL ?? 'https://api.openai.com/v1';
    const key = cfg.apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY missing');
    
    async function http<T>(path: string, body: unknown): Promise<T> {
        const r = await fetch(base + path, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const j = await r.json();
        if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(j)}`);
        logger.debug(`HTTP ${path} ok`);
        return j as T;
    }

    // Responses API: recommended for GPT-5 series
    async function responses(model: string, input: string, opts?: { temperature?: number; maxTokens?: number; reasoningEffort?: 'minimal' | 'medium' | 'maximal' }): Promise<string> {
        type ResponsesShape = { output_text?: string; output?: any; choices?: Array<{ message?: { content?: string } }> };
        const isGpt5 = /^gpt-5/i.test(model);
        const body: Record<string, unknown> = {
            model,
            input,
            temperature: opts?.temperature ?? cfg.temperature ?? 0.7,
            max_output_tokens: opts?.maxTokens ?? cfg.maxTokens ?? 512
        };
        if (isGpt5) {
            delete body.temperature;
            body.reasoning = { effort: opts?.reasoningEffort ?? 'minimal' };
        }
        logger.debug(`Responses call model=${model}`);
        const j = await http<ResponsesShape>('/responses', body);
        if (typeof j.output_text === 'string') return j.output_text;
        if (Array.isArray(j.output) && (j as any).output?.[0]?.content?.[0]?.text) return (j as any).output[0].content[0].text as string;
        if (j.choices?.[0]?.message?.content) return j.choices[0].message!.content!;
        return JSON.stringify(j);
    }

    // Chat Completions: judge (multi-message)
    async function chat(model: string, messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
        type ChatShape = { choices?: Array<{ message?: { content?: string } }> };
        const isGpt5 = /^gpt-5/i.test(model);
        // For GPT-5 models, use the Responses API instead of Chat Completions (reasoning params not supported there)
        if (isGpt5) {
            const prompt = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n');
            return responses(model, prompt, { maxTokens: opts?.maxTokens ?? cfg.maxTokens ?? 512, temperature: opts?.temperature ?? cfg.temperature ?? 0.2, reasoningEffort: 'minimal' });
        }

        const body: Record<string, unknown> = {
            model,
            messages,
            temperature: opts?.temperature ?? cfg.temperature ?? 0.2,
            // Chat Completions expects `max_tokens`
            max_tokens: opts?.maxTokens ?? cfg.maxTokens ?? 512
        };

        logger.debug(`Chat call model=${model}`);
        const j = await http<ChatShape>('/chat/completions', body);
        return j.choices?.[0]?.message?.content ?? '';
    }

    const actorLLM: LLM = { complete: (prompt: string) => responses(cfg.actorModel, prompt) };
    const chatLLM: ChatLLM = { chat: (messages, opts) => chat(cfg.judgeModel, messages, opts) };
    return { actorLLM, chatLLM };
}


