export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface AIProvider {
  readonly name: string;
  complete(messages: ChatMessage[], options?: AICompleteOptions): Promise<string>;
  healthcheck(): Promise<boolean>;
}

export interface AICompleteOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json_object" | "text";
}

export interface AIProviderRegistry {
  getProvider(name: string): AIProvider | undefined;
  list(): AIProvider[];
}
