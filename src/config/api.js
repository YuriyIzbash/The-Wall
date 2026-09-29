export const API_BASE_URL = '/api';

export const apiFetch = async (path, options) => {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error('The server returned an invalid response.');
  }

  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error?.message || `Request failed with status ${response.status}.`);
  }

  return payload.data;
};
