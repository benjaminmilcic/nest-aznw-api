import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Math4LisaService } from './math4lisa.service';

@WebSocketGateway({
  namespace: '/math4lisa',
  cors: {
    origin: [
      'https://benjaminmilcic.site',
      'http://benjaminmilcic.site',
      'https://evaluation.benjaminmilcic.site',
      'http://evaluation.benjaminmilcic.site',
    ], // Passe dies an, um nur spezifische Clients zuzulassen
  },
})
export class DifficultySettingsGateway {
  constructor(private math4lisaService: Math4LisaService) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('updateSettings')
  handleUpdateSettings(@MessageBody() newSettings: any) {
    this.math4lisaService.updateDifficultySettings(newSettings);

    // Sende die neuen Werte an alle verbundenen Clients
    this.server.emit('updateSettings', newSettings);
  }

  @SubscribeMessage('getSettings')
  async handleGetSettings(@MessageBody() data: any) {
    // Hier könntest du initiale Einstellungen zurückgeben

    let settings = await this.math4lisaService.getDifficultySettings();
    if (settings) {
      return {
        maxAdditionValue: settings.maxAdditionValue,
        maxSubtractionValue: settings.maxSubtractionValue,
        maxAdditionResult: settings.maxAdditionResult,
        showAddToHomescreenButton: settings.showAddToHomescreenButton,
      };
    } else {
      return {
        maxAdditionValue: 10,
        maxSubtractionValue: 10,
        maxAdditionResult: 12,
        showAddToHomescreenButton: false,
      };
    }
  }
}
