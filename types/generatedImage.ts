// Interface for FalService, stores information about the generated image.
export interface GeneratedImage {
  id: string;
  imageUrl?: string;
  promptUsed?: string;
  error?: string;
}