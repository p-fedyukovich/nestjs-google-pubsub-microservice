import { ReadPacket, Serializer } from '@nestjs/microservices';
import { GCPubSubMessage, GCPubSubMessageBuilder } from './gc-message.builder';

export class GCPubSubMessageSerializer
  implements Serializer<ReadPacket, GCPubSubMessage>
{
  constructor() {}

  serialize(packet: ReadPacket<any> | any): GCPubSubMessage<any, any> {
    let message: GCPubSubMessage;

    if (packet.data instanceof GCPubSubMessage) {
      message = packet.data as GCPubSubMessage;
    } else {
      message = new GCPubSubMessageBuilder(packet.data).build();
    }

    return message;
  }
}
