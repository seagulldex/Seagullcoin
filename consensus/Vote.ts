// consensus/Vote.ts
export class Vote {
  proposalId: string;
  from: string;
  approve: boolean;

  constructor(proposalId: string, from: string, approve: boolean) {
    this.proposalId = proposalId;
    this.from = from;
    this.approve = approve;
  }
}
