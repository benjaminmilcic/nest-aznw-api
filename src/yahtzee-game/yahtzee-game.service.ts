import { Injectable } from '@nestjs/common';
import { YahtzeeGameGateway } from './yahtzee-game.gateway';

@Injectable()
export class YahtzeeGameService {
  private yahtzeeGameGateway: YahtzeeGameGateway;

  players: { name: string; clientId: string; isStarted: boolean }[] = [];
  noMorePlayers = false;

  setGateway(yahtzeeGameGateway: YahtzeeGameGateway) {
    this.yahtzeeGameGateway = yahtzeeGameGateway;
  }

  addPlayer(name: string, clientId: string): boolean {
    let foundClient = this.players.find(
      (player) => player.clientId === clientId,
    );
    if (!foundClient) {
      let foundName = this.players.find((player) => player.name === name);
      if (!foundName) {
        this.players.push({ name, clientId, isStarted: false });
        this.yahtzeeGameGateway.server.emit(
          'updatePlayers',
          this.players.map((item) => item.name),
        );
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  removePlayer(clienId: string) {
    this.players = this.players.filter((player) => player.clientId !== clienId);
    if (this.players.length === 0) {
      this.yahtzeeGameGateway.server.emit('noMorePlayers', false);
      this.noMorePlayers = false;
    }
    this.yahtzeeGameGateway.server.emit(
      'updatePlayers',
      this.players.map((item) => item.name),
    );
  }

  clientStarted(clienId: string): boolean {
    let found = this.players.find((player) => player.clientId === clienId);
    if (found) {
      found.isStarted = true;
      this.yahtzeeGameGateway.server.emit('noMorePlayers', true);
      this.noMorePlayers = true;
      if (
        this.players
          .map((player) => player.isStarted)
          .every((item) => item === true)
      ) {
        this.yahtzeeGameGateway.server.emit('gameStarted');
      }
      return true;
    } else {
      return false;
    }
  }
}
