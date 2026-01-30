/**
 * Legacy Modules Feature - Stub Implementation
 *
 * This module contains minimal stubs for the legacy "modules" feature
 * that has been removed from the codebase. These stubs exist solely
 * to allow UI components to compile.
 *
 * WARNING: These are non-functional stubs. Do not use in production.
 */

/**
 * Module content types
 */
export const MODULE_CONTENT_TYPES = [
  "video",
  "task",
  "image",
  "pdf",
  "text",
] as const;

/**
 * Module content type union
 */
export type ModuleContentType = (typeof MODULE_CONTENT_TYPES)[number];
