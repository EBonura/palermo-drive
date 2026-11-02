// What the Barbera says about the lapa on its pitch (src/stadium.js): the fans' balloons and the match commentary on the radio card (La partita). Written for the game, all of them
// drafts in Palermitan for the owner to correct (docs/palermitan-review.md, "The Barbera crowd and La partita"). Each line is [Palermitan, English]; the English one shows when the
// game is in English. Rude and loud, no slurs. Keep the balloons short: the fans' ones are small.

export const FANS = {
  // the lapa has just come onto the pitch
  enter: [
    ['Ma cu è chistu cû lapa?!', 'Who is this guy with the lapa?!'],
    ['Chi ci fa ’nta mienzu ô campu?!', 'What is he doing in the middle of the pitch?!'],
    ['Minchia, trasiu ô campu cû lapa!', 'Damn, he drove onto the pitch!'],
    ['Chiamati a pulizia!', 'Call the police!'],
    ['Scinni ra ieiba, cuinnutu!', 'Get off the grass, you fool!'],
    ['L’aibitru! Unni è l’aibitru?!', 'The referee! Where is the referee?!'],
    ['Cu fu ca lu fici trasiri?!', 'Who let him in?!'],
    ['Ma chi è, u nuovu puoitieri?!', 'What, is he the new goalkeeper?!'],
  ],
  // the background shouting while he stays
  idle: [
    ['Nesci ra ccà, scimunitu!', 'Get out of here, you fool!'],
    ['Cu ti runau a patenti?!', 'Who gave you your licence?!'],
    ['Pagai u biglietto pi vidiri chistu?!', 'I paid for a ticket to see this?!'],
    ['A matri ro puoitieri lu sapi?!', 'Does the goalkeeper’s mother know?!'],
    ['Puoitieri, to matri ti chiama!', 'Goalkeeper, your mother is calling you!'],
    ['Mi rumpisti a partita!', 'You ruined my match!'],
    ['Cacciatilu ri ccà!', 'Throw him out!'],
    ['Ma chi voli ’stu lapista?!', 'What does this lapa driver want?!'],
    ['Chiamati i carabinieri!', 'Call the carabinieri!'],
    ['Ma chistu è pazzu!', 'This guy is mad!'],
    ['Chistu ni sciupa u pratu!', 'He is wrecking our lawn!'],
    ['E u VAR? Unni è u VAR?!', 'And the VAR? Where is the VAR?!'],
    ['Tu, sì, tu cû lapa! Fora!', 'You, yes you with the lapa! Out!'],
  ],
  fast: [
    ['Araciu, ca ni sciupi u pratu!', 'Slowly, you will ruin the lawn!'],
    ['Cu ti cridi, Schumacher?!', 'Who do you think you are, Schumacher?!'],
    ['Ma unni curri? Un c’è u palluni!', 'Where is he rushing? There is no ball!'],
    ['Cchiù araciu, ca ni ammazzi!', 'Slower, you will kill us!'],
  ],
  hit: [
    ['Cauci ô palluni cû lapa!', 'He kicks the ball with the lapa!'],
    ['Un ci toccari u palluni!', 'Do not touch the ball!'],
    ['Chi è, u nuovu centravanti?!', 'What, is he the new striker?!'],
    ['Runami u palluni, amunì!', 'Give me the ball, come on!'],
    ['U palluni è ro Palermu!', 'The ball belongs to Palermo!'],
  ],
  goal: [
    ['GOOOL! Ma cu è chistu?!', 'GOAL! But who is this guy?!'],
    ['Gol! Gol! Fici gol cû lapa!', 'Goal! Goal! He scored with the lapa!'],
    ['Si ’nu ri, lapista!', 'You are a king, lapa driver!'],
    ['L’aibitru dormi! Fu gol!', 'The referee is asleep! It was a goal!'],
    ['Chi gol, matri mia!', 'What a goal, my goodness!'],
    ['Cuntinua accussì, scimunitu!', 'Keep it up, you fool!'],
    ['Gol ri lapa! Mai vistu!', 'A lapa goal! Never seen before!'],
  ],
  miss: [
    ['Fora! Pi ’nu pilu!', 'Wide! By a hair!'],
    ['Era sulu ri spinciri ’nta puoita!', 'He only had to push it in!'],
    ['Sbagghiasti puoita, cuinnutu!', 'Wrong goal, you fool!'],
    ['Ma unni tira?!', 'Where is he shooting?!'],
  ],
  near: [
    ['U palu! Ancora u palu!', 'The post! The post again!'],
    ['Ohhh! Cuasi cuasi!', 'Ohhh! So close!'],
    ['Mancu ’nu metru!', 'Not even a metre!'],
  ],
  donut: [
    ['Ma chi fa, gira ’ntunnu?!', 'What is he doing, spinning around?!'],
    ['Gira cumu ’na trottula!', 'He spins like a top!'],
    ['Chiamati i iardinieri!', 'Call the groundsmen!'],
    ['Ni stai rumpennu tuttu u pratu!', 'You are tearing up the whole lawn!'],
  ],
  park: [
    ['Si fermau! Chi voli, u paicheggiu?!', 'He stopped! Does he want a parking spot?!'],
    ['S’assittau ’nta mienzu ô campu!', 'He sat down in the middle of the pitch!'],
    ['Chi fa, u pic-nic?!', 'What, a picnic?!'],
    ['Spingitilu fora, ’stu lapista!', 'Push him out, this lapa driver!'],
  ],
};

