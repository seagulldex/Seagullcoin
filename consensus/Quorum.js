// consensus/Quorum.ts
import { Validator } from './Validator';
import { Vote } from './Vote';

export class Quorum {
  private validators: Validator[];

  constructor(validators: Validator[]) {
    this.validators = validators;
  }

  hasQuorumFor(proposalId: string, votes: Vote[]): boolean {
    const totalWeight = this.validators.reduce((sum, v) => sum + v.weight, 0);
    const approveWeight = votes
      .filter(v => v.approve)
      .map(v => this.getValidatorWeight(v.from))
      .reduce((a, b) => a + b, 0);

    return approveWeight >= totalWeight * 0.67; // 2/3 threshold
  }

  private getValidatorWeight(id: string): number {
    const v = this.validators.find(v => v.id === id);
    return v ? v.weight : 0;
  }
}
