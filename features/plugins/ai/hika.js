module.exports = {
  help: ["hika"],
  command: ["hika"],
  tags: ["ai"],
  run: async (m, { sock, text }) => {
    const resHika = await scraper.hikaai.chat('advanced', { keyword: text, language: 'en' })

    let messageText = resHika.data.text
    const [summary, content] = messageText.split('###').map(part => part.trim())

    messageText = summary.split('\n').map(line => `> ${line}`).join('\n') + '\n\n' + '###' + content

    const references = resHika.data.references
    if (Array.isArray(references) && references.length) {
      messageText += '\n\n`References:`\n'
      references.forEach((ref, index) => {
        if (ref.url && ref.name) {
          messageText += `${settings.dot} ${index + 1}. ${ref.name}\n${ref.url}\n`
        }
      })
    }

    await m.reply(messageText.replace(/\*\*(.*?)\*\*/g, '*$1*').replace(/###/g, '＊'))
  },
  example: "%cmd what is furrylover?"
}