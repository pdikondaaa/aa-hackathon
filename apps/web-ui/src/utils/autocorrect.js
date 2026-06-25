// Common English misspelling → correction map (case-insensitive lookup)
const DICT = {
  // a
  abotu: 'about', absense: 'absence', accidently: 'accidentally',
  accomodate: 'accommodate', achievment: 'achievement', adress: 'address',
  agian: 'again', alot: 'a lot', alright: 'all right', adn: 'and',
  apparantly: 'apparently', arguement: 'argument', attachement: 'attachment',
  availble: 'available', awsome: 'awesome',
  // b
  beleive: 'believe', beacuse: 'because', becuase: 'because', becaus: 'because',
  befor: 'before', begining: 'beginning', benifit: 'benefit', boarder: 'border',
  busines: 'business', buisness: 'business',
  // c
  calender: 'calendar', cna: 'can', cancle: 'cancel', catagory: 'category',
  collegue: 'colleague', comming: 'coming', comittee: 'committee',
  completly: 'completely', concious: 'conscious', convience: 'convenience',
  couldnt: "couldn't", coudl: 'could', currenly: 'currently',
  // d
  definately: 'definitely', definatly: 'definitely', diffrent: 'different',
  disapear: 'disappear', doesnt: "doesn't", dont: "don't", donot: 'do not',
  duoble: 'double',
  // e
  embarass: 'embarrass', enviroment: 'environment', equipement: 'equipment',
  excercise: 'exercise', existance: 'existence', experiance: 'experience',
  expereince: 'experience', explaination: 'explanation',
  // f
  familar: 'familiar', favourate: 'favourite', febuary: 'february',
  finaly: 'finally', foriegn: 'foreign', freind: 'friend', form: 'from',
  frmo: 'from', fromt: 'from',
  // g
  goverment: 'government', grammer: 'grammar', greatful: 'grateful',
  garantee: 'guarantee', generaly: 'generally',
  // h
  happend: 'happened', havent: "haven't", heared: 'heard', helpfull: 'helpful',
  hte: 'the', hopefuly: 'hopefully',
  // i
  immediatly: 'immediately', importent: 'important', independant: 'independent',
  intresting: 'interesting', isnt: "isn't", iwll: 'will', iwth: 'with',
  // j
  judgement: 'judgment',
  // k
  knowlegde: 'knowledge', knwo: 'know',
  // l
  langauge: 'language', liek: 'like', liason: 'liaison', liekly: 'likely',
  lisense: 'license', loosing: 'losing',
  // m
  maintainance: 'maintenance', managment: 'management', manaul: 'manual',
  meaninful: 'meaningful', mesage: 'message', millenium: 'millennium',
  mroe: 'more', myslef: 'myself',
  // n
  necesary: 'necessary', neccessary: 'necessary', negociate: 'negotiate',
  nieghbour: 'neighbour', noticable: 'noticeable',
  // o
  ocasion: 'occasion', occured: 'occurred', occurence: 'occurrence',
  ocurr: 'occur', oppertunity: 'opportunity', orginize: 'organize',
  otehr: 'other',
  // p
  particulary: 'particularly', peice: 'piece', percieve: 'perceive',
  permenent: 'permanent', persoanl: 'personal', platfrom: 'platform',
  pleasent: 'pleasant', posible: 'possible', prefered: 'preferred',
  privelege: 'privilege', probaly: 'probably', problme: 'problem',
  programing: 'programming', probelm: 'problem',
  // q
  questoin: 'question',
  // r
  recieve: 'receive', reccomend: 'recommend', relevent: 'relevant',
  remeber: 'remember', repsonse: 'response', resposne: 'response',
  rought: 'rough',
  // s
  schdule: 'schedule', seperately: 'separately', seperate: 'separate',
  shouldnt: "shouldn't", similiar: 'similar', sincerely: 'sincerely',
  situaton: 'situation', somthing: 'something', somehting: 'something',
  specificaly: 'specifically', studing: 'studying', succesful: 'successful',
  suport: 'support',
  // t
  teh: 'the', thsi: 'this', thier: 'their', ther: 'there', thre: 'there',
  therfore: 'therefore', tommorow: 'tomorrow', tomorow: 'tomorrow',
  togehter: 'together', truely: 'truly',
  // u
  unfortunatly: 'unfortunately', untill: 'until', usefull: 'useful',
  usualy: 'usually',
  // v
  vaccum: 'vacuum', varient: 'variant', visable: 'visible',
  // w
  waht: 'what', whcih: 'which', whihc: 'which', wihle: 'while',
  wiht: 'with', wont: "won't", woudl: 'would', wouldnt: "wouldn't",
  wriet: 'write', wrok: 'work',
  // y
  youre: "you're", yoru: 'your', yeild: 'yield',
};

/**
 * Autocorrects the last word in `text` if a space/punctuation was just appended.
 * Returns { corrected: string, didCorrect: boolean, original: string }.
 */
export function autocorrectLastWord(text) {
  // Only trigger when the final char is a word-boundary character
  const lastChar = text[text.length - 1];
  if (!lastChar || !/[\s.,!?;:]/.test(lastChar)) {
    return { corrected: text, didCorrect: false, original: '' };
  }

  // Extract the word immediately before the boundary char(s)
  const match = text.match(/(\S+)([\s.,!?;:]+)$/);
  if (!match) return { corrected: text, didCorrect: false, original: '' };

  const [, word, tail] = match;
  // Strip surrounding punctuation to isolate the bare word
  const bare = word.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, '');
  if (!bare) return { corrected: text, didCorrect: false, original: '' };

  const replacement = DICT[bare.toLowerCase()];
  if (!replacement) return { corrected: text, didCorrect: false, original: '' };

  // Preserve leading/trailing punctuation around the word
  const prefix = word.slice(0, word.indexOf(bare));
  const suffix = word.slice(word.indexOf(bare) + bare.length);

  // Preserve capitalisation of first letter
  let fixed = replacement;
  if (bare[0] === bare[0].toUpperCase() && bare[0] !== bare[0].toLowerCase()) {
    fixed = replacement[0].toUpperCase() + replacement.slice(1);
  }

  const before = text.slice(0, text.length - word.length - tail.length);
  const correctedText = before + prefix + fixed + suffix + tail;

  return { corrected: correctedText, didCorrect: true, original: bare };
}
