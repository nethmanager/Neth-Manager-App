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

export async function testOllamaConnection(endpoint: string): Promise<string[] | null> {
  try {
    const { tagsUrl } = getOllamaUrls(endpoint);
    const response = await fetch(tagsUrl, {
      method: 'GET',
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    }
    return null;
  } catch (error) {
    console.error('Ollama connection test failed:', error);
    return null;
  }
}

export async function generateResponse(
  endpoint: string,
  model: string,
  prompt: string,
  system?: string,
  temperature?: number,
  max_tokens?: number
): Promise<string> {
  try {
    const { generateUrl } = getOllamaUrls(endpoint);
    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        system: system,
        stream: false,
        options: {
          temperature: temperature ?? 0.7,
          num_predict: max_tokens ?? 2048,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data: OllamaResponse = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error generating Ollama response:', error);
    throw error;
  }
}

