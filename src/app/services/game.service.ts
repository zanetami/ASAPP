import { Injectable } from '@angular/core';
import { WebSocketMessage, Payload, PayloadMessage } from '../model/WebSocketMessenger';
import { GameStatus } from '../model/enums/GameStatus';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private WEBSOCKET_RECONNECT_TIMEOUT = 2000;
  private WEBSOCKET_STATUS_CHECK_INTERVAL = 5000;
  private WEBSOCKET_URL = 'ws://ec2-3-86-59-171.compute-1.amazonaws.com/';

  private _connectedPlayers: string[];
  private _readyPlayers: string[];

  private _socket: WebSocket;

  socketConnectionStatus = new Subject<number>();
  gameStatus = new BehaviorSubject<GameStatus>(GameStatus.CONNECTING_TO_SERVER);
  playerId = new BehaviorSubject<string>(null);
  isPlayerIdValid = new BehaviorSubject<boolean>(false);
  isPlayerReady = new BehaviorSubject<boolean>(false);

  constructor() {
    this.openWebSocketConnection()
  }

  //#region Initializers functions

  private openWebSocketConnection = () => {
    this._socket = new WebSocket(this.WEBSOCKET_URL);
    this.initializeWebSocketEvents();
  }

  private initializeWebSocketEvents = () => {
    this._socket.onopen = this.handleWebSocketOpen
    this._socket.onclose = this.handleWebSocketClose
    this._socket.onmessage = this.handleSocketMessage;
  }
  //#endregion

  //#region WebSocket handlers
  private handleWebSocketOpen = event => {
    this.gameStatus.next(GameStatus.CONNECTING_TO_SERVER);
    this.gameStatus.next(GameStatus.WAITING_FOR_OTHER_PLAYERS);
    this.socketConnectionStatus.next(this._socket.OPEN);

    if (!this.isUserIdSet())
      this.requestUserId();
    else
      this.checkUserId();
  };

  private handleSocketMessage = (event) => {
    const message: WebSocketMessage = JSON.parse(event.data);
    let messageType = message.type;
    console.log(`=== message type: ${messageType}`);

    if (messageType === 'auth_welcome-success') this.handleWelcomeSuccess(message.payload);
    else if (messageType === 'auth_welcome-error') this.handleWelcomeError(message.payload);
    else if (messageType === 'player_ready-success') this.handlePlayerReadySuccess(message.payload);
    else if (messageType === 'player_ready-error') this.handlePlayerReadyError(message.payload);
  }

  private handleWelcomeSuccess(payload: Payload) {
    console.log('Welcome success');
    const id = payload.id;

    if (id != null) {
      this.playerId.next(id);
      this.isPlayerIdValid.next(true);
    } else {
      this.playerId.next(null);
      this.isPlayerIdValid.next(false);
    }
    console.log(`Player id: ${this.playerId.getValue()}`);
  }

  private handleWelcomeError(payload: Payload) {
    console.log(`Welcome error: ${payload.error}`);
    if (payload.error == PayloadMessage.NO_MORE_SPACE_FOR_NEW_PLAYERS) {
      this.gameStatus.next(GameStatus.SOME_GAME_IS_TAKING_PLACE)
    }

    this.playerId.next(null);
    this.isPlayerIdValid.next(false);
  }

  private handlePlayerReadySuccess(payload: Payload) {
    const readyState = payload.ready;

    if (readyState != null)
      this.isPlayerReady.next(readyState);
  }

  private handlePlayerReadyError(payload: Payload) {
    console.log(payload);
  }

  private handleWebSocketClose = (event) => {
    this.gameStatus.next(GameStatus.DISCONNECTED_FROM_SERVER);
    this.gameStatus.next(GameStatus.RECONNECTING_TO_SERVER);
    this.socketConnectionStatus.next(this._socket.CLOSED);
    setTimeout(this.openWebSocketConnection, this.WEBSOCKET_RECONNECT_TIMEOUT);
  }
  //#endregion

  //#region Boolean functions
  private isSocketOpened(): boolean {
    return this._socket.readyState == this._socket.OPEN;
  }

  private isUserIdSet(): boolean {
    return this.playerId.getValue() != null;
  }
  //#endregion

  //#region Actuators functions
  reportPlayerReadyState(value: boolean) {
    if (this.isSocketOpened()) {
      this._socket.send(
        JSON.stringify({
          type: 'player_ready',
          payload: {
            id: this.playerId.getValue(),
            ready: value
          }
        })
      )
    } else {
      // TODO: Throw exception
    }
  }

  private requestUserId() {
    if (this.isSocketOpened()) {
      this._socket.send(
        JSON.stringify({
          type: 'auth_welcome',
          payload: {}
        })
      )
    } else {
      // TODO: Throw exception
    }
  }

  private checkUserId() {
    if (this.isSocketOpened()) {
      this._socket.send(
        JSON.stringify({
          type: 'auth_check',
          payload: {
            id: this.playerId.getValue()
          }
        })
      );
    } else {
      // TODO: Throw exception
    }
  }
  //#endregion
}