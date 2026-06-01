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

export async function testOllamaConnection(endpoint: string): Promise<string[] | null> {
  try {
    // Using the tags endpoint as a health check
    const baseUrl = endpoint.replace('/api/generate', '');
    const response = await fetch(`${baseUrl}/api/tags`, {
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
    const response = await fetch(endpoint, {
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
