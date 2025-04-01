'use server';

import supabase from '../lib/supabase';
import { GeneratedImage } from '@/types/generatedImage';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import logger from '../lib/logger';
import type { RelationshipTypeValue } from '@/types/relationshipType';

// Define types
type DbImageInsert = TablesInsert<'images'>;
type DbImageUpdate = TablesUpdate<'images'>;
type DbRelationshipInsert = TablesInsert<'image_relationships'>;

const IMAGE_TABLE_NAME = 'images';
const RELATIONSHIPS_TABLE_NAME = 'image_relationships';
const BUCKET_NAME = "world-labs-assignment";

/**
 * @typedef {object} SupabaseResult
 * @property {string | null} error - An error message string if the operation failed, otherwise null.
 */
interface SupabaseResult {
    error: string | null;
}

/**
 * Stores or updates image metadata (ID, prompt, initial saved status) in the Supabase database.
 * Uses upsert based on the image_id to handle both new entries and potential updates.
 *
 * @param {string} imageId - The unique identifier for the image.
 * @param {string} prompt - The text prompt associated with the image generation.
 * @returns {Promise<SupabaseResult>} A Promise resolving to an object containing an `error` message string (or null on success).
 */
export async function StoreImageDataDb(imageId: string, prompt: string): Promise<SupabaseResult> {
    if (!supabase) {
        logger.error('Supabase client not available.');
        return { error: 'Supabase client not available.' };
    }

    try {
        // Use the generated 'Insert' type for the payload.
        const payload: DbImageInsert = {
            image_id: imageId,
            prompt: prompt,
            saved: false
        };

        const { data, error } = await supabase
            .from(IMAGE_TABLE_NAME)
            .upsert(payload, { onConflict: 'image_id' });

        if (error) {
            logger.error({ error, imageId, prompt }, `Supabase log error for image data`);
            return { error: error.message };
        }

        logger.info({ imageId }, `Supabase log success for image data`);
        return { error: null };

    } catch (dbError: unknown) {
        logger.error({ error: dbError, imageId, prompt }, `Supabase log exception for image data`);
        const message = dbError instanceof Error ? dbError.message : 'An unexpected database error occurred.';
        return { error: message };
    }
}

/**
 * Stores a relationship record between two images in the Supabase database.
 * This is typically used to link a parent image to its generated variations.
 *
 * @param {string} sourceId - The unique identifier of the source (e.g., parent) image.
 * @param {string} targetId - The unique identifier of the target (e.g., child/variation) image.
 * @param {RelationshipTypeValue} relationshipType - The type of relationship (e.g., RelationshipType.IS_PARENT).
* @returns {Promise<SupabaseResult>} A Promise resolving to an object containing an `error` message string (or null on success).
 */
export async function StoreImageRelationshipDb(
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipTypeValue
): Promise<SupabaseResult> {
    if (!supabase) {
        logger.error("Supabase client not available. Cannot log relationship.");
        return { error: 'Supabase client not available.' };
    }
    if (!sourceId || !targetId) {
        logger.error('Cannot log relationship: Source or Target ID missing.');
        return { error: 'Missing Source or Target ID for logging relationship.' };
    }

    try {
        const payload: DbRelationshipInsert = {
            source_image: sourceId,
            target_image: targetId,
            relationship_type: relationshipType
        };
        const { data, error } = await supabase
            .from(RELATIONSHIPS_TABLE_NAME)
            .insert(payload);

        if (error) {
            logger.error(`Failed To Insert Relationship ${sourceId}->${targetId}:`, error);
            return { error: `Database relationship insert failed: ${error.message}` };
        }

        logger.info('Added relationship for images');
        return { error: null }; // Success

    } catch (dbError: unknown) {
        logger.error(`Supabase Relationship Insert Error ${sourceId}->${targetId}:`, dbError);
        const message = dbError instanceof Error ? dbError.message : 'An unexpected database error occurred during relationship insert.';
        return { error: message };
    }
}


/**
 * Downloads image data from a source URL, uploads it as a blob to Supabase Storage,
 * and updates the corresponding image record in the database to mark it as 'saved'
 * and store its storage path.
 *
 * @param {string} id - The unique identifier of the image (used for filename and DB lookup).
 * @param {string} src - The source URL from which to fetch the image data.
 * @returns {Promise<SupabaseResult>} A Promise resolving to an object containing an `error` message string (or null on success).
 */
