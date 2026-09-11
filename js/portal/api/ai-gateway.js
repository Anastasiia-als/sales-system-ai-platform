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
        this.env = options.env || process.env.NODE_ENV || 'development';
    }

    /**
     * Resolves active AI provider with strict server/environment authority:
     * - Production: requires live provider ('gemini'). If GEMINI_API_KEY is missing -> FAIL CLOSED (no mock fallback).
     * - Dev / Test / Manual Acceptance: defaults to controlled 'mock' provider while Gemini activation is PENDING_LIVE_ACTIVATION.
     */
    resolveTargetProvider(clientRequestedProvider = null) {
        const isProduction = (process.env.NODE_ENV === 'production') || (this.env === 'production');
        const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

        // 1. Production Mode: Strict Live Provider & Fail-Closed
        if (isProduction) {
            if (clientRequestedProvider === 'mock') {
                const err = new Error("Forbidden: Mock AI provider is disallowed in production environment");
                err.statusCode = 403;
                err.code = 'FORBIDDEN_PROVIDER';
                throw err;
            }
            if (!hasGeminiKey) {
                const err = new Error("Production Live AI provider error: GEMINI_API_KEY environment variable is not configured. Automated mock fallback is strictly forbidden in production.");
                err.statusCode = 503;
                err.code = 'LIVE_AI_UNAVAILABLE';
                throw err;
            }
            return 'gemini';
        }

        // 2. Non-Production Mode (Dev / Test / Manual Acceptance):
        // Explicit mock transport flag takes precedence
        if (process.env.AI_MOCK_TRANSPORT === 'true') {
            return 'mock';
        }

        // If client/caller explicitly requested gemini (e.g. live test):
        if (clientRequestedProvider === 'gemini') {
            if (!hasGeminiKey) {
                const err = new Error("Gemini live provider requested, but GEMINI_API_KEY is not configured");
                err.statusCode = 503;
                err.code = 'LIVE_AI_UNAVAILABLE';
                throw err;
            }
            return 'gemini';
        }

        if (clientRequestedProvider === 'mock') {
            return 'mock';
        }

        if (process.env.AI_PROVIDER === 'gemini' && hasGeminiKey) {
            return 'gemini';
        }

        // Default in non-production while Gemini is PENDING_LIVE_ACTIVATION:
        // Controlled mock provider without external API calls
        return 'mock';
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
        // Firstwin action tokens (fwa_...)
        text = text.replace(/\bfwa_[a-zA-Z0-9_-]{20,}\b/g, '[REDACTED_SECRET]');
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
     * Deterministic Participant De-Identification
     * Replaces real participant names in text with neutral aliases (e.g., PM, Designer, Client, Participant 1)
     */
    deidentifyParticipants(input, participantsMetadata = []) {
        if (!input || !participantsMetadata || participantsMetadata.length === 0) return input;
        if (typeof input === 'object') {
            if (Array.isArray(input)) {
                return input.map(item => this.deidentifyParticipants(item, participantsMetadata));
            }
            const res = {};
            for (const [k, v] of Object.entries(input)) {
                if (k === 'participants' || k === 'known_participants') {
                    if (Array.isArray(v)) {
                        res[k] = v.map((p, idx) => {
                            if (typeof p === 'object' && p !== null) {
                                return {
                                    role: p.role || p.alias || `Participant ${idx + 1}`,
                                    alias: p.alias || p.role || `Participant ${idx + 1}`
                                };
                            }
                            return typeof p === 'string' ? (participantsMetadata.find(m => m.name === p)?.alias || `Participant ${idx + 1}`) : p;
                        });
                        continue;
                    }
                }
                res[k] = this.deidentifyParticipants(v, participantsMetadata);
            }
            return res;
        }
        if (typeof input !== 'string') return input;

        let text = input;

        // Sort participants by name length descending to avoid partial matching
        const sorted = [...participantsMetadata].sort((a, b) => {
            const nameA = typeof a === 'string' ? a : a.name || '';
            const nameB = typeof b === 'string' ? b : b.name || '';
            return nameB.length - nameA.length;
        });

        for (let i = 0; i < sorted.length; i++) {
            const p = sorted[i];
            const name = (typeof p === 'string' ? p : p.name || '').trim();
            if (!name || name.length < 2) continue;

            const alias = (typeof p === 'object' && (p.alias || p.role)) ? (p.alias || p.role) : `Participant ${i + 1}`;

            // Replace full name (case-insensitive, unicode boundaries)
            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`(?<=^|[\\s.,!?;:()'"])${escapedName}(?=$|[\\s.,!?;:()'"])`, 'gi');
            text = text.replace(pattern, alias);

            // If name has multiple words (e.g., "Петро Іванов"), also replace individual first/last names if >= 3 characters
            const parts = name.split(/\s+/).filter(part => part.length >= 3);
            for (const part of parts) {
                const escapedPart = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const partPattern = new RegExp(`(?<=^|[\\s.,!?;:()'"])${escapedPart}(?=$|[\\s.,!?;:()'"])`, 'gi');
                text = text.replace(partPattern, alias);
            }
        }

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

        // Security Check: Provider and Model Allowlist
        if (provider && !ALLOWED_PROVIDERS.includes(provider)) {
            const err = new Error(`Provider '${provider}' is not allowed. Approved providers: [${ALLOWED_PROVIDERS.join(', ')}]`);
            err.code = 'INVALID_PROVIDER';
            err.statusCode = 400;
            throw err;
        }

        const targetProvider = this.resolveTargetProvider(provider);
        const targetModel = model || this.defaultModel;

        if (!ALLOWED_MODELS.includes(targetModel)) {
            const err = new Error(`Model '${targetModel}' is not allowed. Approved models: [${ALLOWED_MODELS.join(', ')}]`);
            err.code = 'INVALID_MODEL';
            err.statusCode = 400;
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
        
        // DLP Sanitization + Deterministic Participant De-Identification before prompt interpolation
        let sanitizedVariables = this.sanitizeContent(variables);
        const participantsMetadata = variables.participants || variables.known_participants || [];
        if (Array.isArray(participantsMetadata) && participantsMetadata.length > 0) {
            sanitizedVariables = this.deidentifyParticipants(sanitizedVariables, participantsMetadata);
        }
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

    _extractMeetingProtocolFromRawNotes(rawNotes = '', variables = {}) {
        const text = String(rawNotes || '').trim();
        if (!text) {
            return {
                summary: "Зустріч проведено без додаткових нотаток.",
                decisions: [],
                candidate_actions: []
            };
        }

        const rawSentences = text
            .split(/(?<=[.!?])\s+|\n+|(?:;\s*)/)
            .map(s => s.trim())
            .filter(s => s.length > 3);

        const decisions = [];
        const candidateActions = [];
        const discussionPoints = [];

        const ukrMonths = {
            'січня': '01', 'лютого': '02', 'березня': '03', 'квітня': '04',
            'травня': '05', 'червня': '06', 'липня': '07', 'серпня': '08',
            'вересня': '09', 'жовтня': '10', 'листопада': '11', 'грудня': '12'
        };

        const currentYear = new Date().getFullYear();

        function parseDueDate(sentence) {
            const monthMatch = sentence.match(/(?:до|на|термін)\s+(\d{1,2})\s+(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)/iu);
            if (monthMatch) {
                const day = monthMatch[1].padStart(2, '0');
                const month = ukrMonths[monthMatch[2].toLowerCase()];
                if (month) return `${currentYear}-${month}-${day}`;
            }
            const numMatch = sentence.match(/(?:до|на)\s+(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/iu);
            if (numMatch) {
                const day = numMatch[1].padStart(2, '0');
                const month = numMatch[2].padStart(2, '0');
                const year = numMatch[3] ? (numMatch[3].length === 2 ? `20${numMatch[3]}` : numMatch[3]) : currentYear;
                return `${year}-${month}-${day}`;
            }
            const isoMatch = sentence.match(/\b(\d{4}-\d{2}-\d{2})\b/);
            if (isoMatch) return isoMatch[1];
            return null;
        }

        for (const sentence of rawSentences) {
            const cleanSentence = sentence.replace(/[.!?]+$/, '').trim();

            // 1. Decision Matchers
            const isExplicitDecision = /^(?:рішення|погоджено|погодилися|decision)[:\s]/iu.test(cleanSentence);
            const startsWithDecision = /^(?:також\s+)?(?:погодили|вирішили|домовилися|затвердили|прийнято рішення|узгодили)(?!\p{L})/iu.test(cleanSentence);
            const containsDecision = /(?<!\p{L})(?:вирішили|погодили|домовилися|затвердили|прийнято рішення|узгодили|також погодили)(?!\p{L})/iu.test(cleanSentence);

            // 2. Action Matchers
            const isExplicitAction = /^(?:дія\s*\d*|завдання|задача|action\s*\d*|task|todo)[:\s]/iu.test(cleanSentence);
            const startsWithAction = /^(?:потрібно|необхідно|слід)(?!\p{L})/iu.test(cleanSentence);
            const isActionVerb = /(?<!\p{L})(?:підготує|перевірить|надасть|розробить|налаштує|має надати|повинен|зобов'язався|організує|проведе|виконає|створить|виправить|опрацює|протестує|оновить)(?!\p{L})/iu.test(cleanSentence)
                || (parseDueDate(cleanSentence) && /(?<!\p{L})(?:підготувати|перевірити|надати|зробити|виконати|створити|виправити|опрацювати|протестувати|оновити)(?!\p{L})/iu.test(cleanSentence));

            if (isExplicitDecision || startsWithDecision || (containsDecision && !isExplicitAction && !isActionVerb)) {
                let decText = cleanSentence
                    .replace(/^(?:рішення|погоджено|decision)[:\s]*/iu, '')
                    .replace(/^(?:також\s+)?(?:погодили,\s*що|вирішили,\s*що|домовилися,\s*що|прийнято рішення,\s*що)\s*/iu, '')
                    .replace(/^(?:також\s+)?(?:вирішили|погодили|домовилися|затвердили)\s*/iu, '')
                    .trim();
                if (decText) {
                    decText = decText.charAt(0).toUpperCase() + decText.slice(1);
                    decisions.push(decText);
                }
            } else if (isExplicitAction || startsWithAction || isActionVerb) {
                const dueDate = parseDueDate(cleanSentence);
                const isClient = /(?<!\p{L})(?:клієнт|замовник|client)(?!\p{L})/iu.test(cleanSentence);

                let priority = 'medium';
                if (/(?<!\p{L})(?:high|urgent|critical|термінов\p{L}*|висок\p{L}*|критичн\p{L}*)(?!\p{L})/iu.test(cleanSentence)) priority = 'high';
                if (/(?<!\p{L})(?:low|низьк\p{L}*)(?!\p{L})/iu.test(cleanSentence)) priority = 'low';

                let assigneeName = null;
                if (isClient) {
                    assigneeName = "Клієнт";
                } else {
                    const nameMatch = cleanSentence.match(/^([А-ЯІЇЄҐA-Z][а-яіїєґa-z]+)\s+(?:підготує|перевірить|надасть|розробить|налаштує|має|виконає|створить|виправить|опрацює|протестує|оновить)/u);
                    if (nameMatch) {
                        assigneeName = nameMatch[1];
                    } else if (Array.isArray(variables.participants)) {
                        for (const p of variables.participants) {
                            const pName = p.name || p.alias || '';
                            if (pName && new RegExp(`(?<!\\p{L})${pName}(?!\\p{L})`, 'iu').test(cleanSentence)) {
                                assigneeName = pName;
                                break;
                            }
                        }
                    }
                }

                let title = cleanSentence;
                // Strip explicit action prefix e.g. "Дія 1: ", "Завдання: "
                title = title.replace(/^(?:дія\s*\d*|завдання|задача|action\s*\d*|task|todo)[:\s]*/iu, '');
                // Strip "Потрібно ", "Необхідно "
                title = title.replace(/^(?:потрібно|необхідно|слід)\s+/iu, '');
                // Strip assignee name from beginning
                if (assigneeName) {
                    title = title.replace(new RegExp(`^${assigneeName}\\s+`, 'iu'), '');
                }
                // Strip trailing metadata like (internal, high) or due dates
                title = title.replace(/\s*\([^)]*\)\s*$/, '');
                title = title.replace(/\s+до\s+\d{1,2}.*$/iu, '');

                // Conjugate verb to infinitive
                title = title
                    .replace(/^має\s+надати(?!\p{L})/iu, 'Надати')
                    .replace(/^має(?!\p{L})/iu, '')
                    .replace(/^підготує(?!\p{L})/iu, 'Підготувати')
                    .replace(/^перевірить(?!\p{L})/iu, 'Перевірити')
                    .replace(/^надасть(?!\p{L})/iu, 'Надати')
                    .replace(/^розробить(?!\p{L})/iu, 'Розробити')
                    .replace(/^налаштує(?!\p{L})/iu, 'Налаштувати')
                    .replace(/^виконає(?!\p{L})/iu, 'Виконати')
                    .replace(/^створить(?!\p{L})/iu, 'Створити')
                    .replace(/^виправить(?!\p{L})/iu, 'Виправити')
                    .replace(/^опрацює(?!\p{L})/iu, 'Опрацювати')
                    .replace(/^протестує(?!\p{L})/iu, 'Протестувати')
                    .replace(/^оновить(?!\p{L})/iu, 'Оновити')
                    .replace(/(?<!\p{L})та\s+надасть(?!\p{L})/iu, 'та надати')
                    .replace(/(?<!\p{L})та\s+підготує(?!\p{L})/iu, 'та підготувати')
                    .replace(/(?<!\p{L})та\s+перевірить(?!\p{L})/iu, 'та перевірити')
                    .trim();
                if (title) {
                    title = title.charAt(0).toUpperCase() + title.slice(1);
                }

                candidateActions.push({
                    title: title || cleanSentence,
                    description: cleanSentence,
                    responsibility: isClient ? 'client' : 'internal',
                    priority,
                    due_date: dueDate,
                    assignee_name: assigneeName
                });
            } else {
                discussionPoints.push(cleanSentence);
            }
        }

        let summaryParts = [];
        if (discussionPoints.length > 0) {
            summaryParts.push(discussionPoints.slice(0, 2).join(". ") + ".");
        }
        if (decisions.length > 0) {
            summaryParts.push(`Узгоджено: ${decisions.join(", ")}.`);
        }
        if (candidateActions.length > 0) {
            summaryParts.push(`Визначено ${candidateActions.length} підготовчих завдань.`);
        }

        let summary = summaryParts.join(" ");
        if (!summary) {
            summary = rawSentences.slice(0, 2).join(". ") + ".";
        }

        return {
            summary,
            decisions,
            candidate_actions: candidateActions
        };
    }

    /**
     * Deterministic Mock Provider for Testing / Offline Execution
     */
    _generateMockResponse(templateKey, variables = {}) {
        if (templateKey === 'meeting_intelligence_v1') {
            const rawNotes = variables.raw_notes || variables.meeting_notes || '';
            const extracted = this._extractMeetingProtocolFromRawNotes(rawNotes, variables);
            return {
                promptTokens: 250,
                completionTokens: 180,
                data: extracted
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
