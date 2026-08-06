function extendNewsletter(sock) {
  if (!sock.newsletterMetadata) {
    sock.newsletterMetadata = async (type, jid) => {
      return await sock.query({
        tag: "xmpp",
        attrs: {},
        content: [
          {
            tag: "query",
            attrs: {
              jid,
              type,
            },
          },
        ],
      }).catch(() => null);
    };
  }
}

module.exports = { extendNewsletter };
