import { PersistedModelV3, parseModelDocument } from './modelPersistence';

/**
 * High-density technical comment: 
 * Client-side service for interacting with the Server-side Persistence API.
 * Uses standard fetch API with robust error handling and type-safe responses.
 */

const API_BASE = '/api/v1/models';

export async function listServerModels(): Promise<Array<{ id: string; name: string; version: number; updated_at: string }>> {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchServerModel(id: string): Promise<PersistedModelV3> {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch model: ${response.statusText}`);
  }
  const result = await response.json();
  // Ensure the model data is valid before returning
  return parseModelDocument(JSON.stringify(result.data));
}

export async function saveServerModel(id: string, name: string, model: PersistedModelV3): Promise<void> {
  // Check if it exists to decide between POST and PUT
  // For simplicity, we can try PUT first and if 404, try POST? 
  // Or just use the 'id' to determine if it's new.
  
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data: model })
  });

  if (response.status === 404) {
    // Try POST if not found
    const createResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data: model })
    });
    if (!createResponse.ok) {
      throw new Error(`Failed to create model: ${createResponse.statusText}`);
    }
  } else if (!response.ok) {
    throw new Error(`Failed to update model: ${response.statusText}`);
  }
}

export async function deleteServerModel(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error(`Failed to delete model: ${response.statusText}`);
  }
}
