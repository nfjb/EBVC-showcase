/** A click that is missing something the rules require (for example a comment). */
export class ActionRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionRefused";
  }
}
