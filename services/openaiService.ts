'use server';

import OpenAI from 'openai';
import logger from '../lib/logger';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  const errorMsg = "OPENAI_API_KEY environment variable is not set.";
  logger.error(errorMsg);
  throw new Error(errorMsg); // Fail fast
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Augments a given prompt using OpenAI GPT-4o to generate four distinct variations.
 * Enforces JSON output using a schema.
 *
 * @param prompt The original user prompt.
 * @returns An object containing an array of prompt variants or an error message.
 */
export async function getPromptVariants(prompt: string): Promise<{ variants: string[]; error?: string }> {
  try {
    const response = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      input: [
        {
          role: "system",
          content:
            "You are a creative assistant that generates four distinct image prompt variations. Your prompts should be detailed and vary the content and style.",
        },
        { role: "user", content: `Original prompt: "${prompt}"` },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "prompt_variants",
          schema: {
            type: "object",
            properties: {
              variants: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["variants"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });
    // Parse the output_text assuming it returns a JSON string.
    const output = JSON.parse(response.output_text);
    if (!output.variants || !Array.isArray(output.variants)) {
      logger.warn({ output: response.output_text, prompt }, "OpenAI response parsed but 'variants' array is missing or not an array.");
      return { variants: [], error: "Failed to extract prompt variants from OpenAI response." };
    }
    logger.info({ prompt, count: output.variants.length }, "Successfully augmented prompt");
    return { variants: output.variants };
  } catch (error: unknown) {
    logger.error({ error, originalPrompt: prompt }, "Error augmenting prompt with OpenAI");
    let errorMessage = 'An unknown error occurred during prompt augmentation.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return { variants: [], error: errorMessage };
  }
}
