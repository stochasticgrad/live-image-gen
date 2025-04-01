# Live Image Generation Canvas

This project is a web application built with Next.js that provides an interactive canvas for generating images using AI. Users can type prompts, generate images, create variations, duplicate images, arrange them on a canvas, drag them around, and save their favorites.

## Features

*   **Live Image Generation:** Type a prompt for a selected image, and it regenerates automatically (debounced).
*   **Image Variations:** Generate multiple variations based on an existing image's prompt using Fal AI and OpenAI.
*   **Interactive Canvas:** Drag and drop images freely within the canvas bounds.
*   **Image Selection:** Click to select an image, loading its prompt into the main input.
*   **Duplication:** Create copies of existing images on the canvas.
*   **Save Functionality:** Save generated images to Supabase Storage and mark them in the database.
*   **Saved Images Browser:** View and load previously saved images back onto the canvas via a dropdown.
*   **Grid Layout:** Automatically arrange all images on the canvas into a neat grid.
*   **Loading & Placeholder States:** Clear visual feedback for ongoing operations and empty states.

## Tech Stack

*   **Framework:** Next.js 14+ (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn UI (implied by `components/ui`)
*   **AI Generation:**
    *   Fal AI (`@fal-ai/client`): For core image generation and variations.
    *   OpenAI (`openai`): For augmenting prompts to create variation ideas.
*   **Backend & Storage:** Supabase (PostgreSQL Database, Storage)
*   **State Management:** React Hooks (`useState`, `useCallback`, `useRef`, `useEffect`)
*   **Dragging:** `react-draggable`
*   **Tooltips:** `tippy.js`
*   **Logging:** `pino`
*   **UUID Generation:** `uuid`

## Project Structure
```
├── app # Next.js App Router pages and layouts
│ ├── page.tsx # Main application page component
│ ├── layout.tsx # Root layout
│ └── globals.css # Global styles
├── components # Reusable React components
│ ├── image-gen # Feature-specific components for image generation
│ │ ├── DraggableCanvasArea.tsx # (Implicitly part of page.tsx logic)
│ │ └── DraggableImage.tsx # Component for individual draggable images
│ └── ui # Generic UI primitives (e.g., Shadcn Button)
├── hooks # Custom React hooks
│ └── useDebounce.ts # Debounces input with reset capability
├── lib # Core libraries and utilities
│ ├── logger.ts # Pino logger setup
│ ├── supabase.ts # Supabase client initialization (server-side)
│ └── utils.ts # General utility functions
├── services # Backend interaction logic (Server Actions)
│ ├── falService.ts # Fal AI API interactions
│ ├── openaiService.ts # OpenAI API interactions
│ ├── supabaseService.ts # Supabase Database & Storage interactions
│ └── uuidService.ts # UUID generation
├── types # TypeScript type definitions
│ ├── database.types.ts # Auto-generated Supabase types
│ ├── generatedImage.ts # Custom type for image data structure
│ └── relationshipType.ts # Type definition for image relationships
├── public # Static assets
├── next.config.ts # Next.js configuration
├── tsconfig.json # TypeScript configuration
└── package.json # Project dependencies and scripts
```

### Database Schema

Postgres DB Schema is as follows:

1.  **`images` Table:**
    *   `image_id` (Primary Key, UUID or Text)
    *   `prompt` (Text)
    *   `created_at` (Timestamp, defaults to `now()`)
    *   `saved` (Boolean, defaults to `false`)
    *   `storage_path` (Text, nullable) - Stores the path in Supabase Storage once saved.

2.  **`image_relationships` Table:**
    *   `id` (Primary Key, BigInt, auto-incrementing)
    *   `source_image` (UUID or Text, Foreign Key referencing `images.image_id`)
    *   `target_image` (UUID or Text, Foreign Key referencing `images.image_id`)
    *   `relationship_type` (Integer) - e.g., 1 for "Parent" -> "Child"
    *   `created_at` (Timestamp, defaults to `now()`)


### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```