export async function saveImageBlob(id: string, src: string): Promise<SupabaseResult> {
    if (!supabase) {
        logger.error('Supabase client not available. Cannot save image.');
        return { error: 'Supabase client not available.' };
    }

    try {
        // Try to read the image
        const response = await fetch(src);
        if (!response.ok || !response.body) {
            logger.error(`Failed to download image: ${response.statusText} (status: ${response.status})`);
            return { error: 'Failed to download image from URL' };
        }

        const blob = await response.blob();

        // Determine file extension
        let fileExtension = 'jpeg';
        const type = blob.type.split('/');
        if (type.length === 2 && type[0] === 'image' && type[1]) {
            fileExtension = type[1].split('+')[0];
        }

        // Define the storage path
        const filePath = `${id}.${fileExtension}`; // Use ID + extension

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(filePath, blob, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            logger.error('Supabase storage upload error:', uploadError);
            return { error: 'Failed to save Image' };
        }

        logger.info('Supabase storage upload successful');

        // Mark image aas saved in the DB
        const updatePayload: DbImageUpdate = {
            saved: true,
            storage_path: filePath
        };
        const { data: updateData, error: updateError } = await supabase
            .from(IMAGE_TABLE_NAME)
            .update(updatePayload)
            .eq('image_id', id);

        if (updateError) {
            logger.error(`Database update error for image ${id}:`, updateError);
            // Could potentially delete from blob storage in this case
            return { error: 'Failed to save image' };
        }

        logger.info(`Database update successful for image ${id}`);
        return { error: null };
    } catch (error: unknown) {
        logger.error(`Error saving image ${id}:`);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred during saveImageBlob.';
        return { error: message };
    }
}


/**
 * Fetches metadata for all images marked as 'saved' in the database,
 * then generates temporary signed URLs for accessing their corresponding blobs in Supabase Storage.
 *
 * @returns {Promise<GeneratedImage[]>} A Promise resolving to an array of GeneratedImage objects,
 *   each containing the image `id`, `promptUsed`, and a temporary `imageUrl`.
 *   Returns an empty array if no saved images are found or if a database error occurs during fetching.
 */
export async function fetchSavedImages(): Promise<GeneratedImage[]> {
    if (!supabase) {
        logger.error('Supabase client not available. Cannot fetch saved images.');
        return [];
    }

    // Query the DB first for images marked as saved
    const { data: dbData, error: dbError } = await supabase
        .from(IMAGE_TABLE_NAME)
        .select('image_id, prompt, storage_path') // Select needed columns
        .eq('saved', true); // Filter for saved images

    if (dbError) {
        logger.error('Error fetching saved images from database:', dbError.message);
        return []
    }

    if (!dbData || dbData.length === 0) {
        logger.info('No saved images found');
        return []; // Return empty array if none are marked as saved
    }

    logger.info(`Found ${dbData.length} saved image records in DB. Fetching URLs...`);

    // Generate Signed URLs for the found images
    const results: GeneratedImage[] = [];
    const urlPromises: Promise<void>[] = []; // To run URL fetching in parallel

    for (const row of dbData) {
        if (!row.image_id) {
            logger.warn(`Skipping row with missing image_id: ${JSON.stringify(row)}`);
            continue;
        }
        if (!row.storage_path) {
            // Image marked saved but path wasn't stored.
            logger.warn(`Image ${row.image_id} is marked saved but has no storage_path in DB. Skipping.`);
            continue;
        }

        // Create a promise for each URL fetch
        const promise = supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(row.storage_path, 3600) // 1 hour expiry
            .then(({ data: signedUrlData, error: urlError }) => {
                if (urlError) {
                    logger.error(`Error creating signed URL for ${row.storage_path}:`, urlError.message);
                } else if (signedUrlData?.signedUrl) {
                    results.push({
                        id: row.image_id,
                        promptUsed: row.prompt ?? '',
                        imageUrl: signedUrlData.signedUrl,
                    });
                } else {
                    logger.warn(`No signed URL returned for ${row.storage_path}, although no error reported.`);
                }
            });

        urlPromises.push(promise);
    }

    // Wait for all signed URL requests to complete
    await Promise.all(urlPromises);

    logger.info(`Successfully processed and generated URLs for ${results.length} saved images.`);
    return results;
}