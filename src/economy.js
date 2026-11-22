// The money numbers in one place, so they can be tuned without searching (the owner's rework of 22 Nov, from the play log of the 48 hours before).
//   PAY_X          every mission payout (fares and their tips, food, the rave, the dump, the horns, the pubs, race prizes) is its old value times this
//   HIT            euro for a person knocked over and for a car sent flying; HIT_GAP seconds is the least time between two hit rewards (caps farming)
//   FINE_PER_LEVEL the police fine when busted, euro per level 1..5 (never more than the wallet holds)
//   GANG_LOSS      what a gang block takes, by the area's level 1..5: [share of the wallet, least euro, most euro] (src/danger.js)
export const PAY_X = 3;
export const HIT = { knock: 0.25, yeet: 0.5 }, HIT_GAP = 3;
export const FINE_PER_LEVEL = 5;
export const GANG_LOSS = [[0, 0, 0], [0.04, 2, 8], [0.08, 3, 15], [0.12, 5, 30], [0.2, 8, 60]];
