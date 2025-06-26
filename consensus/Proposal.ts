// consensus/Proposal.ts
export class Proposal {
  id: string;
  data: any;

  constructor(id: string, data: any) {
    this.id = id;
    this.data = data;
  }

  isValid(): boolean {
    return !!this.data;
  }
}
