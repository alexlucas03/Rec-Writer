interface GenerationRequest {
  prompt: string;
  model: string;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

interface GenerationResponse {
  text: string;
  model: string;
  created: number;
}

class QueryService {
  private baseUrl: string;
  
  constructor(baseUrl = 'http://127.0.0.1:5002') {
    this.baseUrl = baseUrl;
  }
  
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing connection to Flask server...');
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        mode: 'cors'
      });
      
      console.log('Flask health check status:', response.status);
      return response.ok;
    } catch (error) {
      console.error('Failed to connect to server:', error);
      return false;
    }
  }
  
  async generateText(request: GenerationRequest): Promise<GenerationResponse> {
    try {
      console.log("Sending request to Flask API:", request);
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          temperature: request.options?.temperature || 0.7,
          max_tokens: request.options?.max_tokens || 1000,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error: ${response.status}`, errorText);
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        text: data.response,
        model: request.model,
        created: Date.now(),
      };
    } catch (error) {
      console.error('Text generation failed:', error);
      throw error;
    }
  }
  
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json();
      return data.models.map((model: any) => model.name);
    } catch (error) {
      console.error('Failed to get models:', error);
      return ['gemma3'];
    }
  }
}

export const queryService = new QueryService();