/**
 * Core type definitions for LinkHub
 */

export interface Link {
  _id: string; // ObjectId as string when sent to client
  title: string; // required
  url: string; // required, must be valid http/https URL
  description?: string; // optional, auto-fetched or user-provided
  favicon?: string; // optional, URL to favicon
  category?: string; // optional, single main category
  tags: string[]; // array of tags, defaults to []
  createdAt: string; // ISO 8601 datetime string
  updatedAt: string; // ISO 8601 datetime string
}

export interface MetadataResult {
  title?: string;
  description?: string;
  favicon?: string;
}

export interface LinkQuery {
  q?: string;
  category?: string;
  tag?: string;
}
