const { Cooldown, SpamDetection } = require('../../sdk/common/cooldown');
const core = require('../../sdk/core');
module.exports = {
  Cooldown: Cooldown,
  SpamDetection: SpamDetection,
  matcher: core.matcher,
  texted: core.texted,
  toTime: core.toTimeShort,
  generateLink: core.generateLink,
  socmed: core.socmed
};