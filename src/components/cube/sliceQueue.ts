/**
 * Очередь поворотов среза: по одному за раз, и ни одно обещание не остаётся
 * висеть.
 *
 * Вынесено из `RubiksCube.tsx` (#139). Там очередь жила в трёх ref'ах, и при
 * размонтировании закрывались только ждущие повороты, а обещание текущего
 * разрешалось одним концом анимации — которого после отмены кадра уже не
 * будет. Вызывающая сторона (`await rotateSlice(...)`) ждала вечно, а её
 * замыкание жило до перезагрузки страницы. Здесь закрытие очереди разрешает
 * и текущий поворот, и ждущие, и все последующие. Куб без WebGL в тестах не
 * поднять, а очередь — можно.
 */

/**
 * Начать поворот. `finish` зовётся по его окончании — или сразу, если
 * поворачивать нечего. Двойной вызов безвреден.
 */
export type SliceTurnStart = (finish: () => void) => void;

export class SliceQueue {
  /** Разрешить обещание текущего поворота. Есть, пока поворот идёт. */
  private settleActive: (() => void) | null = null;
  private readonly waiting: Array<() => void> = [];
  private closed = false;

  /** Идёт поворот: жесты в это время новый не начинают. */
  get busy(): boolean {
    return this.settleActive !== null;
  }

  /**
   * Поставить поворот в очередь. Обещание разрешается, когда поворот доигран
   * или очередь закрыта, — что раньше. В закрытой очереди поворот не начинается.
   */
  run(start: SliceTurnStart): Promise<void> {
    return new Promise((resolve) => {
      const begin = () => {
        if (this.closed) {
          resolve();
          return;
        }
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          if (this.settleActive === settle) this.settleActive = null;
          resolve();
        };
        this.settleActive = settle;
        start(() => {
          if (settled) return;
          settle();
          this.next();
        });
      };

      if (this.closed) resolve();
      else if (this.busy) this.waiting.push(begin);
      else begin();
    });
  }

  /** Снять куб: текущий и ждущие повороты разрешаются, новые — сразу. */
  close(): void {
    this.closed = true;
    const active = this.settleActive;
    this.settleActive = null;
    active?.();
    const waiting = this.waiting.splice(0);
    waiting.forEach((begin) => begin());
  }

  /** Куб снова на месте — повторное монтирование в StrictMode. */
  open(): void {
    this.closed = false;
  }

  private next(): void {
    this.waiting.shift()?.();
  }
}
