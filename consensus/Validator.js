// consensus/Validator.ts
export class Validator {
  id: string;
  weight: number;
  quorumSet: string[];

  constructor(id: string, weight: number = 1, quorumSet: string[] = []) {
    this.id = id;
    this.weight = weight;
    this.quorumSet = quorumSet;
  }
}
