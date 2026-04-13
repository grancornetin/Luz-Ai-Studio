// api/_lib/vertexClient.ts
// Underscore prefix = Vercel ignores this as a route
// Shared Vertex AI initialization for all API routes

import { VertexAI } from '@google-cloud/vertexai';

let vertexInstance: VertexAI | null = null;

export function getVertex(): VertexAI {
  if (vertexInstance) return vertexInstance;

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION || 'us-central1';

  if (!credentialsJson || !projectId) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_KEY or GCP_PROJECT_ID environment variables.'
    );
  }

  let credentials: Record<string, unknown>;
  try {
    // Soporta tanto JSON directo como Base64-encoded
    const decoded = credentialsJson.startsWith('{')
      ? credentialsJson
      : Buffer.from(credentialsJson, 'base64').toString('utf-8');
    credentials = JSON.parse(decoded);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON or Base64.');
  }

  vertexInstance = new VertexAI({
    project: projectId,
    location,
    googleAuthOptions: {
      credentials,
    },
  });

  return vertexInstance;
}

export function getProjectId(): string {
  return process.env.GCP_PROJECT_ID || '';
}

export function getLocation(): string {
  return process.env.GCP_LOCATION || 'us-central1';
}
