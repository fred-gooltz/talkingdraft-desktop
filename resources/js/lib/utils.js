/**
 * TalkingStudio — lib/utils.js
 * Pure ES module. No Alpine, no global dependencies.
 * Exports: genId, utils, api
 */

// ── ID generation ─────────────────────────────────────────────────────────────

export function genId(seed) {
  return (seed !== undefined ? seed + '-' : '') +
    Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ── HTTP utility ──────────────────────────────────────────────────────────────

export const utils = {
  apiUrl: window.ENV?.API_URL || 'http://localhost:5001/api',

  async apiReq(fd, rawResponse = false) {
    try {
      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      if (rawResponse) return response;
      return await response.json();
    } catch (err) {
      console.error('API Request Error:', err);
      throw err;
    }
  },

  // Overwritten by app.js to route to the global toast
  showAlert(msg, timeout, modal, type) {
    console.warn('showAlert not yet wired:', msg);
  },
};

// ── Story API ─────────────────────────────────────────────────────────────────

export const api = {

  // ── Structure presets ───────────────────────────────────────────────────────
  // Act label standard: Act 1 | Act 2 | Act 3 | Act 4
  // (Act 2a maps to Act 2, Act 2b maps to Act 3, classic Act 3 maps to Act 4)

  sectionPresets: {

    'Free Form': { desc: 'No guide. Write by the seat of your pants!', sections: [
      { name:'Opening', act:'', st:0, en:1,
        desc:'Starts the story, however long it takes.' },
    ]},

    'Save the Cat': { desc:"Blake Snyder's Hollywood method defines the key plot points and when they occur.", sections: [
      { name:'Opening Image',          act:'Act 1', st:0,    en:.01,  desc:"A before snapshot of the hero's world. Sets tone, mood, style, and scope." },
      { name:'Theme Stated',           act:'Act 1', st:.01,  en:.03,  desc:'A secondary character poses the theme question, or a location suggests it.' },
      { name:'Set Up',                 act:'Act 1', st:.03,  en:.10,  desc:'Introduce hero and key characters. Show flaws that need fixing.' },
      { name:'Catalyst',               act:'Act 1', st:.10,  en:.11,  desc:'A single life-changing event. The Call to Adventure. Stasis = Death.' },
      { name:'Debate',                 act:'Act 1', st:.11,  en:.21,  desc:'Hero reacts to the change. Should she follow this new path? A choice is made.' },
      { name:'Break into Act II',      act:'Act 2', st:.21,  en:.22,  desc:'Hero leaves the old world behind. A strong, definite change.' },
      { name:'B Story Introduction',   act:'Act 2', st:.22,  en:.23,  desc:'Often the love story. A break from main tension; carries the theme.' },
      { name:'Fun and Games',          act:'Act 2', st:.23,  en:.49,  desc:'Heart of the story, promise of the premise. Trailer moments. Stakes not too high yet.' },
      { name:'Midpoint',               act:'Act 3', st:.49,  en:.50,  desc:'Threshold between halves. Stakes raised. Fun and games are over.' },
      { name:'Bad Guy Closes In',      act:'Act 3', st:.50,  en:.67,  desc:'Hero is really tested. Bad guys regroup; hero\'s team unravels.' },
      { name:'All is Lost',            act:'Act 3', st:.67,  en:.68,  desc:'Hero at lowest point. Whiff of death. Old way of thinking dies.' },
      { name:'Dark Night of the Soul', act:'Act 3', st:.68,  en:.76,  desc:'Hero ruminates in the dark. Finds the answer, often from the B Story.' },
      { name:'Break into Act III',     act:'Act 4', st:.76,  en:.77,  desc:'Hero has the idea. Theme and subplot intertwine with main plot.' },
      { name:'Finale',                 act:'Act 4', st:.77,  en:.99,  desc:'Hero triumphs. Bad guys dispatched. New world order revealed.' },
      { name:'Final Image',            act:'Act 4', st:.99,  en:1,    desc:'Opposite of opening image. Proof that change has occurred and is real.' },
    ]},

    'Eight Sequences': { desc:'Frank Daniel divides a story into 8 sequences that generate cliffhangers and twists.', sections: [
      { name:'Status Quo & Inciting Incident',      act:'Act 1', st:0,   en:.12, desc:'Establishes the central character, their life, the status quo, and the world. Ends with the Point of Attack or Inciting Incident.' },
      { name:'Predicament & Lock In',               act:'Act 1', st:.12, en:.25, desc:'Sets up the predicament. First glimpses of obstacles. Ends when the MC is locked in, propelled toward a new goal.' },
      { name:'First Obstacle & Raising the Stakes', act:'Act 2', st:.25, en:.37, desc:'First obstacle. Remaining exposition from Act 1. Stakes raised with more to lose.' },
      { name:'First Culmination & Midpoint',        act:'Act 2', st:.37, en:.50, desc:'Rising action builds to the First Culmination, which parallels the Resolution.' },
      { name:'Subplot & Rising Action',             act:'Act 3', st:.50, en:.62, desc:'Subplot takes the ball. Still rising action, not yet ready for the main culmination.' },
      { name:'Main Culmination & End of Act Two',   act:'Act 3', st:.62, en:.75, desc:'Back to main story. Highest obstacle, last alternative, end of main tension.' },
      { name:'New Tension & Twist',                 act:'Act 4', st:.75, en:.87, desc:'Third act tension established. Simpler, faster. Rapid short scenes. The Twist.' },
      { name:'Resolution',                          act:'Act 4', st:.87, en:1,   desc:'Hell-bent for resolution. Clarity above all. Will she get the girl, defuse the bomb, escape the sharks?' },
    ]},

    'Story Circle': { desc:"Dan Harmon's hero's journey structure for sitcoms and 'there-and-back-again' stories.", sections: [
      { name:'You',    act:'Act 1', st:0,   en:.12, desc:'A character is in a zone of comfort.' },
      { name:'Need',   act:'Act 1', st:.12, en:.25, desc:'But they want something.' },
      { name:'Go',     act:'Act 2', st:.25, en:.37, desc:'They enter an unfamiliar situation.' },
      { name:'Search', act:'Act 2', st:.37, en:.50, desc:'Adapt to it.' },
      { name:'Find',   act:'Act 3', st:.50, en:.62, desc:'Get what they wanted.' },
      { name:'Take',   act:'Act 3', st:.62, en:.75, desc:'Pay a heavy price for it.' },
      { name:'Return', act:'Act 4', st:.75, en:.87, desc:'Then return to their familiar situation.' },
      { name:'Change', act:'Act 4', st:.87, en:1,   desc:'Having changed.' },
    ]},

    'Four Act': { desc:"Aristotle's classic story structure. The setup, the rise/fall, and the resolution.", sections: [
      { name:'Act 1: Stasis',     act:'Act 1', st:0,   en:.25, desc:'The Introduction / story setup.' },
      { name:'Act 2: Thesis',     act:'Act 2', st:.25, en:.50, desc:'The rising action / the stakes get higher.' },
      { name:'Act 3: Antithesis', act:'Act 3', st:.50, en:.75, desc:'The crisis / falling action.' },
      { name:'Act 4: Synthesis',  act:'Act 4', st:.75, en:1,   desc:'The climax, the resolution.' },
    ]},

    '9Cs': { desc:"Screenwriter & playwright Ed Horowitz has taught his 9Cs at UCLA, USC, Chapman, and other film schools in California.", sections: [
      { name:'Character',     act:'Act 1', st:0,    en:.10,  desc:'Establish your MC in their Normal World which embodies the thematic opposite of their eventual triumph.' },
      { name:'Catalyst',      act:'Act 1', st:.10,  en:.13,  desc:'The incident that creates the problem that sets the story in motion. MC rejects the opportunity at first.' },
      { name:'Clear Want',    act:'Act 1', st:.13,  en:.25,  desc:'MC shifts between initial want and New Want created by the Catalyst. Establish defining motivation and objective.' },
      { name:'Conflict',      act:'Act 2', st:.25,  en:.48,  desc:'The Antagonist and other obstacles and challenges the MC will face.' },
      { name:'Consciousness', act:'Act 2', st:.48,  en:.52,  desc:'Midpoint MOMENT: MC has an epiphany about their predicament enabling more focused, directed action.' },
      { name:'Collision',     act:'Act 3', st:.52,  en:.70,  desc:"MC's actions reach their goal and force the antagonist to respond in kind. Stakes and tension rise." },
      { name:'Crisis',        act:'Act 3', st:.70,  en:.75,  desc:'MOMENT when the MC thinks they are furthest from their goal; they think they have failed.' },
      { name:'Climax',        act:'Act 4', st:.75,  en:.97,  desc:"Final conflict between MC and antagonist. MC's action embodies the theme and becomes their defining moment." },
      { name:'Change',        act:'Act 4', st:.97,  en:1,    desc:'Demonstrates what has changed from beginning to end. MC changed, or the world around them, or both.' },
    ]},

    'Five Act': { desc:"Shakespeare's five-act structure: exposition, rising action, climax, falling action, resolution.", sections: [
      { name:'Act 1: Exposition',     act:'Act 1', st:0,   en:.20, desc:'Characters, setting, and background are established. The inciting incident occurs.' },
      { name:'Act 2: Rising Action',  act:'Act 2', st:.20, en:.40, desc:'Complications develop. Tension rises. Protagonist pursues their goal against mounting obstacles.' },
      { name:'Act 3: Climax',         act:'Act 3', st:.40, en:.60, desc:'The turning point. The highest point of tension where the conflict reaches its peak.' },
      { name:'Act 4: Falling Action', act:'Act 3', st:.60, en:.80, desc:'Events after the climax that lead toward resolution. Loose ends are addressed.' },
      { name:'Act 5: Denouement',     act:'Act 4', st:.80, en:1,   desc:'The resolution and conclusion. Order is restored. The final state of affairs is shown.' },
    ]},

    'Five Act TV': { desc:'Most TV has 5 acts. Some shows contain a teaser and tag in the first and fifth acts.', sections: [
      { name:'Act 1: Big start / Exposition',              act:'Act 1', st:0,   en:.11, desc:'Introduce the main characters and backstory. Present the central dilemma. A and B stories set off. Act ends with a wow moment.' },
      { name:'Act 2: Rising action, conflicts appear',     act:'Act 2', st:.11, en:.37, desc:'Things escalate. Conflict increases. Expand the world. C story has three scenes total.' },
      { name:'Act 3: Center, climax',                      act:'Act 3', st:.37, en:.59, desc:'The worst or most exciting beat. Tension peaks. Midpoint ushers in the counterplay.' },
      { name:'Act 4: Falling action',                      act:'Act 3', st:.59, en:.75, desc:'Story turns. New evidence or character revelation. Ticking clock. B story has one scene per act.' },
      { name:'Act 5: Resolution / Tag',                    act:'Act 4', st:.75, en:1,   desc:'Moment of victory, big reveal, loose ends tied. Possible cliffhanger for next episode.' },
    ]},

    'The Paradigm': { desc:"Syd Field's classic 3-Act structure from the 1970s.", sections: [
      { name:'Act 1 begins',                        act:'Act 1', st:0,    en:.11,  desc:'Character and story setting are introduced.' },
      { name:'Inciting Incident',                   act:'Act 1', st:.12,  en:.15,  desc:'The incident that kicks off the story.' },
      { name:'Act 1 (cont)',                        act:'Act 1', st:.16,  en:.21,  desc:'Character and story setting are explored.' },
      { name:'Plot Point 1',                        act:'Act 1', st:.22,  en:.23,  desc:'An incident that hooks the action and spins it in another direction.' },
      { name:'First half of Act 2: Confrontation',  act:'Act 2', st:.24,  en:.36,  desc:'Conflicts and attempts to reach a goal.' },
      { name:'Pinch 1',                             act:'Act 2', st:.37,  en:.39,  desc:'Action that concentrates the story toward the next point.' },
      { name:'Act 2 (cont)',                        act:'Act 2', st:.40,  en:.49,  desc:'Attempts to reach a goal thwarted.' },
      { name:'Midpoint',                            act:'Act 3', st:.50,  en:.51,  desc:'Often a reversal of fortune or revelation that changes the story\'s direction.' },
      { name:'Second half of Act 2: Confrontation', act:'Act 3', st:.52,  en:.62,  desc:'Conflict escalates and stakes are raised.' },
      { name:'Pinch 2',                             act:'Act 3', st:.63,  en:.67,  desc:'Action that concentrates the story toward the next point.' },
      { name:'Plot Point 2',                        act:'Act 3', st:.68,  en:.75,  desc:'An event that thrusts the plot in a new direction, leading into the final act.' },
      { name:'Act 3 begins',                        act:'Act 3', st:.76,  en:.77,  desc:'Forces in opposition confront each other.' },
      { name:'Showdown',                            act:'Act 4', st:.78,  en:.84,  desc:'Forces in opposition confront each other and victory or defeat is the outcome.' },
      { name:'Resolution',                          act:'Act 4', st:.85,  en:.90,  desc:'The final conflict. Issues of the story are resolved. Goals achieved or not.' },
      { name:'Act 3 (cont)',                        act:'Act 4', st:.91,  en:.94,  desc:'Forces in opposition confront each other, the outcome occurs.' },
      { name:'Denouement',                          act:'Act 4', st:.95,  en:1,    desc:'Tag: a satisfying ending.' },
    ]},

    'Six Stages': { desc:"Michael Hauge's Six Stage Structure brings a character from living in fear to a courageous life.", sections: [
      { name:'Stage 1: Living within identity',     act:'Act 1', st:0,    en:.09,  desc:'The hero is introduced in everyday life. We establish identification — sympathy, likability, or power.' },
      { name:'Turning Point 1: Opportunity',        act:'Act 1', st:.10,  en:.11,  desc:'Something happens that gives the character a decision and an external goal.' },
      { name:'Stage 2: Glimpse of essence',         act:'Act 1', st:.12,  en:.21,  desc:'Hero glimpses their destiny — a glimpse of living in essence, their deeper true self.' },
      { name:'Turning Point 2: Change of Plans',    act:'Act 2', st:.22,  en:.23,  desc:'A decision transforms the original desire into a visible goal. The outer motivation becomes clear.' },
      { name:'Stage 3: Moving toward essence',      act:'Act 2', st:.24,  en:.48,  desc:'Character pursues the new goal, wavering between identity and essence as fear surfaces.' },
      { name:'Turning Point 3: Point of No Return', act:'Act 3', st:.49,  en:.50,  desc:'The character must commit to the goal. There is no turning back.' },
      { name:'Stage 4: Fully committed / growing fear', act:'Act 3', st:.51, en:.66, desc:'Difficult challenges. The hero can\'t go back. Success feels within grasp but fear grows.' },
      { name:'Turning Point 4: Major Setback',      act:'Act 3', st:.67,  en:.75,  desc:'All is lost. The hero may hide behind their old identity. A sidekick points out the stuckness.' },
      { name:'Stage 5: Living one\'s truth',        act:'Act 4', st:.76,  en:.77,  desc:'Returning to essence — living true to real self — earns success.' },
      { name:'Turning Point 5: Climax',             act:'Act 4', st:.78,  en:.88,  desc:'Hero faces their fear one final time. The biggest hurdle. The outer goal is resolved.' },
      { name:'Stage 6: Destiny achieved',           act:'Act 4', st:.89,  en:1,    desc:'Transformed character living in essence. The outer story resolves, loose ends tied.' },
    ]},

    'Pixar': { desc:"The 'Once upon a time…' story spine.", sections: [
      { name:'Once upon a time…',          act:'Act 1', st:0,    en:.05,  desc:'Introduce your character and setting. Who is this about and where is it set?' },
      { name:'And every day…',             act:'Act 1', st:.06,  en:.10,  desc:'Show what life is like in this world for your central character.' },
      { name:'Until one day…',             act:'Act 2', st:.11,  en:.22,  desc:'Something forces change. What sets the story in motion and its initial shockwaves?' },
      { name:'And because of this…',       act:'Act 2', st:.23,  en:.50,  desc:'What does the main character do or want to achieve?' },
      { name:'And because of that…',       act:'Act 3', st:.51,  en:.68,  desc:'A first objective might be achieved — but what happens next? A new objective.' },
      { name:'Until finally…',             act:'Act 3', st:.69,  en:.85,  desc:'The story\'s moment of truth, and the final push or the big battle.' },
      { name:'And ever since that day…',   act:'Act 4', st:.86,  en:1,    desc:'The close of the story — what does this mean for the central character?' },
    ]},

    'HartChart': { desc:"James V. Hart's Guideposts tell a satisfying story.", sections: [
      { name:'Set the World',          act:'Act 1', st:0,    en:.11,  desc:'Meet the main characters in their world. Size them up. This is the day before the movie starts.' },
      { name:'New Opportunity',        act:'Act 1', st:.12,  en:.19,  desc:'MC gets a new opportunity that could change the course of their life.' },
      { name:'2nd Opportunity',        act:'Act 2', st:.20,  en:.23,  desc:'A second opportunity puts the character in motion toward a new goal.' },
      { name:'Visible Tangible Goal',  act:'Act 2', st:.24,  en:.25,  desc:'The Desire Line: the line your MC follows in pursuit of their desire.' },
      { name:'Progress',               act:'Act 2', st:.26,  en:.29,  desc:'MC makes progress toward the goal, dealing with obstacles and complications.' },
      { name:'Setback',                act:'Act 2', st:.30,  en:.39,  desc:'Something pushes MC away from the goal. Mini-defeats and minor victories.' },
      { name:'Cinderella Moment',      act:'Act 2', st:.40,  en:.49,  desc:'A deserved moment of success empowers MC to reach the Top of the Mountain.' },
      { name:'Top of the Mountain',    act:'Act 3', st:.50,  en:.54,  desc:'The highest point reached. False sense of security. Now spend the story not falling down.' },
      { name:'Point of No Return',     act:'Act 3', st:.55,  en:.74,  desc:'A decision or event from which there is no turning back. The goal must be pursued.' },
      { name:'Plan Falls Apart',       act:'Act 4', st:.75,  en:.78,  desc:'The rug is pulled out. The plan falls apart. Hero is down a hole with no way forward.' },
      { name:'The Resurrection',       act:'Act 4', st:.79,  en:.80,  desc:'All is lost — but will you give the hero a resurrection chance?' },
      { name:'Conflict Resolution',    act:'Act 4', st:.81,  en:.94,  desc:'Does MC get what they want? Growth through the structure determines if they neutralize the nemesis.' },
      { name:'Satisfying Ending',      act:'Act 4', st:.95,  en:1,    desc:'How do you want the audience to feel? Has the ending been earned and properly anticipated?' },
    ]},

    'Seven Keys': { desc:"David Trottier's seven key plot points for a well-developed story.", sections: [
      { name:'Backstory',  act:'Act 1', st:0,    en:.10,  desc:'The Backstory haunts the central character.' },
      { name:'Catalyst',   act:'Act 1', st:.11,  en:.21,  desc:'The Catalyst gets the character moving. Part of the story\'s setup.' },
      { name:'Big Event',  act:'Act 2', st:.22,  en:.49,  desc:'The Big Event changes the character\'s life.' },
      { name:'Midpoint',   act:'Act 3', st:.50,  en:.67,  desc:'The Midpoint is the point of no return or a moment of deep motivation.' },
      { name:'Crisis',     act:'Act 3', st:.68,  en:.76,  desc:'The Crisis is the low point, or an event that forces the key decision leading to the end.' },
      { name:'Showdown',   act:'Act 4', st:.77,  en:.90,  desc:'The Climax/Showdown: the final face-off between central character and the opposition.' },
      { name:'Realization',act:'Act 4', st:.91,  en:1,    desc:'The character and/or audience sees that the character has changed or realized something.' },
    ]},

    'The Debate': { desc:"Drew Yanno's debate format — story as a teachable moment.", sections: [
      { name:'Question',            act:'Act 1', st:0,    en:.24,  desc:'Will the Protagonist get what is needed?' },
      { name:'Debate',              act:'Act 2', st:.25,  en:.75,  desc:'Ups and downs — yes and no. Differentiating needs vs. wants is the inner journey.' },
      { name:'Answer: Setup Final Battle', act:'Act 3', st:.76, en:.83, desc:'Protagonist may answer Act 1 question, then posts a new one.' },
      { name:'The Final Battle',    act:'Act 4', st:.84,  en:.85,  desc:'The light at the end of the tunnel is glimpsed through a Showdown.' },
      { name:'Answers',             act:'Act 4', st:.86,  en:.89,  desc:'Outcome of the battle answers the question from Act 1 or the new one.' },
      { name:'Denouement',          act:'Act 4', st:.90,  en:.95,  desc:'Reflection on the answer.' },
      { name:'Bridge',              act:'Act 4', st:.96,  en:1,    desc:'A final explanation.' },
    ]},

    'Life Torn Apart': { desc:"Peter Dunne's structure focused on emotions and co-protagonist dynamics.", sections: [
      { name:'Opening Scene',                    act:'Act 1', st:0,    en:.04,  desc:'Establish POV and style.' },
      { name:'State Problem',                    act:'Act 1', st:.05,  en:.08,  desc:'Establish emotional state.' },
      { name:'1st Problem / Supporting Cast',    act:'Act 1', st:.09,  en:.10,  desc:'Construct the conundrum and meet the support system.' },
      { name:'Meet Antagonist',                  act:'Act 1', st:.11,  en:.12,  desc:'Someone embodies the conundrum of the old way of life.' },
      { name:'Life As It Was',                   act:'Act 1', st:.13,  en:.18,  desc:'Apparent solution; clash with co-protagonists; solution disappears.' },
      { name:'Problem Worsens',                  act:'Act 1', st:.19,  en:.23,  desc:'Easy way or hard way. Major crisis. Goals set by mentor. Moral dilemma.' },
      { name:'Danger Reveals Fear',              act:'Act 2', st:.24,  en:.32,  desc:'Physical action creates risk. Emotional resistance and fears are revealed.' },
      { name:'Co-Protagonist Feud',              act:'Act 2', st:.33,  en:.36,  desc:'A feud causes doubt and distance.' },
      { name:'Emotional Turmoil',                act:'Act 2', st:.37,  en:.39,  desc:'Fight or flight results in a loss. The route is altered.' },
      { name:'Co-Protagonist Bonding',           act:'Act 2', st:.40,  en:.49,  desc:'Fears challenged, apartness threatened in the bonding moment.' },
      { name:'The Middle',                       act:'Act 3', st:.50,  en:.53,  desc:'New danger defeats old weapons. Emotional defeat. Most vulnerable.' },
      { name:'Co-Protagonist Commitment',        act:'Act 3', st:.54,  en:.57,  desc:'Emotional union. Changes begin. Growth is painful.' },
      { name:'Co-Protagonist Offers Answers',    act:'Act 3', st:.58,  en:.62,  desc:'Elicits acceptance. New reasons to stay and fight.' },
      { name:'Deepest Fears Tested',             act:'Act 3', st:.63,  en:.65,  desc:'Emotional setback. Willing to lose.' },
      { name:'Higher Purpose',                   act:'Act 3', st:.66,  en:.73,  desc:'Rebuild or die. Alone again, but aloneness is sad.' },
      { name:'New Set of Emotions',              act:'Act 3', st:.74,  en:.77,  desc:'Facing death. Commit to love. Faith defeats fears.' },
      { name:'The Climax',                       act:'Act 4', st:.78,  en:.81,  desc:'Victory over the Antagonist. Physical euphoria.' },
      { name:'Final Confrontation',              act:'Act 4', st:.82,  en:.84,  desc:'Emotional letdown. Breakup with co-protagonist.' },
      { name:'Mystery',                          act:'Act 4', st:.85,  en:.86,  desc:'Facing the mysteries of life.' },
      { name:'Victory over Fear',                act:'Act 4', st:.87,  en:.88,  desc:'The Resolution.' },
      { name:'No Exit',                          act:'Act 4', st:.89,  en:.90,  desc:'Realizing you can\'t go home this way.' },
      { name:'Let Go of Old Self',               act:'Act 4', st:.91,  en:.94,  desc:'Embracing co-protagonist. The emotional battle is finally won.' },
      { name:'Honestly Facing Feelings',         act:'Act 4', st:.95,  en:.96,  desc:'Honestly facing feelings causes trust and love.' },
      { name:'Taking the Final Risk',            act:'Act 4', st:.97,  en:.98,  desc:'For Life As it Is Now.' },
      { name:'Prize Obtained',                   act:'Act 4', st:.99,  en:1,    desc:'Happiness.' },
    ]},

    'Ki-Seung-Jeon-Gyeol': { desc:'Classic Chinese, Korean, and Japanese four-part narrative structure, sometimes described as Kishōtenketsu — a conflict-free structure.', sections: [
      { name:'Gi (起: rouse, wake up)',           act:'Act 1', st:0,    en:.12,  desc:'Raising issues and introducing characters. The reason a thing begins.' },
      { name:'Seung (承: receive, build)',        act:'Act 2', st:.13,  en:.65,  desc:'The beginning of action — not to solve a problem necessarily, but for self-realization. Processing hardships.' },
      { name:'Jeon (転: turn)',                   act:'Act 3', st:.66,  en:.90,  desc:'A reversal or change in direction which crescendos near the center of this section.' },
      { name:'Gyeol (結: conclude)',              act:'Act 4', st:.91,  en:1,    desc:'The matter is concluded and lessons are gained through the process or results.' },
    ]},

    'Twenty-Two Steps': { desc:"John Truby's 22 building blocks of a complete moral argument.", sections: [
      { name:'Self-Revelation, Need, and Desire',   act:'Act 1', st:0,    en:.04,  desc:'Inner psychology established. What does the protagonist need and desire?' },
      { name:'Ghost and Story World',               act:'Act 1', st:.05,  en:.09,  desc:'The world and something that haunts the protagonist.' },
      { name:'Weakness and Need',                   act:'Act 1', st:.10,  en:.11,  desc:'Protagonist\'s weaknesses and what they need to feel fulfilled.' },
      { name:'Inciting Event',                      act:'Act 1', st:.12,  en:.13,  desc:'The event that sets the story in motion.' },
      { name:'Desire',                              act:'Act 1', st:.14,  en:.16,  desc:'The protagonist ventures forward toward their desire.' },
      { name:'Ally',                                act:'Act 1', st:.17,  en:.19,  desc:'An ally who will be invaluable on the journey.' },
      { name:'Opponent and/or Mystery',             act:'Act 1', st:.20,  en:.21,  desc:'Antagonistic forces encountered.' },
      { name:'Fake-Ally Opponent',                  act:'Act 1', st:.22,  en:.23,  desc:'Someone who seems like an ally at first.' },
      { name:'First Revelation and Decision',       act:'Act 2', st:.24,  en:.25,  desc:'End of Act 1. Protagonist makes a choice to venture into Act 2.' },
      { name:'Plan',                                act:'Act 2', st:.26,  en:.28,  desc:'Protagonist sets out on a plan to achieve their desires.' },
      { name:'Opponent\'s Plan and Counterattack',  act:'Act 2', st:.29,  en:.33,  desc:'Antagonists fight back with their own plans.' },
      { name:'Drive',                               act:'Act 2', st:.34,  en:.40,  desc:'Protagonist and antagonist fight each other.' },
      { name:'Attack by Ally',                      act:'Act 2', st:.41,  en:.42,  desc:'The fake ally betrays the protagonist.' },
      { name:'Apparent Defeat',                     act:'Act 2', st:.43,  en:.50,  desc:'Protagonist fails and is apparently defeated.' },
      { name:'Second Revelation and Decision',      act:'Act 3', st:.51,  en:.60,  desc:'Hero realizes what went wrong. Enters Act 3 with renewed thematic knowledge.' },
      { name:'Audience Revelation',                 act:'Act 3', st:.61,  en:.65,  desc:'Audience understands how the hero went wrong.' },
      { name:'Third Revelation and Decision',       act:'Act 3', st:.66,  en:.74,  desc:'Hero learns all they can. Now able to beat their opponent.' },
      { name:'Gate, Gauntlet, Visit to Death',      act:'Act 3', st:.75,  en:.76,  desc:'Hero makes a final sacrifice, going through the final test.' },
      { name:'Self-Revelation',                     act:'Act 4', st:.77,  en:.85,  desc:'Hero realizes what they have been doing wrong and what must be set right.' },
      { name:'Moral Decision',                      act:'Act 4', st:.86,  en:.92,  desc:'Hero acts on new knowledge. A decision they could not have made at the beginning.' },
      { name:'New Equilibrium',                     act:'Act 4', st:.93,  en:1,    desc:'Things return to relative normality. The protagonist returns changed.' },
    ]},

  },

  // ── Migration map ───────────────────────────────────────────────────────────

  migrationMap: {
    // Free Form: 1 section maps to section 0 of any target
    'Free Form':        { 'Four Act':[0],'Five Act TV':[0],'Eight Sequences':[0],'Save the Cat':[0],'Story Circle':[0],'9Cs':[0],'Three Act':[0],"Hero's Journey":[0],'Five Act':[0] },

    // Save the Cat: 15 sections
    'Save the Cat':     { 'Free Form':[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],'Four Act':[0,0,0,0,0,1,1,1,2,2,2,2,3,3,3],'Five Act TV':[0,0,0,0,1,1,1,2,2,2,3,3,3,4,4],'Eight Sequences':[0,0,0,1,1,1,2,3,4,4,5,5,6,6,7],'Story Circle':[0,0,0,1,1,1,2,3,4,4,5,5,6,6,7],'9Cs':[0,0,0,1,2,2,3,3,4,5,6,6,7,7,8],'Three Act':[0,0,0,0,0,1,1,1,1,1,1,1,2,2,2],"Hero's Journey":[0,0,0,0,1,1,1,4,5,5,7,8,9,10,11],'Five Act':[0,0,0,0,1,1,1,2,3,3,3,3,4,4,4] },

    // Eight Sequences: 8 sections
    'Eight Sequences':  { 'Free Form':[0,0,0,0,0,0,0,0],'Four Act':[0,0,1,1,2,2,3,3],'Five Act TV':[0,0,1,2,2,2,3,4],'Save the Cat':[2,4,6,7,9,11,13,14],'Story Circle':[0,1,2,3,4,5,6,7],'9Cs':[0,2,3,3,5,6,7,8],'Three Act':[0,0,1,1,1,1,2,2],"Hero's Journey":[0,1,2,3,4,5,6,7,8,9,10,11],'Five Act':[0,0,1,2,3,3,4,4] },

    // Story Circle: 8 sections
    'Story Circle':     { 'Free Form':[0,0,0,0,0,0,0,0],'Four Act':[0,0,1,1,2,2,3,3],'Five Act TV':[0,0,1,2,2,2,3,4],'Eight Sequences':[0,1,2,3,4,5,6,7],'Save the Cat':[2,4,6,7,9,11,13,14],'9Cs':[0,1,3,4,5,6,7,8],'Three Act':[0,0,1,1,1,1,2,2],"Hero's Journey":[0,1,4,5,6,7,8,11],'Five Act':[0,0,1,2,3,3,4,4] },

    // Four Act: 4 sections
    'Four Act':         { 'Free Form':[0,0,0,0],'Five Act TV':[0,1,2,4],'Eight Sequences':[0,2,4,6],'Save the Cat':[0,2,4,6],'Story Circle':[0,2,4,6],'9Cs':[0,3,5,7],'Three Act':[0,1,1,2],"Hero's Journey":[0,4,8,9],'Five Act':[0,1,2,3] },

    // 9Cs: 9 sections
    '9Cs':              { 'Free Form':[0,0,0,0,0,0,0,0,0],'Four Act':[0,0,0,1,1,2,2,3,3],'Five Act TV':[0,1,1,2,2,3,3,4,4],'Eight Sequences':[0,0,1,2,3,4,5,6,7],'Save the Cat':[0,3,4,7,8,9,10,13,14],'Story Circle':[0,1,2,3,4,5,6,6,7],'Three Act':[0,0,0,1,1,1,1,2,2],"Hero's Journey":[0,2,4,5,6,7,7,9,11],'Five Act':[0,0,1,2,2,3,3,4,4] },

    // Hero's Journey: 12 sections
    "Hero's Journey":   { 'Free Form':[0,0,0,0,0,0,0,0,0,0,0,0],'Four Act':[0,0,0,0,1,1,1,2,2,3,3,3],'Five Act TV':[0,0,0,0,1,1,1,2,2,3,3,4],'Eight Sequences':[0,0,0,1,2,2,3,4,5,6,6,7],'Save the Cat':[0,1,3,5,6,7,7,9,10,12,13,14],'Story Circle':[0,1,1,2,2,3,4,4,5,6,7,7],'9Cs':[0,0,1,2,3,4,5,6,6,7,8,8],'Five Act':[0,0,0,1,1,2,2,2,3,4,4,4] },

    // Five Act (Shakespeare): 5 sections
    'Five Act':         { 'Free Form':[0,0,0,0,0],'Four Act':[0,1,2,2,3],'Five Act TV':[0,1,2,3,4],'Eight Sequences':[0,1,3,4,6],'Save the Cat':[0,2,7,9,12],'Story Circle':[0,2,4,5,6],'9Cs':[0,2,3,5,7],"Hero's Journey":[0,4,6,8,10] },

    // Five Act TV: 5 sections
    'Five Act TV':      { 'Free Form':[0,0,0,0,0],'Four Act':[0,1,1,2,3],'Eight Sequences':[0,1,3,4,6],'Save the Cat':[0,1,3,4,6],'Story Circle':[0,1,3,4,6],'9Cs':[0,2,4,6,7],"Hero's Journey":[0,4,7,9,11],'Five Act':[0,1,2,3,4] },
  },

  // ── Factory functions ───────────────────────────────────────────────────────

  defaultScene(sectionIdx) {
    return {
      id: genId(), sectionIdx: sectionIdx || 0,
      name: 'EXT. LOCATION', desc: '',
      tracks: {}, trackOrder: [], duration: 0,
      chars: ['ACTION','NAME-1','NAME-2','NAME-3','NAME-4','NAME-5','NAME-6','NAME-7','NAME-8','NAME-9'],
      lastModified: Date.now(),
    };
  },

  defaultStory(name, sys, min) {
    sys = (sys in this.sectionPresets) ? sys : 'Free Form';
    min = parseInt(min || 0, 10); if (min <= 0) min = 180; // 90 pages × 2 min/page
    const sections = this.sectionPresets[sys].sections.map((e, i) => ({ id: genId(i), value: '' }));
    return { id: genId(), name: ((name ?? '').toString().trim() || 'My Story'), sectionPreset: sys, minutes: min, sections, scenes: [], updated: '' };
  },

  newStory(name, system, pages) {
    name = (name ?? '').toString().trim();
    if (!name)   throw 'Invalid story name';
    if (!system) throw 'Please select a Story Structure';
    // pages → minutes at 2 min/page
    return this.defaultStory(name, system, (parseInt(pages, 10) || 90) * 2);
  },

  addScene(story, sectionIdx, insIdx, chars) {
    if (!story.scenes) throw 'Invalid story';
    let hi = 0;
    insIdx = (insIdx != null && insIdx >= 0)
      ? insIdx
      : story.scenes.findIndex((e) => e.sectionIdx > sectionIdx);
    if (insIdx < 0) insIdx = story.scenes.length;
    const scene = this.defaultScene(sectionIdx);
    if (chars?.length) scene.chars = JSON.parse(JSON.stringify(chars));
    for (const s of story.scenes) {
      const n = parseInt((s.name.match(/LOCATION-(\d+)$/) || [])[1] || 0, 10);
      if (n > hi) hi = n;
    }
    scene.name += '-' + (hi + 1);
    story.scenes.splice(insIdx, 0, scene);
    return scene;
  },

  migratePreset(story, newPreset) {
    if (!(newPreset in this.sectionPresets) || !(newPreset in this.migrationMap)) throw 'Invalid Preset';
    if (!(story.sectionPreset in this.migrationMap)) throw 'Error setting up migration';
    const newsecs = this.sectionPresets[newPreset].sections.map((e, i) => ({ id: genId(i), value: '' }));
    for (let i = 0; i < story.sections.length; i++) {
      const i2 = this.migrationMap[story.sectionPreset][newPreset][i];
      const ns = newsecs[i2];
      const os = story.sections[i];
      ns.value = (ns.value + (ns.value ? '\n' : '') + os.value).trim();
    }
    story.sections = newsecs;
    for (const s of story.scenes) {
      s.sectionIdx = this.migrationMap[story.sectionPreset][newPreset][s.sectionIdx];
    }
  },

  // ── API calls ───────────────────────────────────────────────────────────────

  async saveStory(story, tid, blob) {
    if (!story?.id || !story?.name) throw 'Invalid story';
    const fd = new FormData();
    fd.append('cmd', 'saveStory');
    fd.append('story', JSON.stringify(story));
    if (tid && blob) { fd.append('tid', tid); fd.append('audio', blob); }
    const rcd = await utils.apiReq(fd);
    if (rcd.error) throw rcd.error;
    story.updated = rcd.updated || (Date.now() / 1000);
    return story;
  },

  async deleteStory(story) {
    if (!story?.id) throw 'Invalid Story - Deletion Failed';
    const fd = new FormData();
    fd.append('cmd', 'deleteStory');
    fd.append('id', story.id);
    return await utils.apiReq(fd);
  },

  async getStory(id) {
    const fd = new FormData();
    fd.append('cmd', 'getStory');
    fd.append('id', id);
    const story = await utils.apiReq(fd);
    if (!story?.id) throw 'No story found.';
    return story;
  },
};

// ── Shared helpers ────────────────────────────────────────────────────────────

export function time2ms(time) {
  const s = parseInt(time || 0, 10);
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}

export function sectionBeats(presetName, sectionIdx, storyPages) {
  const preset = api.sectionPresets[presetName];
  if (sectionIdx == null || !storyPages || !preset?.sections?.[sectionIdx]) return '— pp';
  const st = Math.floor(preset.sections[sectionIdx].st * storyPages) + 1;
  let   en = Math.floor(preset.sections[sectionIdx].en * storyPages);
  if (en < st && en < 100) en++;
  return st + ' – ' + en + ' pp';
}

export function storyDuration(story) {
  return (story?.scenes || []).reduce((a, s) => a + (s.duration || 0), 0);
}

export function sceneDuration(story, sectionIdx) {
  return (story?.scenes || []).filter(s => s.sectionIdx === sectionIdx).reduce((a, s) => a + (s.duration || 0), 0);
}
