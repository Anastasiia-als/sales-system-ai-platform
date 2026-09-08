// js/portal/api/ai-gateway.js
// Phase 8A: Core AI Gateway, Provider Abstraction, Quotas, Schemas & Audit Logging

const { Pool } = require('pg');

const ALLOWED_PROVIDERS = ['gemini', 'mock'];
const ALLOWED_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

class AIGateway {
    constructor(options = {}) {
        this.pool = options.pool || new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
        });
        this.defaultProvider = options.defaultProvider || 'gemini';
        this.defaultModel = options.defaultModel || 'gemini-2.5-flash';
        this.requestTimeoutMs = options.requestTimeoutMs || 30000;
    }

    /**
     * Comprehensive Content-Level DLP / Sanitizer
     * Masks PII, financial info, tokens, passwords, and API keys before sending to LLM or persisting logs
     */
    sanitizeContent(input) {
        if (input == null) return input;
        if (typeof input === 'object') {
            if (Array.isArray(input)) {
                return input.map(item => this.sanitizeContent(item));
            }
            const sanitizedObj = {};
            for (const [k, v] of Object.entries(input)) {
                sanitizedObj[k] = this.sanitizeContent(v);
            }
            return sanitizedObj;
        }
        if (typeof input !== 'string') return input;

        let text = input;

        // 1. Secrets / Auth tokens / JWTs / API Keys:
        // JWT tokens (eyJ...)
        text = text.replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, '[REDACTED_SECRET]');
        // Google AI / Cloud API keys (AIza...)
        text = text.replace(/\bAIza[0-9A-Za-z-_]{30,45}\b/g, '[REDACTED_SECRET]');
        // OpenAI / Anthropic / Generic API keys (sk-...)
        text = text.replace(/\bsk-(?:live|test|proj|ant)?[a-zA-Z0-9_-]{20,}\b/g, '[REDACTED_SECRET]');
        // Telegram Bot tokens (digits:alphanumeric)
        text = text.replace(/\b\d{8,12}:[a-zA-Z0-9_-]{30,45}\b/g, '[REDACTED_SECRET]');
        // Bearer headers
        text = text.replace(/Bearer\s+[a-zA-Z0-9_.\-~+/=]{20,}/gi, 'Bearer [REDACTED_SECRET]');
        // Key-value pairs for passwords, tokens, secrets
        text = text.replace(/\b(?:secret|password|token|api_key|apikey|webhook_secret)\s*[:=]\s*['"]?([^\s'"]{6,})['"]?/gi, (match, val) => {
            return match.replace(val, '[REDACTED_SECRET]');
        });

        // 2. Financial data:
        // IBAN (International Bank Account Number)
        text = text.replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, '[REDACTED_FINANCIAL]');
        // Payment Card numbers (13-19 digits with optional hyphens/spaces)
        text = text.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[REDACTED_FINANCIAL]');

        // 3. Email addresses:
        text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');

        // 4. Phone numbers (Ukrainian and international):
        text = text.replace(/(?:\+380|0)\s*\(?\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}\b/g, '[REDACTED_PHONE]');
        text = text.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');

        return text;
    }

    /**
     * Resolve template from DB
     */
    async getTemplate(templateKey) {
        const res = await this.pool.query(
            "SELECT template_key, title, system_prompt, user_prompt_template, expected_schema, temperature FROM public.ai_prompt_templates WHERE template_key = $1 AND is_active = true",
            [templateKey]
        );
        if (res.rows.length === 0) {
            throw new Error(`AI Prompt Template '${templateKey}' not found or inactive`);
        }
        return res.rows[0];
    }

    /**
     * Interpolate variables into template string: {{variable_name}}
     */
    interpolatePrompt(templateStr, variables = {}) {
        let result = templateStr;
        for (const [key, val] of Object.entries(variables)) {
            const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            const replacement = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val != null ? val : '');
            result = result.replace(pattern, replacement);
        }
        return result;
    }

    /**
     * Basic JSON Schema validator (zero-dependency)
     */
    validateSchema(data, schema) {
        if (!schema || typeof schema !== 'object') return { valid: true };

        if (schema.type === 'object') {
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                return { valid: false, error: `Expected object, got ${Array.isArray(data) ? 'array' : typeof data}` };
            }
            if (Array.isArray(schema.required)) {
                for (const reqKey of schema.required) {
                    if (data[reqKey] === undefined || data[reqKey] === null) {
                        return { valid: false, error: `Missing required property: '${reqKey}'` };
                    }
                }
            }
            if (schema.properties) {
                for (const [propKey, propSchema] of Object.entries(schema.properties)) {
                    if (data[propKey] !== undefined) {
                        const propVal = data[propKey];
                        if (propSchema.type === 'string' && typeof propVal !== 'string') {
                            return { valid: false, error: `Property '${propKey}' must be a string` };
                        }
                        if (propSchema.type === 'number' && typeof propVal !== 'number') {
                            return { valid: false, error: `Property '${propKey}' must be a number` };
                        }
                        if (propSchema.type === 'boolean' && typeof propVal !== 'boolean') {
                            return { valid: false, error: `Property '${propKey}' must be a boolean` };
                        }
                        if (propSchema.type === 'array') {
                            if (!Array.isArray(propVal)) {
                                return { valid: false, error: `Property '${propKey}' must be an array` };
                            }
                            if (propSchema.items && propSchema.items.type === 'object') {
                                for (let i = 0; i < propVal.length; i++) {
                                    const subCheck = this.validateSchema(propVal[i], propSchema.items);
                                    if (!subCheck.valid) {
                                        return { valid: false, error: `Array '${propKey}[${i}]' invalid: ${subCheck.error}` };
                                    }
                                }
                            }
                        }
                        if (Array.isArray(propSchema.enum) && !propSchema.enum.includes(propVal)) {
                            return { valid: false, error: `Property '${propKey}' value '${propVal}' not in allowed enum: [${propSchema.enum.join(', ')}]` };
                        }
                    }
                }
            }
        }
        return { valid: true };
    }

    /**
     * Dispatch structured generation request
     */
    async generateStructured({
        organizationId,
        projectId = null,
        userId = null,
        featureName,
        templateKey,
        variables = {},
        provider = null,
        model = null,
        estimatedTokens = 1500
    }) {
        if (!organizationId) throw new Error("organizationId is required");
        if (!featureName) throw new Error("featureName is required");
        if (!templateKey) throw new Error("templateKey is required");

        const targetProvider = provider || this.defaultProvider;
        const targetModel = model || this.defaultModel;

        // Security Check: Provider and Model Allowlist
        if (!ALLOWED_PROVIDERS.includes(targetProvider)) {
            const err = new Error(`Provider '${targetProvider}' is not allowed. Approved providers: [${ALLOWED_PROVIDERS.join(', ')}]`);
            err.code = 'INVALID_PROVIDER';
            throw err;
        }
        if (!ALLOWED_MODELS.includes(targetModel)) {
            const err = new Error(`Model '${targetModel}' is not allowed. Approved models: [${ALLOWED_MODELS.join(', ')}]`);
            err.code = 'INVALID_MODEL';
            throw err;
        }

        // Server-Side Bounded Quota Estimation (cannot be bypassed by client-spoofed small values)
        const rawPayloadSize = JSON.stringify(variables || {}).length;
        const computedTokens = Math.max(500, Math.min(10000, Math.ceil(rawPayloadSize / 3) + 1200));
        const effectiveEstimatedTokens = Math.max(computedTokens, Number(estimatedTokens) || 0);

        const startTime = Date.now();

        // 1. Fetch template
        const tpl = await this.getTemplate(templateKey);
        const systemPrompt = tpl.system_prompt;
        
        // DLP Sanitization before prompt interpolation
        const sanitizedVariables = this.sanitizeContent(variables);
        const userPrompt = this.interpolatePrompt(tpl.user_prompt_template, sanitizedVariables);
        const expectedSchema = tpl.expected_schema;
        const temperature = tpl.temperature || 0.2;

        // 2. Check & consume quota (via service_role / pool)
        const quotaRes = await this.pool.query(
            "SELECT public.check_and_consume_ai_quota($1, $2) as q",
            [organizationId, effectiveEstimatedTokens]
        );
        const quotaCheck = quotaRes.rows[0].q;
        if (!quotaCheck.allowed) {
            const latency = Date.now() - startTime;
            await this.pool.query(`
                SELECT public.record_ai_generation_log($1, $2, $3, $4, $5, $6, $7, 0, 0, $8, 'quota_exceeded', $9, 0)
            `, [organizationId, projectId, userId, featureName, templateKey, targetProvider, targetModel, latency, `Quota error: ${quotaCheck.reason}`]);

            const err = new Error(`AI Quota Exceeded: ${quotaCheck.reason}`);
            err.code = 'QUOTA_EXCEEDED';
            err.quota = quotaCheck;
            throw err;
        }

        // 3. Dispatch to Provider
        let rawResponseText = null;
        let promptTokens = 0;
        let completionTokens = 0;

        try {
            if (targetProvider === 'mock' || process.env.AI_MOCK_TRANSPORT === 'true') {
                const mockResult = this._generateMockResponse(templateKey, sanitizedVariables);
                rawResponseText = JSON.stringify(mockResult.data);
                promptTokens = mockResult.promptTokens || 120;
                completionTokens = mockResult.completionTokens || 85;
            } else if (targetProvider === 'gemini') {
                const geminiResult = await this._callGeminiAPI({
                    systemPrompt,
                    userPrompt,
                    expectedSchema,
                    temperature,
                    model: targetModel
                });
                rawResponseText = geminiResult.text;
                promptTokens = geminiResult.promptTokens;
                completionTokens = geminiResult.completionTokens;
            } else {
                throw new Error(`Unsupported AI Provider: '${targetProvider}'`);
            }

            // 4. Parse JSON
            let parsedData;
            try {
                let cleaned = rawResponseText.trim();
                if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
                parsedData = JSON.parse(cleaned);
            } catch (jsonErr) {
                const latency = Date.now() - startTime;
                await this.pool.query(`
                    SELECT public.record_ai_generation_log($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'schema_invalid', $11, $12)
                `, [organizationId, projectId, userId, featureName, templateKey, targetProvider, targetModel, promptTokens, completionTokens, latency, `Malformed JSON: ${jsonErr.message}`, effectiveEstimatedTokens]);

                const err = new Error(`AI generated malformed JSON: ${jsonErr.message}`);
                err.code = 'MALFORMED_JSON';
                throw err;
            }

            // 5. Validate Schema
            const schemaCheck = this.validateSchema(parsedData, expectedSchema);
            if (!schemaCheck.valid) {
                const latency = Date.now() - startTime;
                await this.pool.query(`
                    SELECT public.record_ai_generation_log($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'schema_invalid', $11, $12)
                `, [organizationId, projectId, userId, featureName, templateKey, targetProvider, targetModel, promptTokens, completionTokens, latency, `Schema violation: ${schemaCheck.error}`, effectiveEstimatedTokens]);

                const err = new Error(`AI output violated schema: ${schemaCheck.error}`);
                err.code = 'SCHEMA_VIOLATION';
                throw err;
            }

            // 6. Success: record log and reconcile quota
            const latency = Date.now() - startTime;
            const logRes = await this.pool.query(`
                SELECT public.record_ai_generation_log($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'success', NULL, $11) as log_id
            `, [organizationId, projectId, userId, featureName, templateKey, targetProvider, targetModel, promptTokens, completionTokens, latency, effectiveEstimatedTokens]);

            return {
                ok: true,
                logId: logRes.rows[0].log_id,
                data: parsedData,
                provider: targetProvider,
                model: targetModel,
                usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                    latencyMs: latency
                }
            };
        } catch (execErr) {
            const latency = Date.now() - startTime;
            if (execErr.code !== 'QUOTA_EXCEEDED' && execErr.code !== 'MALFORMED_JSON' && execErr.code !== 'SCHEMA_VIOLATION') {
                const sanitizedErrMsg = this.sanitizeContent(execErr.message);
                await this.pool.query(`
                    SELECT public.record_ai_generation_log($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'failed', $11, $12)
                `, [organizationId, projectId, userId, featureName, templateKey, targetProvider, targetModel, promptTokens, completionTokens, latency, sanitizedErrMsg, effectiveEstimatedTokens]);
            }
            throw execErr;
        }
    }

    /**
     * Google Gemini REST API Client
     */
    async _callGeminiAPI({ systemPrompt, userPrompt, expectedSchema, temperature, model }) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY environment variable is not configured");
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [{ text: userPrompt }]
                }
            ],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: temperature || 0.2,
                responseMimeType: "application/json"
            }
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);

        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!resp.ok) {
                const errBody = await resp.text();
                // Never leak API key in error messages
                const safeErr = this.sanitizeContent(errBody).replace(new RegExp(apiKey, 'g'), '[REDACTED_API_KEY]');
                throw new Error(`Gemini API HTTP ${resp.status}: ${safeErr}`);
            }

            const json = await resp.json();
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("Empty content in Gemini API response");

            const usageMetadata = json.usageMetadata || {};
            return {
                text,
                promptTokens: usageMetadata.promptTokenCount || 0,
                completionTokens: usageMetadata.candidatesTokenCount || 0
            };
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Deterministic Mock Provider for Testing / Offline Execution
     */
    _generateMockResponse(templateKey, variables = {}) {
        if (templateKey === 'meeting_intelligence_v1') {
            return {
                promptTokens: 250,
                completionTokens: 180,
                data: {
                    summary: `Узгоджено ключові вимоги для проєкту ${variables.project_name || 'Project'} та розподілено задачі між командою делівері та клієнтом.`,
                    decisions: [
                        "Затвердити структуру ролей та розклад щотижневих синків",
                        "Підготувати комерційні умови та план оплат на наступний спринт"
                    ],
                    candidate_actions: [
                        {
                            title: "Підготувати оновлену технічну специфікацію",
                            description: "Внести зміни згідно з коментарями щодо інтеграції зовнішніх сервісів",
                            responsibility: "internal",
                            priority: "high"
                        },
                        {
                            title: "Надати тестові доступи до Google Calendar",
                            description: "Надіслати сервісний обліковий запис для перевірки підписок",
                            responsibility: "client",
                            priority: "medium"
                        }
                    ]
                }
            };
        }

        if (templateKey === 'project_health_analysis_v1') {
            return {
                promptTokens: 180,
                completionTokens: 140,
                data: {
                    health_verdict: "on_track",
                    executive_summary: `Проєкт ${variables.project_name || 'Project'} рухається згідно із запланованим графіком. Прогрес становить ${variables.stage_progress_pct || 75}%.`,
                    risk_factors: [
                        "Потенційна затримка з погодженням другої ітерації дизайну клієнтом"
                    ],
                    recommended_interventions: [
                        "Запланувати короткий чек-ін з клієнтом за 48 годин до дедлайну етапу"
                    ]
                }
            };
        }

        // Generic mock fallback
        return {
            promptTokens: 50,
            completionTokens: 50,
            data: { message: "Mock response", variables }
        };
    }
}

module.exports = { AIGateway, ALLOWED_PROVIDERS, ALLOWED_MODELS };
