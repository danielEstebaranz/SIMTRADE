import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { AuthService } from './auth';

interface ChatResponse {
  output: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly chatUrl =
    'https://simtrade.app.n8n.cloud/webhook/70182b73-2c1e-49d3-b99c-41aaa164ef52/chat';

  sendMessage(message: string): Observable<string> {
    return this.http
      .post<ChatResponse>(this.chatUrl, {
        chatInput: message,
        sessionId: this.getSessionId(),
      })
      .pipe(
        map((response) => response.output),
        catchError((error: HttpErrorResponse) =>
          throwError(() => this.getErrorMessage(error)),
        ),
      );
  }

  private getSessionId(): string {
    const userId = this.authService.user()?.id;

    if (userId) {
      return `simtrade-user-${userId}`;
    }

    if (!isPlatformBrowser(this.platformId)) {
      return 'simtrade-server-session';
    }

    const storageKey = 'simtrade_chat_session';
    const existingSessionId = localStorage.getItem(storageKey);

    if (existingSessionId) {
      return existingSessionId;
    }

    const sessionId = `simtrade-guest-${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, sessionId);
    return sessionId;
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No se puede conectar con el asistente de SIMTRADE.';
    }

    return 'El asistente no pudo responder ahora mismo. Intentalo de nuevo.';
  }
}
