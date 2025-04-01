// Type defining links between images and their generated variants. Stored in the supabase db.
export const RelationshipType = {
    UNKNOWN: 0,
    IS_PARENT: 1, // Source is parent of Target
} as const;

export type RelationshipTypeValue = typeof RelationshipType[keyof typeof RelationshipType];
