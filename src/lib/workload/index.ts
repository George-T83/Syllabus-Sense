/**
 * Public entry point for the workload / cognitive-load engine (Epic 7).
 *
 * This module is pure TypeScript — no React/JSX — so it can be unit tested
 * and reused from any layer (server actions, client components, etc.).
 */
export * from './constants';
export * from './dateUtils';
export * from './dailyLoad';
export * from './scheduling';
