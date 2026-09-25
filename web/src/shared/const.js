// World layout: identical to the Unity build (Voxelwild.World.VoxelConstants).
export const CS = 32;                 // section edge
export const CS2 = CS * CS;
export const CS3 = CS2 * CS;
export const MIN_SY = -2;             // sections -2..5 => y -64..191
export const MAX_SY = 5;
export const SECTIONS = MAX_SY - MIN_SY + 1;
export const MIN_Y = MIN_SY * CS;
export const MAX_Y = (MAX_SY + 1) * CS;
export const HEIGHT = MAX_Y - MIN_Y;  // 256
export const SEA = 64;
export const MAX_LIGHT = 15;

// mesher / lighting region: section + 16-voxel margin (every light source that can reach the section)
export const RM = 16;
export const RS = CS + 2 * RM;        // 64
export const RS2 = RS * RS;
export const RS3 = RS2 * RS;

export const idx = (x, y, z) => x + (z << 5) + (y << 10);              // section-local
export const colIdx = (x, wy, z) => { const y = wy - MIN_Y; return ((y >> 5) * CS3) + x + (z << 5) + ((y & 31) << 10); };
export const regIdx = (x, y, z) => (x + RM) + (z + RM) * RS + (y + RM) * RS2;
export const floorDiv = (a, b) => Math.floor(a / b);
