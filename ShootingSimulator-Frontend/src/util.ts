export interface Translation2d { x: number; y: number; }

export function angle(vector: Translation2d | undefined): number {
    if (!vector) return 0;
    return Math.atan2(vector.y, vector.x) * 180 / Math.PI;
}