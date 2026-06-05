import { EventEmitter } from "node:events";

export const animationEvents = new EventEmitter();

export interface AnimationUpdatedEvent {
  animationId: string;
}
