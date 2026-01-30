/**
 * Unit Tests for Claude SDK Client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeSDKClient } from '../sdk-client';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk');

describe('ClaudeSDKClient', () => {
  let client: ClaudeSDKClient;
  let mockAnthropicClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock Anthropic client
    mockAnthropicClient = {
      messages: {
        create: vi.fn(),
      },
    };

    // Mock Anthropic constructor
    (Anthropic as any).mockImplementation(() => mockAnthropicClient);

    // Create client instance
    client = new ClaudeSDKClient({
      apiKey: 'test-api-key',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
      temperature: 0.7,
    });
  });

  describe('createMessage', () => {
    it('should create a message and track usage', async () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!', citations: null }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const result = await client.createMessage({
        messages: [{ role: 'user', content: 'Hello' }],
        useCase: 'test',
      });

      expect(result).toEqual(mockResponse);
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        temperature: 0.7,
        stream: false,
        messages: [{ role: 'user', content: 'Hello' }],
        system: undefined,
        tools: undefined,
        tool_choice: undefined,
        metadata: undefined,
        stop_sequences: undefined,
        top_k: undefined,
        top_p: undefined,
      });

      // Check usage was tracked
      const stats = client.getUsageStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalTokens).toBe(150);
    });

    it('should track cache usage correctly', async () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!', citations: null }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 1000,
          cache_read_input_tokens: 500,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      await client.createMessage({
        messages: [{ role: 'user', content: 'Hello' }],
        useCase: 'test-cache',
      });

      const stats = client.getUsageStats();
      expect(stats.cacheEfficiency).toBeGreaterThan(0);
    });
  });

  describe('getUsageStats', () => {
    it('should return correct aggregated stats', async () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!', citations: null }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      // Make multiple requests
      await client.createMessage({
        messages: [{ role: 'user', content: 'Test 1' }],
        useCase: 'test-1',
      });

      await client.createMessage({
        messages: [{ role: 'user', content: 'Test 2' }],
        useCase: 'test-2',
      });

      const stats = client.getUsageStats();

      expect(stats.totalRequests).toBe(2);
      expect(stats.totalTokens).toBe(300); // 150 * 2
      expect(stats.byUseCase['test-1']).toBeDefined();
      expect(stats.byUseCase['test-2']).toBeDefined();
    });

    it('should filter stats by date', async () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!', citations: null }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      await client.createMessage({
        messages: [{ role: 'user', content: 'Test' }],
        useCase: 'test',
      });

      // Get stats from future date (should return 0)
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const stats = client.getUsageStats(futureDate);

      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
    });
  });

  describe('extractTextFromResponse', () => {
    it('should extract text from response', () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello ', citations: null },
          { type: 'text', text: 'World!', citations: null },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      };

      const text = client.extractTextFromResponse(mockResponse);
      expect(text).toBe('Hello World!');
    });
  });

  describe('complete', () => {
    it('should provide simple completion helper', async () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Completion result', citations: null }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const result = await client.complete('Test prompt', {
        useCase: 'completion-test',
      });

      expect(result).toBe('Completion result');
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Test prompt' }],
        })
      );
    });
  });

  describe('resetUsageMetrics', () => {
    it('should clear all usage metrics', async () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!', citations: null }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      await client.createMessage({
        messages: [{ role: 'user', content: 'Test' }],
        useCase: 'test',
      });

      expect(client.getUsageStats().totalRequests).toBe(1);

      client.resetUsageMetrics();

      expect(client.getUsageStats().totalRequests).toBe(0);
      expect(client.getUsageStats().totalTokens).toBe(0);
    });
  });
});
