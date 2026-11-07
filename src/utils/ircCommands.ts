/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IrcCommandResult {
  isCommand: boolean;
  action?:
    | 'HELP'
    | 'NICK'
    | 'WHO'
    | 'MSG'
    | 'JOIN'
    | 'LEAVE'
    | 'CHANNELS'
    | 'CLEAR'
    | 'BLOCK'
    | 'UNBLOCK'
    | 'STATUS'
    | 'SOS'
    | 'MODE'
    | 'UNKNOWN';
  params?: string[];
  feedbackMessage?: string;
}

export function parseIrcCommand(input: string): IrcCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { isCommand: false };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'help':
      return {
        isCommand: true,
        action: 'HELP',
        feedbackMessage:
          'Available Mesh commands:\n' +
          '• /nick <name> - Change local display name\n' +
          '• /who or /peers - Display nearby mesh participants\n' +
          '• /msg <user_or_id> <message> - Send direct encrypted message\n' +
          '• /join <#channel> [password] - Join or create a mesh channel\n' +
          '• /leave [channel] - Leave active channel\n' +
          '• /channels - List available mesh chat rooms\n' +
          '• /clear - Clear message history in current view\n' +
          '• /block <id> - Block sender from mesh routing\n' +
          '• /unblock <id> - Unblock sender\n' +
          '• /status - View RF mesh health and node stats\n' +
          '• /sos <message> - Broadcast emergency distress beacon\n' +
          '• /mode <perf|balanced|saver> - Set BLE power consumption mode',
      };

    case 'nick':
      if (args.length === 0) {
        return { isCommand: true, action: 'UNKNOWN', feedbackMessage: 'Usage: /nick <new_display_name>' };
      }
      return { isCommand: true, action: 'NICK', params: [args.join(' ')] };

    case 'who':
    case 'peers':
      return { isCommand: true, action: 'WHO' };

    case 'msg':
    case 'tell':
      if (args.length < 2) {
        return { isCommand: true, action: 'UNKNOWN', feedbackMessage: 'Usage: /msg <user> <message text>' };
      }
      return {
        isCommand: true,
        action: 'MSG',
        params: [args[0], args.slice(1).join(' ')],
      };

    case 'join':
      if (args.length === 0) {
        return { isCommand: true, action: 'UNKNOWN', feedbackMessage: 'Usage: /join <#channel_name> [password]' };
      }
      let chan = args[0];
      if (!chan.startsWith('#')) chan = `#${chan}`;
      return { isCommand: true, action: 'JOIN', params: [chan, args[1] || ''] };

    case 'leave':
    case 'part':
      return { isCommand: true, action: 'LEAVE', params: args };

    case 'channels':
    case 'list':
      return { isCommand: true, action: 'CHANNELS' };

    case 'clear':
      return { isCommand: true, action: 'CLEAR' };

    case 'block':
      if (args.length === 0) {
        return { isCommand: true, action: 'UNKNOWN', feedbackMessage: 'Usage: /block <user_id>' };
      }
      return { isCommand: true, action: 'BLOCK', params: [args[0]] };

    case 'unblock':
      if (args.length === 0) {
        return { isCommand: true, action: 'UNKNOWN', feedbackMessage: 'Usage: /unblock <user_id>' };
      }
      return { isCommand: true, action: 'UNBLOCK', params: [args[0]] };

    case 'status':
      return { isCommand: true, action: 'STATUS' };

    case 'sos':
      const sosMsg = args.length > 0 ? args.join(' ') : 'EMERGENCY DISTRESS BEACON ACTIVATED';
      return { isCommand: true, action: 'SOS', params: [sosMsg] };

    case 'mode':
      const mode = (args[0] || '').toLowerCase();
      if (['performance', 'perf', 'balanced', 'saver'].includes(mode)) {
        const normalized = mode === 'perf' ? 'performance' : mode;
        return { isCommand: true, action: 'MODE', params: [normalized] };
      }
      return { isCommand: true, action: 'UNKNOWN', feedbackMessage: 'Usage: /mode <performance | balanced | saver>' };

    default:
      return {
        isCommand: true,
        action: 'UNKNOWN',
        feedbackMessage: `Unknown command: /${command}. Type /help for a list of mesh commands.`,
      };
  }
}
