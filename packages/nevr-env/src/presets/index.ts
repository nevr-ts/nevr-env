/**
 * nevr-env Presets
 * 
 * Pre-configured environment plugins for popular platforms
 * All presets use the createPlugin pattern for consistency
 */

// Vercel preset
export { vercel, isVercel, isVercelPreview, isVercelProduction, getVercelUrl } from "./vercel";
export type { VercelEnv, VercelOptions } from "./vercel";

// Netlify preset
export { netlify, isNetlify, isNetlifyPreview, isNetlifyProduction, getNetlifyUrl } from "./netlify";
export type { NetlifyEnv, NetlifyOptions } from "./netlify";

// Railway preset
export { railway, isRailway, isRailwayProduction, getRailwayUrl } from "./railway";
export type { RailwayEnv, RailwayOptions } from "./railway";
