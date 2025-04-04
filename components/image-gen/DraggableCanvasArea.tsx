'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { generateImage, generateImageVariations } from '@/services/falService';
import { saveImageBlob, fetchSavedImages } from '@/services/supabaseService';
import { generateUuid } from '@/services/uuidService';
import DraggableImage from './DraggableImage';
import { useDebounceWithReset } from '@/hooks/useDebounce';
import { Button } from "@/components/ui/button"
import { Squares2X2Icon, PhotoIcon } from "@heroicons/react/24/solid";


// Define the structure for storing image information
interface ImageInfo {
    id: string;
    src: string;
    prompt: string;
    position: { x: number; y: number };
    parentId?: string;
    isLoading?: boolean;
    isPlaceholder?: boolean;
}

const INITIAL_PLACEHOLDER_ID = 'initial-placeholder';
const IMAGE_SIZE = 150; // Define size constant for reuse
const DUPLICATION_OFFSET = 25; // Define offset constant
const GRID_GAP = 20;
const DEBOUNCE_DELAY = 750; // ms to wait after typing stops
const HEADER_HEIGHT = 80; // Added constant for header - used when arranging images

export default function ImageGeneratorPage() {
    const [prompt, setPrompt] = useState<string>('');
    const [images, setImages] = useState<ImageInfo[]>([]); // State to hold multiple images
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null); // ID of the selected image
    const [error, setError] = useState<string | null>(null); // For displaying errors to user
    const containerRef = useRef<HTMLDivElement>(null); // Ref for the container bounds

    // Variables to control regeneration. Debounced Prompt used to constrain how often we call the API.
    const [debouncedPrompt, resetDebouncedPrompt] = useDebounceWithReset(prompt, DEBOUNCE_DELAY);
    const isRegeneratingRef = useRef(false); // Ref to prevent parallel regenerations for the *same* image

    // Variables to control saved images
    const [isImageDropdownOpen, setIsImageDropdownOpen] = useState(false);
    const [savedImages, setSavedImages] = useState<ImageInfo[]>([]);
    const [isLoadingSavedImages, setIsLoadingSavedImages] = useState(false);

    /**
     * Updates the prompt state and immediately resets the debounced prompt value.
     * Useful when selecting an image to instantly reflect its prompt in the input.
     * @param {string} newValue - The new prompt string.
     */
    const setPromptAndResetDebounce = useCallback((newValue: string) => {
        setPrompt(newValue);
        resetDebouncedPrompt(newValue)
    }, [resetDebouncedPrompt]);

    /**
     * Toggles the visibility state of the saved images dropdown menu.
     */
    const toggleImageDropdown = useCallback(() => {
        setIsImageDropdownOpen(prev => !prev);
    }, []);

    /**
     * Clamps a given position {x, y} within the bounds of a container element.
     * Assumes the item being positioned has dimensions itemSize x itemSize.
     * @param position - The desired position { x: number; y: number }.
     * @param container - The container HTMLDivElement or null.
     * @param itemSize - The width/height of the item being positioned.
     * @returns The clamped position { x: number; y: number }.
     */
    const clampPositionToBounds = (
        position: { x: number; y: number },
        container: HTMLDivElement | null,
        itemSize: number
    ): { x: number; y: number } => {
        if (!container) {
            return position;
        }

        const containerWidth = container.offsetWidth;
        const containerScrollHeight = container.scrollHeight;

        const maxX = Math.max(0, containerWidth - itemSize);
        // Ensure maxY calculation respects minimum height set for grid, even if content is smaller initially
        const effectiveHeight = Math.max(container.offsetHeight, containerScrollHeight);
        const maxY = Math.max(0, effectiveHeight - itemSize);

        const clampedX = Math.max(0, Math.min(position.x, maxX));
        const clampedY = Math.max(0, Math.min(position.y, maxY));

        return { x: clampedX, y: clampedY };
    };

    // Effect to initialize with a placeholder if no images exist on mount
    useEffect(() => {
        if (images.length === 0 && containerRef.current) {
            setPromptAndResetDebounce('')
            const container = containerRef.current;
            const initialX = Math.max(0, (container.offsetWidth - IMAGE_SIZE) / 2);
            const initialY = Math.max(0, (container.offsetHeight - IMAGE_SIZE) / 2);

            const initialPlaceholder: ImageInfo = {
                id: INITIAL_PLACEHOLDER_ID,
                src: '',
                prompt: '',
                position: { x: initialX, y: initialY },
                isLoading: false,
                isPlaceholder: true, // Mark as placeholder
            };

            setImages([initialPlaceholder]);
            setSelectedImageId(INITIAL_PLACEHOLDER_ID);
        }
    }, [images.length]);


    /**
     * Regenerates the image content for a specific image ID using a new prompt.
     * Updates the image state with loading indicators and the final result or handles errors.
     * Prevents concurrent regeneration attempts using a ref.
     * @param {string} imageId - The ID of the image to regenerate.
     * @param {string} newPrompt - The new prompt to use for generation.
     */
    const handleRegenerateSelectedImage = useCallback(async (imageId: string, newPrompt: string) => {
        // Prevent starting a new regeneration if one is already in progress for this image
        if (isRegeneratingRef.current) {
            return;
        }
        isRegeneratingRef.current = true;

        setError(null); // Clear global error

        // Set loading state for the specific image
        setImages(prevImages =>
            prevImages.map(img =>
                img.id === imageId ? { ...img, isLoading: true } : img
            )
        );

        try {
            // When regenerating, could either pass in the old image id, or assign a new ID.
            // Since we want to allow loading of old images, and regenerating new ones, assign a new ID
            const result = await generateImage(newPrompt, IMAGE_SIZE);

            if (result.imageUrl) {
                // Update the specific image with new src and prompt, turn off loading
                setImages(prevImages =>
                    prevImages.map(img =>
                        img.id === imageId
                            ? {
                                ...img,
                                id: result.id,
                                src: result.imageUrl!,
                                prompt: result.promptUsed || newPrompt, // promptUsed should be updated to the new prompt
                                isLoading: false,
                                isPlaceholder: false,
                            }
                            : img
                    )
                );
                // since we update the ID, need to reselect
                setSelectedImageId(result.id)
            } else {
                setError("An error occurred when generating images.");
                setImages(prevImages =>
                    prevImages.map(img =>
                        img.id === imageId ? { ...img, isLoading: false } : img
                    )
                );
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred when generating images');
            setImages(prevImages =>
                prevImages.map(img =>
                    img.id === imageId ? { ...img, isLoading: false } : img
                )
            );
        } finally {
            // Set tracking ref for regeneration to false.
            isRegeneratingRef.current = false;
        }
    }, []);

    // Effect to regenerate the image as the user types. Debounced to prevent excessive API calls.
    useEffect(() => {
        // Condition: An image is selected, the debounced prompt is not empty,
        // and we aren't already regenerating this specific image.
        if (selectedImageId && debouncedPrompt.trim() && !isRegeneratingRef.current) {
            const selectedImage = images.find(img => img.id === selectedImageId);

            // Only trigger if the debounced prompt is different from the image's *current* prompt
            // Prevents redundant calls if the debounced value matches the existing one.
            if (selectedImage && selectedImage.prompt !== debouncedPrompt) {
                handleRegenerateSelectedImage(selectedImageId, debouncedPrompt);
            }
        }
    }, [debouncedPrompt, selectedImageId, handleRegenerateSelectedImage]); // Key dependencies

    /**
     * Fetches the list of saved images from the backend and updates the
     * `savedImages` state for display in the dropdown. Handles loading states and errors.
     */
    const loadSavedImagesForDropdown = useCallback(async () => {
        setIsLoadingSavedImages(true);
        try {
            const loadedImagesResult = await fetchSavedImages();

            const loadedImageInfos: ImageInfo[] = loadedImagesResult.map(result => ({
                id: result.id,
                src: result.imageUrl ?? '',
                prompt: result.promptUsed ?? 'Untitled',
                position: { x: 0, y: 0 },
            }));
            setSavedImages(loadedImageInfos);
        } catch (error) {
            setError("Failed to fetch saved images");
        } finally {
            setIsLoadingSavedImages(false);
        }
    }, []);

    // Effect to load saved images once on component mount.
    useEffect(() => {
        loadSavedImagesForDropdown();
    }, [loadSavedImagesForDropdown]);

    /**
     * Generates image variations based on a parent image's prompt.
     * Adds placeholders immediately and updates them with results or removes them on failure.
     * Handles global loading state and potential errors.
     * @param {string} parentId - The ID of the image to base variations on.
     * @param {string} parentPrompt - The prompt of the parent image.
     */
    const handleGenerateVariations = useCallback(async (parentId: string, parentPrompt: string) => {
        setError(null);

        const parentImage = images.find(img => img.id === parentId);
        if (!parentImage) {
            setError("Could not find the parent image.");
            return;
        }

        const offset = IMAGE_SIZE + GRID_GAP;
        const parentPos = parentImage.position;

        // Calculate target positions and create placeholder data immediately
        const placeholderPositions = [
            { x: parentPos.x, y: parentPos.y - offset }, // Above
            { x: parentPos.x, y: parentPos.y + offset }, // Below
            { x: parentPos.x - offset, y: parentPos.y }, // Left
            { x: parentPos.x + offset, y: parentPos.y }, // Right
        ];

        const placeholderImages: ImageInfo[] = [];
        const placeholderIds: string[] = []; // Keep track of IDs for later update

        placeholderPositions.forEach((pos, index) => {
            const placeholderId = `${parentId}-placeholder-${index}-${Date.now()}`;
            placeholderIds.push(placeholderId);
            const finalPosition = clampPositionToBounds(
                pos,
                containerRef.current,
                IMAGE_SIZE
            );

            placeholderImages.push({
                id: placeholderId,
                src: '',
                prompt: `Loading variation for: ${parentPrompt}`, // Indicate loading in alt text
                position: finalPosition,
                parentId: parentId,
                isPlaceholder: true, // Mark as placeholder
                isLoading: true,     // Mark as individually loading
            });
        });

        // Add placeholders to the state immediately
        setImages(prevImages => [...prevImages, ...placeholderImages]);

        try {
            const results = await generateImageVariations(parentPrompt, parentId, IMAGE_SIZE);
            let updateOccurred = false;

            // Use setImages once for efficiency
            setImages(prevImages => {
                // Create a copy to modify
                let newImages = [...prevImages];

                results.forEach((result, index) => {
                    const tempIdToFind = placeholderIds[index]; // Get the temp ID by index
                    if (!tempIdToFind) return; // Safety check

                    const placeholderIndex = newImages.findIndex(img => img.id === tempIdToFind);
                    if (placeholderIndex === -1) {
                        return; // Placeholder already removed or not found
                    }

                    if (result.error || !result.id || !result.imageUrl) {
                        // Handle failure for this variant: Remove the placeholder
                        newImages.splice(placeholderIndex, 1); // Remove element at index
                    } else {
                        // Handle success: Update the placeholder in place
                        newImages[placeholderIndex] = {
                            ...newImages[placeholderIndex], // Keep position, parentId etc.
                            id: result.id, // Update ID
                            src: result.imageUrl,
                            prompt: result.promptUsed || `Variant of: ${parentPrompt}`,
                            isLoading: false,
                            isPlaceholder: false,
                        };
                        updateOccurred = true;
                    }
                });
                return newImages; // Return the modified array
            });

            // Handle case where generation failed 
            if (!updateOccurred && results.length > 0 && results[0].error) {
                setError('Generation of variants failed');
                // Remove all placeholders
                setImages(prev => prev.filter(img => !placeholderIds.includes(img.id)));
            }
        } catch (err: any) {
            // Remove all placeholders on unexpected client error
            setImages(prev => prev.filter(img => !placeholderIds.includes(img.id)));
        }
    }, [images]);

    
    /**
     * Creates a duplicate of an existing image, placing it offset from the original.
     * Assigns a new unique ID and selects the duplicated image.
     * @param {string} sourceImageId - The ID of the image to duplicate.
     */
    const handleDuplicateImage = useCallback(async (sourceImageId: string) => {
        setError(null);

        const sourceImage = images.find(img => img.id === sourceImageId);
        if (!sourceImage) {
            setError("Could not find the image to duplicate.");
            return;
        }

        // Calculate new position with offset
        let newX = sourceImage.position.x + IMAGE_SIZE + DUPLICATION_OFFSET;
        let newY = sourceImage.position.y;
        let position = clampPositionToBounds(
            { x: newX, y: newY },
            containerRef.current, // Pass the container element
            IMAGE_SIZE
        );

        const uuid = await generateUuid();
        if (!uuid) {
            setError("Failed to get image to duplicate.");
            return;
        }

        // Create the new image object
        const newImage: ImageInfo = {
            id: uuid, // Unique ID for the copy
            src: sourceImage.src, // Copy source URL
            prompt: sourceImage.prompt, // Copy prompt
            position: position, // Set offset position
            parentId: sourceImageId, // Set parentId to the original image's ID
            isLoading: false,
            isPlaceholder: false,
        };

        // Add the new image
        setImages(prevImages => [...prevImages, newImage]);

        // Select the newly duplicated image
        setSelectedImageId(newImage.id);

    }, [images]);


    /**
     * Handles the selection of an image. Updates the selected ID state
     * and sets the main prompt input to match the selected image's prompt.
     * Prevents selection if an image regeneration is currently in progress.
     * @param {string} id - The ID of the image being selected.
     */
    const handleSelectImage = useCallback((id: string) => {
        // Don't allow reselection when there's an image being updated
        if (isRegeneratingRef.current) {
            return
        }
        setSelectedImageId(id);
        const selectedImage = images.find(image => image.id === id);
        const newPrompt = selectedImage ? (selectedImage.prompt ?? '') : '';
        // Update the prompt and debounced prompt
        setPromptAndResetDebounce(newPrompt)
    }, [images, setPromptAndResetDebounce]);

    /**
     * Updates the position state for a specific image, typically called
     * after a drag-and-drop operation completes.
     * @param {string} id - The ID of the image whose position changed.
     * @param {object} newPosition - The new {x, y} coordinates.
     */
    const handleUpdatePosition = useCallback((id: string, newPosition: { x: number; y: number }) => {
        setImages((prevImages) =>
            prevImages.map((img) =>
                img.id === id ? { ...img, position: newPosition } : img
            )
        );
    }, []);

    /**
     * Removes an image from the canvas state based on its ID.
     * If the deleted image was selected, it deselects it.
     * @param {string} id - The ID of the image to delete.
     */
    const handleDeleteImage = useCallback((id: string) => {
        setImages((prevImages) => prevImages.filter((img) => img.id !== id));
        if (selectedImageId === id) {
            setSelectedImageId(null); // Deselect if the deleted image was selected
        }
    }, [selectedImageId]);

    /**
     * Handles clicks on the main container background.
     * Deselects any currently selected image and clears the prompt input.
     */
    const handleContainerClick = useCallback(() => {
        setSelectedImageId(null);
        setPromptAndResetDebounce('');
    }, [setPromptAndResetDebounce]);

    /**
     * Arranges all current images into a grid layout within the container bounds.
     * Calculates columns based on available width and centers the grid.
     * Deselects any selected image after arranging.
     */
    const handleArrangeGrid = useCallback(() => {
        if (!containerRef.current || images.length === 0) {
            setError("Failed to arrange images");
            return;
        }
        setError(null);

        const container = containerRef.current;
        const containerWidth = container.offsetWidth;

        // Calculate how many columns can fit
        const availableWidth = containerWidth - GRID_GAP;
        const itemTotalWidth = IMAGE_SIZE + GRID_GAP;
        const numColumns = Math.max(1, Math.floor(availableWidth / itemTotalWidth));

        // Calculate total number of rows needed
        const numRows = Math.ceil(images.length / numColumns);

        // Calculate the total required width and height for the grid itself
        const gridWidth = numColumns * IMAGE_SIZE + Math.max(0, numColumns - 1) * GRID_GAP;
        const gridHeight = numRows * IMAGE_SIZE + Math.max(0, numRows - 1) * GRID_GAP;

        // Calculate starting offset for horizontal centering
        const offsetX = Math.max(GRID_GAP, (containerWidth - gridWidth) / 2);

        // Calculate starting Y offset: Header height + desired gap below header
        const offsetY = HEADER_HEIGHT + GRID_GAP; // Use header height constant

        // Calculate the required minimum height for the container
        // Height = Space above grid (offsetY) + Grid height + Space below grid (GRID_GAP)
        const requiredContainerHeight = offsetY + gridHeight + GRID_GAP; // Adjusted calculation

        // --- Set the container's minimum height ---
        // Ensure it's at least the viewport height if the grid is small
        container.style.minHeight = `${requiredContainerHeight}px`;

        // Calculate new positions for each image
        const newImages = images.map((image, index) => {
            const row = Math.floor(index / numColumns);
            const col = index % numColumns;

            const newX = offsetX + col * itemTotalWidth;
            const newY = offsetY + row * (IMAGE_SIZE + GRID_GAP); // Uses the new offsetY

            // Clamp X manually within the container width
            const clampedX = Math.max(0, Math.min(newX, containerWidth - IMAGE_SIZE));

            return {
                ...image,
                position: { x: clampedX, y: newY },
            };
        });

        setImages(newImages);
        setSelectedImageId(null);
    }, [images]);

    /**
     * Handles changes to the main prompt input field.
     * Updates the `prompt` state directly. Debouncing is handled by the `useDebounceWithReset` hook.
     * @param {React.ChangeEvent<HTMLInputElement>} event - The input change event.
     */
    const handlePromptInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const newPromptValue = event.target.value;
        setPrompt(newPromptValue);
    }, []);


    /**
     * Saves a specific image to the backend using its ID and source URL.
     * Reloads the saved images dropdown on success. Displays error notifications.
     * This function is passed down to the DraggableImage component.
     * @param {string} id - The unique ID of the image to save.
     * @param {string} src - The source URL or data URI of the image.
     */
    const handleSaveImage = useCallback(async (id: string, src: string) => {
        try {
            await saveImageBlob(id, src);
            loadSavedImagesForDropdown();
        } catch (error) {
            setError("Failed to save image")
        }
    }, [loadSavedImagesForDropdown]);

    /**
     * Handles the selection of an image from the saved images dropdown.
     * Adds the selected image to the main canvas, positioning it in the center.
     * Closes the dropdown and selects the newly added image.
     * @param {ImageInfo} selectedImageInfo - The data of the image selected from the dropdown.
     */
    const handleSelectSavedImage = useCallback((selectedImageInfo: ImageInfo) => {
        if (!containerRef.current) {
            setIsImageDropdownOpen(false); // Close dropdown anyway
            return; // Cannot calculate center position
        }

        // --- Calculate Center Position ---
        const container = containerRef.current;
        const centerX = Math.max(0, (container.offsetWidth - IMAGE_SIZE) / 2);
        const centerY = Math.max(0, (container.offsetHeight - IMAGE_SIZE) / 2);

        // --- Create the new ImageInfo object for the canvas ---
        // We use the data from the selected saved image, but give it the new centered position
        const newCanvasImage: ImageInfo = {
            id: selectedImageInfo.id,
            src: selectedImageInfo.src,
            prompt: selectedImageInfo.prompt,
            position: { x: centerX, y: centerY },
            isLoading: false,
            isPlaceholder: false,
        };

        // --- Update State ---
        setPromptAndResetDebounce(selectedImageInfo.prompt)
        setImages(prevImages => [...prevImages.filter(img => img.id !== newCanvasImage.id), newCanvasImage]);
        // Select the newly added image
        setSelectedImageId(newCanvasImage.id);
        setIsImageDropdownOpen(false);
    }, [setPromptAndResetDebounce]);

    // Determine if the main prompt input should be disabled (if no image is selected)
    const isPromptInputDisabled = !selectedImageId;

    const canvasBackgroundStyle = {
        backgroundImage: 'radial-gradient(circle, #e0e0e0 1px, transparent 1px)',
        backgroundSize: '15px 15px', // Size of the repeating pattern
    };

    return (
        <main className="flex flex-col min-h-screen w-screen bg-gradient-to-b from-white to-gray-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 z-20 p-4 h-20">
                <h1
                    className="
                        hidden md:block
                        absolute left-4 top-1/2 transform -translate-y-1/2
                        md:text-xs lg:text-xl xl:text-3xl
                        font-bold tracking-wide
                        bg-gradient-to-r from-indigo-500 to-purple-500
                        bg-clip-text text-transparent
                "
                >
                    Live Image Generation
                </h1>

                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-xl lg:max-w-2xl px-4">
                    <div className={`
                        flex items-center gap-2
                        backdrop-blur-sm rounded-full shadow-md p-2
                        transition-colors duration-200
                        ${isPromptInputDisabled ? 'bg-gray-100/90' : 'bg-white/90'}
                        ${isPromptInputDisabled ? 'cursor-not-allowed' : ''}
                    `}>
                        <input
                            type="text"
                            value={prompt}
                            onChange={handlePromptInputChange}
                            placeholder={isPromptInputDisabled ? "Select an image" : "Enter prompt for selected image"}
                            className={`
                                flex-grow p-2 bg-transparent focus:outline-none text-gray-700
                                disabled:text-gray-400
                                disabled:cursor-not-allowed
                                transition-colors duration-200
                            `}
                            disabled={isPromptInputDisabled}
                        />
                    </div>
                </div>

                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <div className="relative">
                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={toggleImageDropdown}
                            className="rounded-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            title="Saved Images"
                        >
                            <PhotoIcon className="h-5 w-5" />
                        </Button>

                        {isImageDropdownOpen && (
                            <div
                            className="absolute right-0 top-full mt-2 w-30 sm:w-96 max-h-[60vh] flex flex-col bg-white rounded-md shadow-lg z-50 border border-gray-200"
                            >
                                <div className="px-4 py-2 border-b border-gray-200 flex-shrink-0">
                                    <h3 className="text-sm font-semibold text-gray-800">
                                        Saved Images
                                    </h3>
                                </div>
                                <div className="overflow-y-auto flex-grow">
                                    {isLoadingSavedImages ? (
                                        <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
                                    ) : savedImages.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-gray-500">No saved images found.</div>
                                    ) : (
                                        savedImages.map(imageInfo => (
                                            <button
                                                key={imageInfo.id}
                                                onClick={() => handleSelectSavedImage(imageInfo)}
                                                className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                title={imageInfo.prompt}
                                            >
                                                <img
                                                    src={imageInfo.src}
                                                    alt="Saved image"
                                                    className="h-20 w-20 sm:h-24 sm:w-24 object-cover rounded mr-3 flex-shrink-0"
                                                />
                                                <span className="truncate hidden sm:block">
                                                    {imageInfo.prompt || ''}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={handleArrangeGrid}
                        disabled={images.length < 2}
                        className="rounded-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title="Arrange" // Updated Tooltip
                    >
                        <Squares2X2Icon className="h-5 w-5" />
                    </Button>

                </div>
            </div>

            <div
                ref={containerRef}
                className="flex-grow w-full border-t border-dashed border-gray-300 bg-gray-50/80 relative select-none overflow-y-auto"
                onClick={handleContainerClick}
                style={{
                    ...canvasBackgroundStyle,
                }}
            >
                {images.map((image, index) => (
                    <DraggableImage
                        key={image.id}
                        id={image.id}
                        src={image.src}
                        alt={image.prompt}
                        isSelected={selectedImageId === image.id}
                        onSelect={handleSelectImage}
                        position={image.position}
                        onPositionChange={handleUpdatePosition}
                        onDelete={handleDeleteImage}
                        onGenerateVariations={handleGenerateVariations}
                        onDuplicate={handleDuplicateImage}
                        onSave={handleSaveImage}
                        isLoading={image.isLoading}
                        isPlaceholder={image.isPlaceholder}
                        zIndex={0}
                        imageSize={IMAGE_SIZE}
                    />
                ))}
                {error && (
                    <p className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-red-100 text-red-700 p-3 rounded-md shadow-lg text-center max-w-md">
                        Error: {error}
                    </p>
                )}
            </div>
        </main>
    );
}