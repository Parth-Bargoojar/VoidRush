/**
 * VOIDRUSH — a minimal object pool.
 *
 * The engine allocates nothing per frame after warm-up: obstacles, tunnel
 * segments and audio voices all come from pools so that long runs cannot grow
 * the heap monotonically.
 */

export class Pool<T> {
  private readonly free: T[] = [];
  private readonly factory: () => T;
  private readonly onRelease: ((item: T) => void) | undefined;
  private created = 0;

  constructor(factory: () => T, onRelease?: (item: T) => void, prewarm = 0) {
    this.factory = factory;
    this.onRelease = onRelease;
    for (let i = 0; i < prewarm; i += 1) {
      this.free.push(this.make());
    }
  }

  private make(): T {
    this.created += 1;
    return this.factory();
  }

  acquire(): T {
    const item = this.free.pop();
    return item ?? this.make();
  }

  release(item: T): void {
    this.onRelease?.(item);
    this.free.push(item);
  }

  /** Total instances ever constructed. A stable value proves pooling works. */
  get createdCount(): number {
    return this.created;
  }

  get freeCount(): number {
    return this.free.length;
  }
}
