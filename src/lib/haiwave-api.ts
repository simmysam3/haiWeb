/**
 * HAIWAVE Central API client.
 *
 * The portal calls haiCore for all network operations:
 * - Participant CRUD
 * - Manifest exchange
 * - Trading relationships
 * - Behavioral scores
 * - Agent registration and status
 * - Go Fish (network directory)
 *
 * The portal does NOT directly access the central PostgreSQL database.
 * All data flows through the haiCore API.
 */

const API_URL = process.env.HAIWAVE_API_URL ?? "http://localhost:3000";

export const haiwaveApiUrl = `${API_URL}/api/v1`;

// TODO: Implement authenticated API client (bearer token from Keycloak)
// TODO: Participant profile operations
// TODO: Agent registration and key provisioning
// TODO: Trading relationship management
// TODO: Behavioral score retrieval
// TODO: Manifest operations
