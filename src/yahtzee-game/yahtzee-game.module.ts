import { Module, OnModuleInit } from '@nestjs/common';
import { YahtzeeGameService } from './yahtzee-game.service';
import { YahtzeeGameGateway } from './yahtzee-game.gateway';

@Module({
  imports: [],
  controllers: [],
  providers: [YahtzeeGameService, YahtzeeGameGateway],
})
export class YahtzeeGameModule implements OnModuleInit {
  constructor(
    private readonly yahtzeeGameService: YahtzeeGameService,
    private readonly yahtzeeGameGateway: YahtzeeGameGateway,
  ) {}

  onModuleInit() {
    // Manually pass gateways to WebSocketService
    this.yahtzeeGameService.setGateway(this.yahtzeeGameGateway);
  }
}
