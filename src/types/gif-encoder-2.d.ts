declare module "gif-encoder-2" {
  import { Readable } from "stream";

  class GifEncoder {
    constructor(width: number, height: number);
    start(): void;
    finish(): void;
    setRepeat(repeat: number): void;
    setDelay(ms: number): void;
    setQuality(quality: number): void;
    addFrame(ctx: CanvasRenderingContext2D): void;
    createReadStream(): Readable;
  }

  export default GifEncoder;
}
