export type VoiceCommand =
  | 'left'
  | 'right'
  | 'fire'
  | 'jump'
  | 'attack'
  | 'defend'
  | 'special'
  | 'start'
  | 'pause'
  | 'resume';

export interface ParsingResult {
  rawText: string;
  command: VoiceCommand | null;
  confidence: number; // 0.0 to 1.0
  timestamp: number;
}

export class CommandParser {
  // Map core game control commands to arrays of phonetic synonyms
  private commandMap: { [key in VoiceCommand]: string[] } = {
    left: ['left', 'move left', 'go left', 'slide left', 'turn left', 'west', 'dodge left'],
    right: ['right', 'move right', 'go right', 'slide right', 'turn right', 'east', 'dodge right'],
    fire: ['fire', 'shoot', 'blast', 'pew', 'projectile', 'shoot fire', 'bullet', 'missile'],
    jump: ['jump', 'leap', 'hop', 'bounce', 'go up', 'high jump', 'airborne'],
    attack: ['attack', 'strike', 'hit', 'punch', 'slash', 'kick', 'melee', 'sword'],
    defend: ['defend', 'shield', 'block', 'protect', 'guard', 'barrier', 'wall'],
    special: ['special', 'ultimate', 'super', 'hyper', 'burst', 'overdrive', 'power up', 'mega', 'doom'],
    start: ['start', 'begin', 'play', 'go', 'launch', 'initiate'],
    pause: ['pause', 'stop', 'halt', 'wait', 'freeze', 'hold'],
    resume: ['resume', 'continue', 'unpause', 'go on']
  };

  /**
   * Semantically maps the lowercased transcript to a valid action
   */
  public parse(text: string): ParsingResult {
    const rawText = text.toLowerCase().trim();
    let detectedCommand: VoiceCommand | null = null;
    let matchedSynonym = '';

    for (const [cmd, synonyms] of Object.entries(this.commandMap)) {
      const voiceCmd = cmd as VoiceCommand;
      
      for (const synonym of synonyms) {
        // Match Scenario: Phrase contains the word (using regex boundary checking)
        const regex = new RegExp(`\\b${synonym}\\b`, 'i');
        if (regex.test(rawText)) {
          // If we found a longer match (e.g., "move left" over "left"), prefer it to avoid sub-word overlap
          if (synonym.length > matchedSynonym.length) {
            detectedCommand = voiceCmd;
            matchedSynonym = synonym;
          }
        }
      }
    }

    return {
      rawText,
      command: detectedCommand,
      confidence: detectedCommand ? 1.0 : 0.0,
      timestamp: Date.now()
    };
  }

  /**
   * Retrieves full list of supported synonym keywords for diagnostic rendering
   */
  public getSynonymList(command: VoiceCommand): string[] {
    return this.commandMap[command] || [];
  }
}
export type { VoiceCommand as VoiceCommandType };
