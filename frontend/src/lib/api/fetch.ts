type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
};

type ApiResult<T> = ApiSuccess<T> | ApiFailure;

function withDefaultCredentials(init?: RequestInit): RequestInit {
  return {
    credentials: "include",
    ...init,
  };
}

function withJsonHeaders(init?: RequestInit): RequestInit {
  return {
    ...withDefaultCredentials(init),
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  };
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  let payload: ApiResult<T> | null = null;

  try {
    payload = (await response.json()) as ApiResult<T>;
  } catch {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    throw new Error("Invalid API response");
  }

  if (!payload || !("success" in payload)) {
    throw new Error("Invalid API response shape");
  }

  if (!payload.success) {
    throw new Error(payload.error?.message ?? "Request failed");
  }

  return payload.data;
}

export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, withDefaultCredentials(init));
  return parseApiResponse<T>(response);
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    ...withJsonHeaders(init),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseApiResponse<T>(response);
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    ...withJsonHeaders(init),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseApiResponse<T>(response);
}

export async function apiDelete<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    method: "DELETE",
    ...withDefaultCredentials(init),
  });
  return parseApiResponse<T>(response);
}
