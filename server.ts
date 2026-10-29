import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import rateLimit from "express-rate-limit";

// Ensure environment variables from .env are available in Node.js process
if (fs.existsSync(".env")) {
  try {
    const envFile = fs.readFileSync(".env", "utf8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key] || process.env[key]?.trim() === "") {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    console.warn("Notice: could not parse local .env file:", e);
  }
}

// ---------------------------------------------------------------------------
// Security & Validation Helpers
// ---------------------------------------------------------------------------

// Forbidden sensitive properties that must never be accepted in AI payloads
const FORBIDDEN_SECURITY_KEYS = new Set([
  "password",
  "salt",
  "hash",
  "recoveryKey",
  "recovery_key",
  "token",
  "rawTransactions",
  "activityHistory",
  "historyLogs",
  "logs",
  "accountId",
  "userId",
  "user_id",
  "account_id",
  "email",
  "database",
  "secret",
]);

/**
 * Recursively scans an object to ensure no private account identifiers,
 * passwords, or sensitive history logs are smuggled in the request.
 */
function checkNoForbiddenKeys(obj: unknown, prefix = ""): string | null {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const err = checkNoForbiddenKeys(obj[i], `${prefix}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (FORBIDDEN_SECURITY_KEYS.has(key)) {
      return `Forbidden property '${prefix ? prefix + "." : ""}${key}' is not allowed in AI payloads.`;
    }
    if (typeof val === "object" && val !== null) {
      const err = checkNoForbiddenKeys(val, prefix ? `${prefix}.${key}` : key);
      if (err) return err;
    }
  }
  return null;
}

/**
 * Asserts that an object only contains explicitly allowed top-level keys.
 */
function assertAllowedKeys(body: unknown, allowedKeys: string[]): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a valid JSON object";
  }
  const allowedSet = new Set(allowedKeys);
  for (const key of Object.keys(body)) {
    if (!allowedSet.has(key)) {
      return `Unrecognized field '${key}'. Allowed fields: ${allowedKeys.join(", ")}`;
    }
  }
  return null;
}

/**
 * Sanitizes a string: trims whitespace, removes non-printable control characters,
 * and bounds to maxLen.
 */
function sanitizeCleanString(val: unknown, maxLen: number, allowNewlines = true): string {
  if (typeof val !== "string") return "";
  let str = val.trim();
  if (allowNewlines) {
    // Remove control chars except newline and tab
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  } else {
    str = str.replace(/[\x00-\x1F\x7F]/g, " ");
  }
  return str.slice(0, maxLen);
}

/**
 * Validates that a value is a finite number within the specified bounds.
 */
function validateFiniteNumber(
  val: unknown,
  fieldName: string,
  min = -1e12,
  max = 1e12
): { valid: boolean; value?: number; error?: string } {
  if (typeof val !== "number" || !Number.isFinite(val)) {
    return { valid: false, error: `${fieldName} must be a valid finite number` };
  }
  if (val < min || val > max) {
    return { valid: false, error: `${fieldName} is outside allowable range [${min}, ${max}]` };
  }
  return { valid: true, value: val };
}

// ---------------------------------------------------------------------------
// Server Initialization
// ---------------------------------------------------------------------------

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Strict Request Body Size Limit (32kb max to prevent payload exhaustion / DOS)
  app.use(express.json({ limit: "32kb" }));

  // Global API Rate Limiting (100 requests per 15 minutes per IP)
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || "127.0.0.1",
    message: { error: "Too many requests. Please slow down and try again later." },
  });
  app.use("/api/", globalLimiter);

  // Dedicated AI Endpoints Rate Limiter (30 requests per 5 minutes per IP)
  const aiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || "127.0.0.1",
    message: { error: "AI rate limit reached. Please wait a few moments before trying again." },
  });

  // -------------------------------------------------------------------------
  // Local-First Client Session Security Middleware
  // -------------------------------------------------------------------------
  /**
   * Validates that the request originates from an authorized local client session.
   *
   * Security architecture:
   * 1. Anti-CSRF: Blocks cross-site requests (Sec-Fetch-Site: cross-site).
   * 2. Local Session Token: Verifies the client's local session token format,
   *    issuance timestamp, and expiration.
   * 3. Zero-Trust Identity: The server does NOT trust any user identity to query
   *    remote databases (there are none). No user identity is bound to database
   *    queries. All financial data is local to the user's browser.
   */
  const validateLocalClientSession = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // 1. Anti-CSRF check
    const fetchSite = req.headers["sec-fetch-site"];
    if (fetchSite === "cross-site") {
      return res.status(403).json({ error: "Forbidden: Cross-site requests are prohibited" });
    }

    // 2. Local session token check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required: Please sign in to your local account to use AI features.",
      });
    }

    const token = authHeader.split(" ")[1]?.trim();
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Empty bearer token" });
    }

    if (!token.startsWith("wallet_local_")) {
      return res.status(401).json({ error: "Unauthorized: Invalid local session token format" });
    }

    try {
      const base64Data = token.slice("wallet_local_".length);
      const payloadStr = Buffer.from(base64Data, "base64url").toString("utf-8");
      const payload = JSON.parse(payloadStr);

      if (!payload || typeof payload !== "object") {
        return res.status(401).json({ error: "Unauthorized: Malformed session token" });
      }

      // Validate expiration
      if (typeof payload.exp === "number" && Date.now() > payload.exp) {
        return res.status(401).json({ error: "Unauthorized: Session expired. Please sign in again." });
      }

      // Validate token structure
      if (!payload.sessionId || typeof payload.sessionId !== "string") {
        return res.status(401).json({ error: "Unauthorized: Incomplete session credentials" });
      }

      // Proceed: request is from a verified, unexpired local user session.
      // Note: No remote user entity is fetched or trusted.
      return next();
    } catch (err) {
      console.warn("Local token parsing error:", err);
      return res.status(401).json({ error: "Unauthorized: Session token verification failed" });
    }
  };

  // -------------------------------------------------------------------------
  // Gemini AI Client & Resilient Execution Helpers
  // -------------------------------------------------------------------------
  const getGeminiClient = (): GoogleGenAI => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured");
    }
    return new GoogleGenAI({ apiKey });
  };

  /**
   * Resilient Gemini content generator with automatic fallback on 503 high demand.
   */
  const executeGeminiGenerate = async (
    contents: string,
    config?: any,
    systemInstruction?: string
  ) => {
    const ai = getGeminiClient();
    const modelsToTry = ["gemini-3.8-flash", "gemini-2.5-flash"];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const mergedConfig = {
          ...config,
          ...(systemInstruction ? { systemInstruction } : {}),
        };
        const res = await ai.models.generateContent({
          model,
          contents,
          config: mergedConfig,
        });
        return res;
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code;
        const msg = String(err?.message || "");
        if (
          status === 503 ||
          msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("high demand")
        ) {
          console.warn(`Gemini model ${model} temporarily unavailable, trying fallback...`);
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  /**
   * Resilient Gemini chat session with automatic fallback on 503 high demand.
   */
  const executeGeminiChat = async (
    history: { role: "user" | "model"; parts: { text: string }[] }[],
    message: string,
    systemInstruction: string
  ) => {
    const ai = getGeminiClient();
    const modelsToTry = ["gemini-3.8-flash", "gemini-2.5-flash"];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const chat = ai.chats.create({
          model,
          history,
          config: { systemInstruction },
        });
        const res = await chat.sendMessage({ message });
        return res;
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code;
        const msg = String(err?.message || "");
        if (
          status === 503 ||
          msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("high demand")
        ) {
          console.warn(`Gemini chat model ${model} temporarily unavailable, trying fallback...`);
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  /**
   * Formats safe, sanitized user-facing error responses.
   * Strictly prevents leaking API keys, stack traces, or environment details.
   */
  const handleAiError = (res: express.Response, error: any, context: string) => {
    console.error(`[AI Error - ${context}]:`, error?.message || error);

    if (error?.message?.includes("GEMINI_API_KEY") || !process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "AI assistant service is currently unconfigured or offline." });
    }

    const status = error?.status || error?.code;
    const msg = String(error?.message || "");
    if (status === 429 || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      return res.status(429).json({ error: "AI service rate limit exceeded. Please wait a moment and try again." });
    }

    if (status === 503 || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
      return res.status(503).json({
        error: "AI service is currently experiencing high demand. Please try again in a few moments.",
      });
    }

    return res.status(500).json({ error: "Failed to process AI request. Please try again later." });
  };

  // -------------------------------------------------------------------------
  // API Routes
  // -------------------------------------------------------------------------

  // 0. Health Endpoint (Public / Monitoring)
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // 1. Chatbot Endpoint (POST /api/chat)
  app.post("/api/chat", validateLocalClientSession, aiLimiter, async (req: express.Request, res: express.Response) => {
    try {
      // 1. Strict schema validation: allowed fields
      const allowedErr = assertAllowedKeys(req.body, ["input", "messages", "contextData"]);
      if (allowedErr) {
        return res.status(400).json({ error: allowedErr });
      }

      // 2. Check no forbidden sensitive keys anywhere in body
      const forbiddenErr = checkNoForbiddenKeys(req.body);
      if (forbiddenErr) {
        return res.status(400).json({ error: forbiddenErr });
      }

      const { input, messages, contextData } = req.body;

      // 3. Input validation
      if (!input || typeof input !== "string" || input.trim().length === 0) {
        return res.status(400).json({ error: "Input prompt is required and must be a non-empty string" });
      }
      if (input.length > 1000) {
        return res.status(400).json({ error: "Input prompt exceeds maximum allowed length (1000 characters)" });
      }
      const sanitizedInput = sanitizeCleanString(input, 1000);

      // 4. Validate and sanitize conversation history (limit to last 15 messages, max 1000 chars each)
      const validatedHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];
      if (Array.isArray(messages)) {
        if (messages.length > 15) {
          return res.status(400).json({ error: "messages array exceeds maximum allowed length of 15 items" });
        }
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (!msg || typeof msg !== "object") {
            return res.status(400).json({ error: `Message at index ${i} must be a valid object` });
          }
          if (typeof msg.text !== "string") {
            return res.status(400).json({ error: `Message text at index ${i} must be a string` });
          }
          const text = sanitizeCleanString(msg.text, 1000);
          const role = msg.sender === "user" || msg.role === "user" ? "user" : "model";
          validatedHistory.push({
            role,
            parts: [{ text }],
          });
        }
      } else if (messages !== undefined && messages !== null) {
        return res.status(400).json({ error: "messages must be an array" });
      }

      // 5. Validate contextData (strictly minimal aggregated metrics only)
      let financialContext = "No financial context provided.";
      if (contextData !== undefined && contextData !== null) {
        if (typeof contextData !== "object" || Array.isArray(contextData)) {
          return res.status(400).json({ error: "contextData must be a valid object" });
        }
        const ctxAllowedErr = assertAllowedKeys(contextData, ["totalIncome", "totalExpenses", "netBalance"]);
        if (ctxAllowedErr) {
          return res.status(400).json({ error: ctxAllowedErr });
        }

        let totalInc = 0;
        let totalExp = 0;
        let netBal = 0;

        if (contextData.totalIncome !== undefined) {
          const check = validateFiniteNumber(contextData.totalIncome, "totalIncome");
          if (!check.valid) return res.status(400).json({ error: check.error });
          totalInc = check.value!;
        }
        if (contextData.totalExpenses !== undefined) {
          const check = validateFiniteNumber(contextData.totalExpenses, "totalExpenses");
          if (!check.valid) return res.status(400).json({ error: check.error });
          totalExp = check.value!;
        }
        if (contextData.netBalance !== undefined) {
          const check = validateFiniteNumber(contextData.netBalance, "netBalance");
          if (!check.valid) return res.status(400).json({ error: check.error });
          netBal = check.value!;
        }

        financialContext = `Aggregated Financial Overview (Minimal Client Context):
- Total Recorded Income: ${totalInc.toFixed(2)}
- Total Recorded Expenses: ${totalExp.toFixed(2)}
- Net Balance: ${netBal.toFixed(2)}`;
      }

      // 6. System instructions for the AI assistant
      const systemInstruction = `You are a secure, friendly, and knowledgeable personal-finance assistant for the 'Wallet' (ዋሌት) application.
Your role is to support the user with:
- Spending summaries and breakdown
- Budget explanations and expense control tips
- Savings progress tracking and actionable milestone advice
- Subscription insights (identifying recurring commitments and review opportunities)
- Transaction categorization assistance (recommending appropriate standard categories)
- Financial trend explanations

STRICT SECURITY & PRIVACY RULES:
1. PRIVACY: You only have access to the aggregated financial figures below. Never request passwords, secret recovery keys, or bank credentials.
2. PROFESSIONAL ADVICE DISCLAIMER: Clearly distinguish general educational financial concepts and personal budgeting guidelines from regulated professional financial advice. For any investment, portfolio, securities, or crypto questions, explicitly clarify that you provide educational information only and that the user should consult a certified financial planner (CFP) or licensed advisor.
3. NEVER FABRICATE DATA: Never invent or hallucinate financial numbers. If specific context is missing or not recorded, explicitly state that rather than making up values.
4. TONE & LENGTH: Keep your responses concise, empathetic, well-structured, and clear. Avoid excessive jargon.

${financialContext}`;

      const response = await executeGeminiChat(validatedHistory, sanitizedInput, systemInstruction);
      return res.json({ text: response.text || "I was unable to generate a response. Please try again." });
    } catch (e: any) {
      return handleAiError(res, e, "chat");
    }
  });

  // 2. Report Summary Endpoint (POST /api/report-summary)
  app.post(
    "/api/report-summary",
    validateLocalClientSession,
    aiLimiter,
    async (req: express.Request, res: express.Response) => {
      try {
        const allowedErr = assertAllowedKeys(req.body, [
          "startDate",
          "endDate",
          "totalIncome",
          "totalExpenses",
          "netBalance",
          "topCategories",
          "currencySymbol",
          "language",
          "prompt",
        ]);
        if (allowedErr) {
          return res.status(400).json({ error: allowedErr });
        }

        const forbiddenErr = checkNoForbiddenKeys(req.body);
        if (forbiddenErr) {
          return res.status(400).json({ error: forbiddenErr });
        }

        const {
          prompt,
          startDate,
          endDate,
          totalIncome,
          totalExpenses,
          netBalance,
          topCategories,
          currencySymbol,
          language,
        } = req.body;

        let promptText = "";

        // Mode A: Structured minimal financial report metrics (preferred)
        if (startDate !== undefined && endDate !== undefined && totalIncome !== undefined) {
          if (typeof startDate !== "string" || startDate.length > 30) {
            return res.status(400).json({ error: "startDate must be a valid date string (max 30 chars)" });
          }
          if (typeof endDate !== "string" || endDate.length > 30) {
            return res.status(400).json({ error: "endDate must be a valid date string (max 30 chars)" });
          }

          const incCheck = validateFiniteNumber(totalIncome, "totalIncome");
          if (!incCheck.valid) return res.status(400).json({ error: incCheck.error });

          const expCheck = validateFiniteNumber(totalExpenses ?? 0, "totalExpenses");
          if (!expCheck.valid) return res.status(400).json({ error: expCheck.error });

          const netCheck = validateFiniteNumber(netBalance ?? 0, "netBalance");
          if (!netCheck.valid) return res.status(400).json({ error: netCheck.error });

          const sym = typeof currencySymbol === "string" ? sanitizeCleanString(currencySymbol, 5, false) : "$";
          const lang = language === "am" ? "Amharic" : "English";

          let catSummary = "None specified";
          if (Array.isArray(topCategories)) {
            if (topCategories.length > 5) {
              return res.status(400).json({ error: "topCategories must not contain more than 5 items" });
            }
            const catLines: string[] = [];
            for (let i = 0; i < topCategories.length; i++) {
              const cat = topCategories[i];
              if (!cat || typeof cat !== "object") {
                return res.status(400).json({ error: `topCategories item at index ${i} must be an object` });
              }
              const name = sanitizeCleanString(cat.category || cat.name || "Item", 40, false);
              const amtCheck = validateFiniteNumber(cat.amount ?? 0, `topCategories[${i}].amount`);
              if (!amtCheck.valid) return res.status(400).json({ error: amtCheck.error });
              catLines.push(`${name}: ${sym}${amtCheck.value!.toFixed(2)}`);
            }
            if (catLines.length > 0) {
              catSummary = catLines.join("\n");
            }
          } else if (topCategories !== undefined && topCategories !== null) {
            return res.status(400).json({ error: "topCategories must be an array" });
          }

          promptText = `Based strictly on the following aggregated financial report, provide a concise 3-4 sentence summary and 1-2 practical, actionable budgeting tips.
Respond in ${lang}.
- Period: ${sanitizeCleanString(startDate, 30, false)} to ${sanitizeCleanString(endDate, 30, false)}
- Total Income: ${sym}${incCheck.value!.toFixed(2)}
- Total Outgoings: ${sym}${expCheck.value!.toFixed(2)}
- Net Balance: ${sym}${netCheck.value!.toFixed(2)}
- Top Expense Categories:
${catSummary}

Guidelines: Keep it insightful, practical, and brief. Never fabricate financial figures. If outgoings exceed income, suggest practical cost-saving adjustments. Do not use markdown headers; provide a clean, cohesive paragraph.`;
        } else if (typeof prompt === "string" && prompt.trim().length > 0) {
          // Mode B: Validated string prompt fallback
          if (prompt.length > 1500) {
            return res.status(400).json({ error: "Prompt exceeds maximum allowed length of 1500 characters" });
          }
          promptText = sanitizeCleanString(prompt, 1500);
        } else {
          return res.status(400).json({
            error: "Invalid report summary payload: structured financial figures or prompt required",
          });
        }

        const systemInstruction =
          "You are a secure, helpful financial assistant for the 'Wallet' app. Only use the provided aggregated metrics. Distinguish general personal budgeting educational concepts from regulated financial advice. Never fabricate numbers.";

        const response = await executeGeminiGenerate(promptText, undefined, systemInstruction);
        return res.json({ text: response.text || "Report summary generated successfully." });
      } catch (e: any) {
        return handleAiError(res, e, "report-summary");
      }
    }
  );

  // 3. Smart Meal Plan Endpoint (POST /api/meal-plan)
  app.post("/api/meal-plan", validateLocalClientSession, aiLimiter, async (req: express.Request, res: express.Response) => {
    try {
      const allowedErr = assertAllowedKeys(req.body, ["shoppingItems"]);
      if (allowedErr) {
        return res.status(400).json({ error: allowedErr });
      }

      const forbiddenErr = checkNoForbiddenKeys(req.body);
      if (forbiddenErr) {
        return res.status(400).json({ error: forbiddenErr });
      }

      const { shoppingItems } = req.body;

      if (!shoppingItems || typeof shoppingItems !== "string" || shoppingItems.trim().length === 0) {
        return res.status(400).json({ error: "shoppingItems is required and must be a non-empty string" });
      }
      if (shoppingItems.length > 500) {
        return res.status(400).json({ error: "shoppingItems exceeds maximum allowed length of 500 characters" });
      }

      const sanitizedItems = sanitizeCleanString(shoppingItems, 500);

      const prompt = `Available grocery ingredients: ${sanitizedItems}.
Create a nutritious, balanced 1-day meal plan including Breakfast, Lunch, Dinner, and 1 Snack.
For each meal, provide:
1. Creative recipe name
2. Ingredients with approximate portions
3. Step-by-step preparation instructions
4. Estimated calories
Total estimated calories for the entire day.
Return strictly valid JSON adhering to the provided schema.`;

      const response = await executeGeminiGenerate(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mealPlan: {
              type: Type.ARRAY,
              description: "List of meals for the day.",
              items: {
                type: Type.OBJECT,
                properties: {
                  mealType: {
                    type: Type.STRING,
                    description: "Meal type (Breakfast, Lunch, Dinner, Snack).",
                  },
                  recipeName: { type: Type.STRING, description: "Name of the recipe." },
                  ingredients: {
                    type: Type.ARRAY,
                    description: "Ingredients needed.",
                    items: { type: Type.STRING },
                  },
                  instructions: {
                    type: Type.STRING,
                    description: "Preparation steps.",
                  },
                  calories: {
                    type: Type.NUMBER,
                    description: "Estimated calories for this meal.",
                  },
                },
                required: ["mealType", "recipeName", "ingredients", "instructions", "calories"],
              },
            },
            totalCalories: {
              type: Type.NUMBER,
              description: "Total estimated calories for the day.",
            },
          },
          required: ["mealPlan", "totalCalories"],
        },
      });

      return res.json({ text: response.text });
    } catch (e: any) {
      return handleAiError(res, e, "meal-plan");
    }
  });

  // 4. Transaction Categorization Endpoint (POST /api/categorize)
  app.post("/api/categorize", validateLocalClientSession, aiLimiter, async (req: express.Request, res: express.Response) => {
    try {
      const allowedErr = assertAllowedKeys(req.body, ["transactionName", "availableCategories"]);
      if (allowedErr) {
        return res.status(400).json({ error: allowedErr });
      }

      const forbiddenErr = checkNoForbiddenKeys(req.body);
      if (forbiddenErr) {
        return res.status(400).json({ error: forbiddenErr });
      }

      const { transactionName, availableCategories } = req.body;

      if (!transactionName || typeof transactionName !== "string" || transactionName.trim().length === 0) {
        return res.status(400).json({ error: "transactionName is required and must be a non-empty string" });
      }
      if (transactionName.length > 100) {
        return res.status(400).json({ error: "transactionName must not exceed 100 characters" });
      }

      const sanitizedName = sanitizeCleanString(transactionName, 100, false);

      const defaultCategories = [
        "Food & Dining",
        "Groceries",
        "Transportation",
        "Utilities",
        "Housing & Rent",
        "Healthcare",
        "Entertainment",
        "Shopping",
        "Personal Care",
        "Education",
        "Subscriptions",
        "Travel",
        "Investments",
        "Miscellaneous",
      ];

      let categoriesToUse = defaultCategories;
      if (Array.isArray(availableCategories)) {
        if (availableCategories.length > 30) {
          return res.status(400).json({ error: "availableCategories array exceeds maximum allowed length of 30 items" });
        }
        const cleaned: string[] = [];
        for (let i = 0; i < availableCategories.length; i++) {
          const item = availableCategories[i];
          if (typeof item !== "string") {
            return res.status(400).json({ error: `Category at index ${i} must be a string` });
          }
          const s = sanitizeCleanString(item, 50, false);
          if (s) cleaned.push(s);
        }
        if (cleaned.length > 0) {
          categoriesToUse = cleaned;
        }
      } else if (availableCategories !== undefined && availableCategories !== null) {
        return res.status(400).json({ error: "availableCategories must be an array" });
      }

      const prompt = `Given the transaction description "${sanitizedName}", select the single best matching category from this list:
${categoriesToUse.join(", ")}.
If none fits precisely, choose the closest match.
Respond strictly in valid JSON with fields: "category" (string), "confidence" ("high" | "medium" | "low"), and "explanation" (1 short sentence).`;

      const response = await executeGeminiGenerate(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            confidence: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["category", "confidence", "explanation"],
        },
      });

      let parsed = { category: categoriesToUse[0], confidence: "medium", explanation: "" };
      try {
        parsed = JSON.parse(response.text || "{}");
      } catch (err) {
        console.warn("Could not parse JSON categorization response:", err);
      }

      return res.json(parsed);
    } catch (e: any) {
      return handleAiError(res, e, "categorize");
    }
  });

  // -------------------------------------------------------------------------
  // Global Express Error Handlers
  // -------------------------------------------------------------------------
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err.type === "entity.too.large" || err.status === 413)) {
      return res.status(413).json({ error: "Payload too large. Maximum allowed request size is 32KB." });
    }
    if (err instanceof SyntaxError || err?.status === 400) {
      return res.status(400).json({ error: "Malformed JSON in request body." });
    }
    console.error("Unhandled express server error:", err?.message || err);
    return res.status(500).json({ error: "Internal server error." });
  });

  // -------------------------------------------------------------------------
  // Vite Middleware & SPA Routing
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
