export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

function getOllamaUrls(endpoint: string): { baseUrl: string; generateUrl: string; tagsUrl: string } {
  let cleaned = (endpoint || '').trim();
  
  // Strip trailing slashes
  while (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  
  // Determine baseUrl
  let baseUrl = cleaned;
  if (cleaned.endsWith('/api/generate')) {
    baseUrl = cleaned.slice(0, -13);
  }
  
  // Strip trailing slashes from baseUrl just in case
  while (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  return {
    baseUrl,
    generateUrl: `${baseUrl}/api/generate`,
    tagsUrl: `${baseUrl}/api/tags`
  };
}

// Check if an endpoint is public (can be queried via proxy)
function isPublicEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !host.startsWith('10.');
  } catch (e) {
    return false;
  }
}

export async function testOllamaConnection(endpoint: string): Promise<string[] | null> {
  const { tagsUrl } = getOllamaUrls(endpoint);
  
  // Try client-side direct connection first
  try {
    const response = await fetch(tagsUrl, {
      method: 'GET',
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    }
  } catch (error) {
    console.warn('Ollama client-side connection test failed, trying server-side proxy fallback...', error);
  }

  // If client-side failed, and it is a public endpoint, fallback to server-side proxy
  if (isPublicEndpoint(tagsUrl)) {
    try {
      const response = await fetch('/api/ollama/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: tagsUrl,
          method: 'GET'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.models?.map((m: any) => m.name) || [];
      }
    } catch (proxyError) {
      console.error('Ollama server-side proxy test failed:', proxyError);
    }
  }
  return null;
}

export async function generateResponse(
  endpoint: string,
  model: string,
  prompt: string,
  system?: string,
  temperature?: number,
  max_tokens?: number
): Promise<string> {
  const { generateUrl } = getOllamaUrls(endpoint);
  const payload = {
    model: model,
    prompt: prompt,
    system: system,
    stream: false,
    options: {
      temperature: temperature ?? 0.7,
      num_predict: max_tokens ?? 2048,
      num_ctx: 16384, // Ensure Ollama uses a larger context window (default is 2048)
    }
  };

  let clientError: Error | null = null;

  // Try client-side direct connection first
  try {
    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data: any = await response.json();
      if (data && data.error) {
        throw new Error(`Ollama error: ${data.error}`);
      }
      const responseText = data.response || data.message?.content || '';
      if (typeof responseText !== 'string' || responseText.trim() === '') {
        throw new Error(`Ollama returned empty content. Response payload: ${JSON.stringify(data)}`);
      }
      return responseText;
    } else {
      const errText = await response.text().catch(() => "Unknown error");
      throw new Error(`Ollama server returned error HTTP ${response.status}: ${errText}`);
    }
  } catch (error: any) {
    clientError = error;
    console.warn('Ollama client-side generation failed, trying server-side proxy fallback...', error);
  }

  // Fallback to server proxy
  if (isPublicEndpoint(generateUrl)) {
    try {
      const response = await fetch('/api/ollama/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: generateUrl,
          method: 'POST',
          body: payload
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        throw new Error(`Ollama proxy error HTTP ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      if (data && data.error) {
        throw new Error(`Ollama proxy error: ${data.error}`);
      }
      const responseText = data.response || data.message?.content || '';
      if (typeof responseText !== 'string' || responseText.trim() === '') {
        throw new Error(`Ollama proxy returned empty content. Response payload: ${JSON.stringify(data)}`);
      }
      return responseText;
    } catch (proxyError: any) {
      console.error('Ollama server-side proxy generation failed:', proxyError);
      throw new Error(`Ollama proxy failed: ${proxyError.message}`);
    }
  }

  // If we get here, client-side direct request failed and proxy wasn't applicable.
  // Bubble up the actual client-side error so the user can see exactly why it failed!
  throw new Error(clientError ? clientError.message : 'Could not reach local Ollama client-side.');
}
