import { Message } from '@google-cloud/pubsub';
import { GCPubSubParser } from './gc-pubsub.parser';

describe(GCPubSubParser, () => {
  const parser = new GCPubSubParser();

  describe('parse', () => {
    it('should parse the payload to ', async () => {
      const json = { test: 'test' };
      const payload = {
        data: Buffer.from(JSON.stringify(json)),
      } as Message;
      expect(await parser.parse(payload)).toMatchObject(json);
    });
  });
});
