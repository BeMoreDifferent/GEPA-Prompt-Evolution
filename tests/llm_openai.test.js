import { makeOpenAIClients } from '../src/llm_openai.js';
describe('makeOpenAIClients', () => {
    test('throws without api key', () => {
        expect(() => makeOpenAIClients({ actorModel: 'm', judgeModel: 'm' })).toThrow('OPENAI_API_KEY');
    });
});
