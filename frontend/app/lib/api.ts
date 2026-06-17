import type { ApiErrorResponse, CompetitorProgression } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchProgression(
  wcaId: string
): Promise<CompetitorProgression> {
  const response = await fetch(
    `${API_BASE_URL}/api/competitor/${encodeURIComponent(wcaId)}/progression`
  );
  const data = (await response.json().catch(() => null)) as
    | CompetitorProgression
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }

  return data as CompetitorProgression;
}

export function errorText(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "Something went wrong while building the progression.";
}

function getErrorMessage(
  data: CompetitorProgression | ApiErrorResponse | null,
  status: number
) {
  if (data && "detail" in data && data.detail) {
    return data.detail;
  }

  if (status === 404) {
    return "No matching competitor results were found.";
  }

  if (status === 400) {
    return "That WCA ID does not look valid.";
  }

  return "The backend could not complete the progression search.";
}
