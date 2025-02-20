import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { YahtzeeGameService } from './yahtzee-game.service';
import { CurrentDice } from './yahtzee-game.types';
import 'source-map-support/register';

@WebSocketGateway({
  namespace: '/yahtzee-game',
  cors: { origin: '*' },
})
export class YahtzeeGameGateway implements OnGatewayDisconnect {
  constructor(private yahtzeeGameService: YahtzeeGameService) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('addPlayer')
  handleAddPlayer(
    @ConnectedSocket() client: Socket,
    @MessageBody() name: string,
  ): boolean {
    return this.yahtzeeGameService.addPlayer(name, client.id);
  }

  handleDisconnect(client: Socket) {
    this.yahtzeeGameService.removePlayer(client.id);
  }

  @SubscribeMessage('clientStarted')
  handleClientStarted(@ConnectedSocket() client: Socket): boolean {
    return this.yahtzeeGameService.clientStarted(client.id);
  }

  @SubscribeMessage('getPlayers')
  handleGetPlayers(@MessageBody() data: any) {
    return this.yahtzeeGameService.players.map((item) => item.name);
  }

  @SubscribeMessage('currentDice')
  handleCurrentDice(@MessageBody() currentDice: CurrentDice) {
    this.server.emit('currentDice', currentDice);
  }

  @SubscribeMessage('setRemoteRowToPutIn')
  handleRemoteRowToPutIn(@MessageBody() rowToPutIn: number) {
    this.server.emit('setRemoteRowToPutIn', rowToPutIn);
    return true;
  }

  @SubscribeMessage('checkedDices')
  handleCheckedDices(@MessageBody() checkedDices: boolean[]) {
    this.server.emit('checkedDices', checkedDices);
  }

  @SubscribeMessage('noMorePlayers')
  handleNoMorePlayers(@MessageBody() data: any) {
    return this.yahtzeeGameService.noMorePlayers;
  }

  @SubscribeMessage('gameStopped')
  handleGamesStoped(@MessageBody() data: { index: number, name: string }) {
    this.server.emit('gameStopped', data);
  }
}
