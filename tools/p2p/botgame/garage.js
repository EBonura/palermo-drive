// Stand-in for src/garage.js: seven vehicles in the order the INFO message indexes them (only the count and the ids matter to the netcode), no wallet.
export const VEHICLES = ['calessino', 'ape', 'vespa', 'hatch', 'moto', 'scooter', 'bici'].map(id => ({ id }));
export const LIVERIES = Object.fromEntries(VEHICLES.map(v => [v.id, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]]));
export const garage = { cash: 0, debit: () => 0 };
