// consensus/AFBAEngine.ts
import { Validator } from './Validator';
import { Proposal } from './Proposal';
import { Vote } from './Vote';
import { Quorum } from './Quorum';

export class AFBAEngine {
  private validators: Validator[];
  private quorum: Quorum;
  private currentProposal: Proposal | null = null;
  private votes: Map<string, Vote[]> = new Map(); // proposalId -> votes

  constructor(validators: Validator[]) {
    this.validators = validators;
    this.quorum = new Quorum(validators);
  }

  propose(proposal: Proposal) {
    this.currentProposal = proposal;
    this.votes.set(proposal.id, []);
    this.broadcastVote(proposal.id, true); // vote yes on our proposal
  }

  receiveVote(vote: Vote) {
    if (!this.votes.has(vote.proposalId)) {
      this.votes.set(vote.proposalId, []);
    }

    const votes = this.votes.get(vote.proposalId)!;
    if (!votes.find(v => v.from === vote.from)) {
      votes.push(vote);
    }

    if (this.quorum.hasQuorumFor(vote.proposalId, votes)) {
      this.finalize(vote.proposalId);
    }
  }

  finalize(proposalId: string) {
    console.log(`✅ Proposal ${proposalId} finalized`);
    // TODO: Apply block, notify system
  }

  broadcastVote(proposalId: string, approve: boolean) {
    const vote = new Vote(proposalId, this.validators[0].id, approve); // assuming first validator is self
    // TODO: Send vote over network
    console.log(`🗳️ Broadcasting vote for proposal ${proposalId}`);
    this.receiveVote(vote); // for self
  }
}
