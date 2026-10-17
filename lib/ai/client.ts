// Server-only call wrapper: the one place that actually talks to the model provider. Every
// caller must already have masked its prompt and must unmask the reply itself; this module does
// not know about real names, only tokens.
//
// Automatically logs all requests, latency, statuses (success / fallback / error), and raw outputs
// into global telemetry memory for the /admin diagnostics dashboard.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getApiKey, MODEL_NAME, TEMPERATURE, type AiTaskType } from "./config";
import { recordAiCall } from "./call-log";

export interface CallModelImagePart {
  mimeType: string;
  base64Data: string;
}

export interface CallModelInput {
  task: AiTaskType | string;
  systemPrompt: string;
  userPrompt: string;
  imagePart?: CallModelImagePart;
}

export interface CallModelResult {
  text: string;
  model: string;
  temperature: number;
}

export async function callModel({ task, systemPrompt, userPrompt, imagePart }: CallModelInput): Promise<CallModelResult> {
  const temperature = typeof task === "string" && task in TEMPERATURE ? TEMPERATURE[task as AiTaskType] : 0.2;
  const startTime = Date.now();

  try {
    const genAI = new GoogleGenerativeAI(getApiKey());
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemPrompt,
      generationConfig: { temperature },
    });

    const result = imagePart
      ? await model.generateContent([
          { inlineData: { mimeType: imagePart.mimeType, data: imagePart.base64Data } },
          userPrompt,
        ])
      : await model.generateContent(userPrompt);

    const text = result.response.text();
    const latencyMs = Date.now() - startTime;

    recordAiCall({
      task: String(task),
      at: new Date().toISOString(),
      systemPrompt,
      maskedPrompt: userPrompt,
      mapping: [],
      maskedReply: text,
      unmaskedReply: text,
      model: MODEL_NAME,
      temperature,
      status: "success",
      latencyMs,
    });

    return { text, model: MODEL_NAME, temperature };
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    recordAiCall({
      task: String(task),
      at: new Date().toISOString(),
      systemPrompt,
      maskedPrompt: userPrompt,
      mapping: [],
      maskedReply: `ERROR: ${errorMessage}`,
      unmaskedReply: `ERROR: ${errorMessage}`,
      model: MODEL_NAME,
      temperature,
      status: "error",
      errorMessage,
      latencyMs,
    });

    throw error;
  }
}
