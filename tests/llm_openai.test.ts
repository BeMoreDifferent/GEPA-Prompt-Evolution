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


