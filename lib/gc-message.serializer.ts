import { ReadPacket, Serializer } from '@nestjs/microservices';
import { GCPubSubMessage, GCPubSubMessageBuilder } from './gc-message.builder';

export class GCPubSubMessageSerializer
  implements Serializer<ReadPacket, GCPubSubMessage>
{
  constructor() {}

  serialize(packet: ReadPacket<any> | any): GCPubSubMessage<any, any> {
    const message =
      packet.data && packet.data instanceof GCPubSubMessage
        ? (packet.data as GCPubSubMessage)
        : new GCPubSubMessageBuilder(packet.data).build();
    return { ...message };
  }
}