// the radio card's commentary line (the title line is the score)
export const COMMENT = {
  start: [['Fischiu ri iniziu! Cu è chiddu cû lapa?', 'Kick-off! Who is that with the lapa?']],
  idle: [
    ['Sulu ’na lapa ’nta mienzu ô campu.', 'Only a lapa in the middle of the pitch.'],
    ['A lapa avanza supra a fascia.', 'The lapa advances down the wing.'],
    ['L’aibitru cerca u regolamentu.', 'The referee looks for the rulebook.'],
    ['Palermu ’n attaccu... no, è sulu ’na lapa.', 'Palermo attacking... no, it is just a lapa.'],
    ['U pubblicu un si dà paci.', 'The crowd will not settle down.'],
  ],
  fast: [['A lapa curri forti, ma senza palluni!', 'The lapa runs fast, but without the ball!']],
  near: [['A lapa s’avvicina ô palluni...', 'The lapa closes in on the ball...']],
  hit: [['Tocca u palluni! Chi cuntrollu!', 'He touches the ball! What control!'], ['Cauci ô palluni! Cu la capìu?', 'A kick at the ball! Who saw that coming?']],
  tense: [['Attenzioni! Tira ’nta puoita...', 'Careful! Shot at goal...'], ['U palluni è vicinu ê rete...', 'The ball is close to the net...']],
  goalHome: [['GOL ro Palermu! O forsi ri chiddu cû lapa?', 'Palermo goal! Or the one with the lapa?']],
  goalAway: [['GOL! E stavota ’ntô latu sbagghiatu!', 'GOAL! And this time at the wrong end!']],
  miss: [['Fora! Pi ’nu pilu!', 'Wide! By a hair!']],
  post: [['U palu! U palu!', 'The post! The post!']],
  bar: [['Supra â traivessa!', 'Over the bar!']],
  donut: [['Gira cumu ’na trottula! L’aibitru è ciuttu.', 'He spins like a top! The referee is dizzy.']],
  park: [['Si fermau. L’aibitru mostra u cartellinu giallu.', 'He stopped. The referee shows a yellow card.']],
};

export const SCORE = ['PALERMU', 'OSPITI', 'PALERMO', 'GUESTS'];   // home, away (Palermitan), home, away (English)
