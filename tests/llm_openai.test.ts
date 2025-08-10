import { jest } from '@jest/globals';
import { makeOpenAIClients } from '../src/llm_openai.js';

describe('makeOpenAIClients', () => {
  test('throws without api key', () => {
    expect(() => makeOpenAIClients({ actorModel: 'm', judgeModel: 'm' })).toThrow('OPENAI_API_KEY');
  });

  test('accepts explicit api key in config', () => {
    // Provide a fake key; we are not making a network call in this test
    expect(() => makeOpenAIClients({ apiKey: 'sk-test', actorModel: 'm', judgeModel: 'm' })).not.toThrow();
  });
});

describe('retry logic', () => {
    it('should retry on failure with exponential backoff', async () => {
        // Set up fetch mock
        const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
        (global as any).fetch = mockFetch;
        
        // First 2 calls fail, third succeeds
        mockFetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Rate limit'))
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ output_text: 'success' })
            } as Response);

        const clients = makeOpenAIClients({
            apiKey: 'sk-test',
            actorModel: 'gpt-4',
            judgeModel: 'gpt-4',
            maxRetries: 5,
            initialRetryDelayMs: 100
        });

        const result = await clients.actorLLM.complete('test prompt');

        expect(result).toBe('success');
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after maximum retries exceeded', async () => {
        // Set up fetch mock
        const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
        (global as any).fetch = mockFetch;
        
        // All calls fail
        mockFetch.mockRejectedValue(new Error('Persistent error'));

        const clients = makeOpenAIClients({
            apiKey: 'sk-test',
            actorModel: 'gpt-4',
            judgeModel: 'gpt-4',
            maxRetries: 2,
            initialRetryDelayMs: 10
        });

        await expect(clients.actorLLM.complete('test prompt')).rejects.toThrow('Persistent error');
        expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use default retry configuration', async () => {
        // Set up fetch mock
        const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
        (global as any).fetch = mockFetch;
        
        // First call fails, second succeeds
        mockFetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ output_text: 'success' })
            } as Response);

        const clients = makeOpenAIClients({
            apiKey: 'sk-test',
            actorModel: 'gpt-4',
            judgeModel: 'gpt-4'
            // Using defaults: maxRetries: 5, initialRetryDelayMs: 1000
        });

        const result = await clients.actorLLM.complete('test prompt');

        expect(result).toBe('success');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle HTTP error responses with retries', async () => {
        // Set up fetch mock
        const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
        (global as any).fetch = mockFetch;
        
        // First call returns 429 (rate limit), second succeeds
        mockFetch
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: () => Promise.resolve({ error: 'Rate limit exceeded' })
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ output_text: 'success after retry' })
            } as Response);

        const clients = makeOpenAIClients({
            apiKey: 'sk-test',
            actorModel: 'gpt-4',
            judgeModel: 'gpt-4',
            maxRetries: 3,
            initialRetryDelayMs: 50
        });

        const result = await clients.actorLLM.complete('test prompt');

        expect(result).toBe('success after retry');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout errors with retries', async () => {
        // Set up fetch mock
        const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
        (global as any).fetch = mockFetch;
        
        // First call times out, second succeeds
        mockFetch
            .mockRejectedValueOnce(new Error('HTTP timeout after 60000ms for /responses'))
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ output_text: 'success after timeout' })
            } as Response);

        const clients = makeOpenAIClients({
            apiKey: 'sk-test',
            actorModel: 'gpt-4',
            judgeModel: 'gpt-4',
            maxRetries: 2,
            initialRetryDelayMs: 25
        });

        const result = await clients.actorLLM.complete('test prompt');

        expect(result).toBe('success after timeout');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should calculate exponential backoff delays correctly', async () => {
        // Set up fetch mock
        const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
        (global as any).fetch = mockFetch;
        
        const startTime = Date.now();
        
        // All calls fail to test timing
        mockFetch.mockRejectedValue(new Error('Persistent error'));

        const clients = makeOpenAIClients({
            apiKey: 'sk-test',
            actorModel: 'gpt-4',
            judgeModel: 'gpt-4',
            maxRetries: 3,
            initialRetryDelayMs: 100
        });

        await expect(clients.actorLLM.complete('test prompt')).rejects.toThrow('Persistent error');
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        // Expected delays: 100ms + 200ms + 400ms = 700ms minimum
        // Add some buffer for execution time
        expect(totalTime).toBeGreaterThanOrEqual(600);
        expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should work with chat completions retry logic', async () => {
        // Set up fetch mock
        const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
        (global as any).fetch = mockFetch;
        
        // First call fails, second succeeds
        mockFetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ 
                    choices: [{ message: { content: 'chat success' } }] 
                })
            } as Response);

        const clients = makeOpenAIClients({
            apiKey: 'sk-test',
            actorModel: 'gpt-4',
            judgeModel: 'gpt-4',
            maxRetries: 2,
            initialRetryDelayMs: 50
        });

        const result = await clients.chatLLM.chat([
            { role: 'user', content: 'test message' }
        ]);

        expect(result).toBe('chat success');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});


