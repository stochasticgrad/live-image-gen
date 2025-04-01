'use client';

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { XMarkIcon, SparklesIcon, DocumentDuplicateIcon, BookmarkIcon, PhotoIcon } from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface DraggableImageProps {
    id: string;
    src: string;
    alt: string;
    isSelected: boolean;
    position: { x: number; y: number };
    onSelect: (id: string) => void;
    onPositionChange: (id: string, position: { x: number; y: number }) => void;
    onDelete?: (id: string) => void;
    onGenerateVariations?: (parentId: string, prompt: string) => void;
    onDuplicate?: (sourceId: string) => void;
    onSave?: (id: string, src: string) => Promise<void>;
    zIndex: number;
    isLoading?: boolean;
    isPlaceholder?: boolean;
    imageSize?: number;
}

export default function DraggableImage({
    id,
    src,
    alt,
    isSelected,
    position,
    onSelect,
    onPositionChange,
    onDelete,
    onGenerateVariations,
    onDuplicate,
    onSave,
    zIndex,
    isLoading,
    isPlaceholder,
    imageSize = 256,
}: DraggableImageProps) {

    const [isSaving, setIsSaving] = useState(false);
    // --- Add isDragging state ---
    const [isDragging, setIsDragging] = useState(false);
    const nodeRef = useRef<HTMLDivElement>(null);

    const handleDragStart = (e: DraggableEvent, data: DraggableData) => {
        setIsDragging(true); // Set dragging state to true
        onSelect(id);       // Keep selection logic
    };

    const handleDragStop = (e: DraggableEvent, data: DraggableData) => {
        setIsDragging(false);
        onPositionChange(id, { x: data.x, y: data.y });
    };

    // --- Button Click Handlers ---
    const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (onDelete) onDelete(id);
    };

    const handleVariationsClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (onGenerateVariations) onGenerateVariations(id, alt);
    };

    const handleDuplicateClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (onDuplicate) onDuplicate(id);
    };

    const handleSaveClick = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!onSave || isSaving) return;
        setIsSaving(true);
        try {
            await onSave(id, src);
        } catch (error) {
            throw error
        } finally {
            setIsSaving(false);
        }
    }, [id, src, onSave, isSaving]);

    const handleWrapperClick = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
         // Only select if not currently dragging (drag start handles selection)
         // And if clicking the wrapper or the image itself
        if (!isDragging && (event.target === event.currentTarget || event.target instanceof HTMLImageElement)) {
            onSelect(id);
        }
    }

    // Base classes for all icon buttons in this group
    const iconButtonBaseClasses = "rounded-full w-5 h-5 flex items-center justify-center transition-transform hover:scale-110";
    // Consistent icon size
    const iconSizeClasses = "h-3 w-3";


    return (
        <Draggable
            nodeRef={nodeRef as React.RefObject<HTMLElement>}
            onStart={handleDragStart}
            onStop={handleDragStop}
            position={position}
            bounds="parent"
            cancel=".cancel-drag"
        >
            <div
                ref={nodeRef}
                style={{
                    // --- Update zIndex logic ---
                    zIndex: isDragging ? zIndex + 20 : (isSelected ? zIndex + 10 : zIndex), // Highest zIndex while dragging
                    width: `${imageSize}px`,
                    height: `${imageSize}px`,
                    willChange: 'transform', // Hint to the browser about optimization
                }}
                onClick={handleWrapperClick}
                // Apply grab cursor when not actively dragging, grabbing when dragging
                className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                aria-busy={isLoading}
            >
                <Tippy content={alt || ''} placement="top" disabled={!alt || isDragging}>
                    <div
                        className={`
                            relative w-full h-full transition-shadow duration-150 rounded overflow-hidden
                            ${isSelected && !isDragging ? 'ring-4 ring-blue-500 ring-offset-1' : ''}
                            ${isDragging ? 'shadow-2xl' : ''}
                            ${!isSelected && !isPlaceholder && !isDragging ? 'shadow-md hover:shadow-lg' : ''}
                            ${isPlaceholder ? 'bg-gray-100' : ''}
                        `}
                    >
                        {isPlaceholder ? (
                            <div
                                className="placeholder-div w-full h-full border-2 border-dashed border-gray-400 flex items-center justify-center"
                                aria-label="Placeholder image"
                            >
                                {<PhotoIcon className="h-16 w-16 text-gray-500" />}
                            </div>
                        ) : (
                            <Image
                                src={src}
                                alt={alt}
                                width={imageSize}
                                height={imageSize}
                                className={`object-contain block w-full h-full bg-gray-200`}
                                priority={isSelected}
                                draggable={false}
                                unoptimized={isDragging}
                            />
                        )}

                        {/* Loading Indicator Overlay */}
                        {isLoading && (
                             <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                                <Loader2 className="h-10 w-10 animate-spin text-white" />
                            </div>
                        )}

                        {/* Action Buttons: Show only when selected AND NOT dragging */}
                        {isSelected && !isLoading && !isPlaceholder && !isDragging && (
                             <div className="absolute top-1 right-1 z-20 flex flex-col gap-1 cancel-drag">
                                {onDelete && (
                                    <Button
                                        onClick={handleDeleteClick}
                                        variant="destructive"
                                        size="icon"
                                        className={iconButtonBaseClasses}
                                        aria-label="Delete image"
                                        title="Delete"
                                    >
                                        <XMarkIcon className={iconSizeClasses} />
                                    </Button>
                                )}

                                {onGenerateVariations && (
                                    <Button
                                        onClick={handleVariationsClick}
                                        variant="outline"
                                        size="icon"
                                        className={`${iconButtonBaseClasses} bg-blue-500 hover:bg-blue-700 text-white border-transparent`}
                                        aria-label="Generate variations"
                                        title="Generate Variations"
                                    >
                                        <SparklesIcon className={iconSizeClasses} />
                                    </Button>
                                )}

                                {onDuplicate && (
                                    <Button
                                        onClick={handleDuplicateClick}
                                        variant="outline"
                                        size="icon"
                                        className={`${iconButtonBaseClasses} bg-green-500 hover:bg-green-700 text-white border-transparent`}
                                        aria-label="Duplicate image"
                                        title="Duplicate"
                                    >
                                        <DocumentDuplicateIcon className={iconSizeClasses} />
                                    </Button>
                                )}

                                {onSave && (
                                    <Button
                                        onClick={handleSaveClick}
                                        variant="outline"
                                        size="icon"
                                        className={`${iconButtonBaseClasses} bg-purple-500 hover:bg-purple-700 text-white border-transparent disabled:opacity-50`}
                                        aria-label="Save Image"
                                        title="Save Image"
                                        disabled={isSaving}
                                    >
                                        {isSaving
                                            ? <Loader2 className={`${iconSizeClasses} animate-spin text-white`} />
                                            : <BookmarkIcon className={iconSizeClasses} />
                                        }
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </Tippy>
            </div>
        </Draggable>
    );
}