/**
 * Core type definitions for LinkHub
 */

export interface User {
  _id: string;
  email: string;
  name?: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export type PublicUser = Pick<User, '_id' | 'email' | 'name' | 'createdAt'>;

export interface Link {
  _id: string;
  ownerId: string;
  title: string;
  url: string;
  description?: string;
  favicon?: string;
  category?: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
