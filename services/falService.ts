'use server';

import { fal } from "@fal-ai/client";
import { StoreImageDataDb, StoreImageRelationshipDb } from './supabaseService';
import { RelationshipType } from '@/types/relationshipType';
import { generateUuid } from './uuidService';
import { getPromptVariants } from './openaiService';
import { GeneratedImage } from '@/types/generatedImage';
import logger from '../lib/logger';

try {
    fal.config({
        credentials: process.env.FAL_API_KEY
    });
    logger.info('Fal AI client configured.');
} catch (configError) {
    logger.error('Failed to configure Fal AI client:', configError);
}

/**
 * Generates a single image using the Fal AI service based on a provided prompt and size.
 * Assigns a unique ID to the image and attempts to log its metadata to the database.
 *
 * @param {string} prompt - The text description used to generate the image.
 * @param {number} imageSize - The desired width and height (in pixels) for the generated square image.
 * @returns {Promise<GeneratedImage>} A Promise resolving to a GeneratedImage object containing
 *   the `id`, `imageUrl`, and `promptUsed`. If an error occurs during generation or database logging,
 *   the `error` field will be populated with a message, and `id`/`imageUrl` may be empty/undefined.
 */
export async function generateImage(prompt: string, imageSize: number): Promise<GeneratedImage> {
    const imageId: string = await generateUuid()
    try {
        // Note - only supporting square images for now, per the reference demo, but can change easily
        const result: any = await fal.subscribe("fal-ai/flux/schnell", {
            input: {
                prompt: prompt,
                image_size: {
                    width: imageSize,
                    height: imageSize
                }
            },
        });

        const imageUrl = result?.data?.images?.[0]?.url;

        // Store the run in the Db for tracking
        const _ = await StoreImageDataDb(imageId, prompt);
        return {
            id: imageId,
            imageUrl,
            promptUsed: prompt,
        };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error during image generation.';
        return { id: '', error: message, promptUsed: prompt };
    }
}


/**
 * Generates multiple image variations based on an original prompt and a parent image ID.
 * It first retrieves prompt variations using an AI service (OpenAI), then generates
 * an image for each variant in parallel using the `generateImage` function.
 * Finally, it logs the relationship between the parent image and each successfully
 * generated variant in the database.
 *
 * @param {string} originalPrompt - The initial text prompt used as the basis for generating variations.
 * @param {string} parentId - The unique identifier of the original image these variations are based on.
 * @param {number} imageSize - The desired width and height (in pixels) for each generated square variation image.
 * @returns {Promise<GeneratedImage[]>} A Promise resolving to an array of GeneratedImage objects.
 *   Each object represents the result of one variation generation attempt. Failed attempts
 *   (either during prompt variation or image generation) will have their `error` field populated.
 */
export async function generateImageVariations(
    originalPrompt: string,
    parentId: string,
    imageSize: number
): Promise<GeneratedImage[]> {
    // Get prompt variants
    const promptVariants = await getPromptVariants(originalPrompt);

    // Handle failure during augmentation
    if (promptVariants.error || !promptVariants.variants || promptVariants.variants.length === 0) {
        const errorMsg = promptVariants.error || 'Failed to get prompt variants.';
        logger.error("Failed To Generate variations", errorMsg);
        return [{
            id: '',
            error: `Prompt Variation Generation failed: ${errorMsg}`,
            promptUsed: originalPrompt
        }];
    }

    // Call generateImage for each variant prompt in parallel
    const generationPromises = promptVariants.variants.map((variantPrompt, index) => {
        return generateImage(variantPrompt, imageSize)
            .catch((error: any) => {
                // Return an GeneratedImage structure indicating an unexpected failure
                return {
                    id: '',
                    imageUrl: undefined,
                    promptUsed: variantPrompt,
                    error: error instanceof Error ? `Unexpected Exception: ${error.message}` : 'Unexpected generation exception',
                    dbError: undefined,
                    logs: undefined,
                    falRequestId: undefined
                };
            });
    });

    // Await all generation attempts
    const results: GeneratedImage[] = await Promise.all(generationPromises);

    logger.info(`Completed ${results.length} generation attempts. Results:`, results.map(r => ({ id: r.id, error: r.error }))); // Log summary
    const successfulVariants = results.filter(v => v.id && !v.error);

    // Record Relationships (e.g. if wanting to track the progression of change)
    if (successfulVariants.length > 0) {
        logger.info(`Logging ${successfulVariants.length} parent-child relationships...`);
        const relationshipLoggingPromises = successfulVariants.map(variant =>
            StoreImageRelationshipDb(parentId, variant.id, RelationshipType.IS_PARENT)
        );
        const _ = await Promise.all(relationshipLoggingPromises);
        logger.info(`Relationship logging attempts finished.`);
    } else {
        logger.info(`No successful variants to log relationships for.`);
    }
    return results;
}