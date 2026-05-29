import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatService } from '../../../../services/chat';

interface FaqItem {
  answer: string;
  question: string;
}

interface ChatMessage {
  author: 'assistant' | 'user';
  text: string;
}

@Component({
  selector: 'app-ayuda-section',
  templateUrl: './ayuda-section.html',
  styleUrl: './ayuda-section.css',
  host: {
    id: 'ayuda',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AyudaSection {
  private readonly chatService = inject(ChatService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');

  protected readonly faqItems: FaqItem[] = [
    {
      question: 'Como compro un activo?',
      answer:
        'Entra en Mercado, selecciona el activo que te interese, introduce la cantidad y confirma la compra. El importe se descuenta de tu saldo disponible.',
    },
    {
      question: 'Como vendo parte de mi cartera?',
      answer:
        'Desde Cartera puedes elegir una posicion abierta y vender un porcentaje de tus participaciones. La operacion quedara registrada en tu historial.',
    },
    {
      question: 'Como anado fondos?',
      answer:
        'Ve a Configuracion, abre la seccion Fondos y usa la opcion Añadir fondos. Puedes introducir una cantidad manualmente o elegir una cantidad rapida.',
    },
    {
      question: 'Que ocurre si reinicio mi cartera?',
      answer:
        'La cartera vuelve a 1000 $, se eliminan los activos actuales y se conserva tu cuenta de usuario.',
    },
    {
      question: 'Donde consulto mis operaciones anteriores?',
      answer:
        'En Historial encontraras compras, ventas e ingresos realizados dentro de la plataforma.',
    },
    {
      question: 'Como cambio entre modo claro y oscuro?',
      answer:
        'En Configuracion, dentro de Apariencia, puedes elegir el tema visual que prefieras.',
    },
  ];

  protected readonly openQuestion = signal<string | null>(this.faqItems[0].question);
  protected readonly chatOpen = signal(false);
  protected readonly draftMessage = signal('');
  protected readonly chatStatus = signal<'idle' | 'sending' | 'error'>('idle');
  protected readonly chatErrorMessage = signal('');
  protected readonly messages = signal<ChatMessage[]>([
    {
      author: 'assistant',
      text: 'Hola, soy SIMTRADE. Puedo ayudarte con dudas sobre el uso de la plataforma.',
    },
  ]);
  protected readonly canSendMessage = computed(
    () => this.draftMessage().trim().length > 0 && this.chatStatus() !== 'sending',
  );

  protected toggleQuestion(question: string): void {
    this.openQuestion.update((currentQuestion) =>
      currentQuestion === question ? null : question,
    );
  }

  protected openChat(): void {
    this.chatOpen.set(true);
  }

  protected closeChat(): void {
    this.chatOpen.set(false);
    this.draftMessage.set('');
    this.chatErrorMessage.set('');
    this.chatStatus.set('idle');
  }

  protected updateDraftMessage(event: Event): void {
    const input = event.target as HTMLTextAreaElement | null;
    this.draftMessage.set(input?.value ?? '');
  }

  protected sendMessage(): void {
    const text = this.draftMessage().trim();

    if (!text || this.chatStatus() === 'sending') {
      return;
    }

    this.messages.update((messages) => [...messages, { author: 'user', text }]);
    this.draftMessage.set('');
    this.chatErrorMessage.set('');
    this.chatStatus.set('sending');
    this.changeDetectorRef.markForCheck();
    this.scrollMessagesToBottom();

    this.chatService
      .sendMessage(text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.ngZone.run(() => {
            this.messages.update((messages) => [
              ...messages,
              { author: 'assistant', text: response },
            ]);
            this.chatStatus.set('idle');
            this.changeDetectorRef.detectChanges();
            this.scrollMessagesToBottom();
          });
        },
        error: (message: string | HttpErrorResponse) => {
          this.ngZone.run(() => {
            this.chatStatus.set('error');
            this.chatErrorMessage.set(
              typeof message === 'string'
                ? message
                : 'El asistente no pudo responder ahora mismo. Intentalo de nuevo.',
            );
            this.changeDetectorRef.detectChanges();
            this.scrollMessagesToBottom();
          });
        },
      });
  }

  private scrollMessagesToBottom(): void {
    setTimeout(() => {
      const container = this.messagesContainer()?.nativeElement;

      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
}
