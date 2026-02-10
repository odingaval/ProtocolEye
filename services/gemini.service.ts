import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { environment } from '@environments/environment';
import { AuditResult } from '@models/audit-result.model';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private genAI!: GoogleGenAI;
  errorMessage = signal<string | null>(null);

  constructor() {
    const apiKey = environment.apiKey;
    if (!apiKey) {
      console.warn("API_KEY not found in environment. Please check Vercel settings.");
      this.errorMessage.set("Gemini API Key is missing. Please configure it in your deployment settings.");
      return;
    }
    this.genAI = new GoogleGenAI({ apiKey: apiKey });
  }

  async auditProcedure(imageDataBase64: string, documentText: string, mimeType: string = 'image/jpeg'): Promise<AuditResult> {
    if (!this.genAI) {
      throw new Error(this.errorMessage() || "AI Service not initialized");
    }
    const model = this.genAI.models;

    const mediaPart = {
      inlineData: {
        mimeType: mimeType,
        data: imageDataBase64,
      },
    };

    const prompt = `
      **ROLE & GOAL:** You are the "Gemini 3 Multimodal Audit Agent." Your task is to analyze the provided Standard Operating Procedure (SOP) text and compare it against the actions shown in the provided image. You must identify any discrepancies with a professional, objective, and slightly skeptical tone.

      **SOP TEXT:**
      ---
      ${documentText}
      ---

      **ANALYSIS TASK:**
      Analyze the attached image which represents a snapshot of a procedure. Based *only* on the provided SOP text and the visual evidence in the image, generate a concise audit report. 
      - If the image quality is too low to verify a step, state it clearly in your reasoning. Do not hallucinate details.
      - Protocol matches should be specific actions seen in the image that align with the SOP.
      - Discrepancies should be specific, observable deviations from the SOP.

      **OUTPUT INSTRUCTIONS:**
      Respond with a JSON object that strictly adheres to the provided schema. Do not add any extra text or markdown formatting around the JSON object.
    `;

    try {
      const response = await model.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { text: prompt },
            mediaPart
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: {
                type: Type.OBJECT,
                properties: {
                  status: {
                    type: Type.STRING,
                    enum: ['Pass', 'Fail', 'Caution'],
                    description: 'The overall audit status.'
                  },
                  summary: {
                    type: Type.STRING,
                    description: 'A concise, 2-sentence summary of the audit findings.'
                  }
                },
                required: ['status', 'summary']
              },
              protocolMatches: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING
                },
                description: 'A list of actions performed correctly according to the SOP.'
              },
              discrepancyLog: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    discrepancy: {
                      type: Type.STRING,
                      description: 'A clear description of the deviation from the SOP.'
                    },
                    reference: {
                      type: Type.STRING,
                      description: 'The specific page or section number from the manual, if available.'
                    }
                  },
                  required: ['discrepancy']
                }
              },
              reasoningTrace: {
                type: Type.STRING,
                description: 'A brief explanation for the most complex or significant discrepancy found.'
              }
            },
            required: ['executiveSummary', 'protocolMatches', 'discrepancyLog']
          }
        }
      });

      const jsonString = response.text;
      if (!jsonString) {
        throw new Error('Gemini API response did not contain any text.');
      }
      const parsedResult = JSON.parse(jsonString) as AuditResult;
      return parsedResult;

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Failed to get a valid response from the audit agent.');
    }
  }
}
