import { Controller, Get } from '@nestjs/common';
import { GCPubSubClientTimeoutInterceptor } from './gc-pubsub.timeout.decorator';

@Controller()
export class GCPubSubTimeoutController {
  @GCPubSubClientTimeoutInterceptor(400)
  @Get()
  async sucess() {
    await this.wait(300);
    return true;
  }

  @GCPubSubClientTimeoutInterceptor(800)
  @Get('/fail')
  async fail() {
    await this.wait(5000);
    return true;
  }

  private wait(time: number) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, time);
    });
  }
}
